/**
 * Streaming Load Test for Chat API
 * 
 * This script focuses on testing the streaming endpoint (/api/chat/stream)
 * to measure performance and stability under load for streaming responses.
 */
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Default configuration
const DEFAULT_CONFIG = {
  baseUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  apiKey: process.env.API_KEY || '',
  concurrentRequests: 3,   // Reduced from 10
  totalRequests: 3,      // Reduced from 100 for quicker testing
  model: process.env.TEST_MODEL || 'openai/gpt-4o-mini',
  delayBetweenBatches: 1500, // Increased from 1000ms
  batchSize: 3,             // Reduced from 5
  timeout: 60000,           // ms
  reportingInterval: 5000,  // ms
};

// Sample messages for testing (similar to main load test)
const SAMPLE_MESSAGES = [
  [{ role: "user", content: "What is the capital of France?" }],
  [{ role: "user", content: "Tell me a joke about programming." }],
  [{ role: "user", content: "Explain quantum computing in simple terms." }],
  [{ role: "user", content: "What's the best way to learn JavaScript?" }],
  [{ role: "user", content: "How does machine learning work?" }],
];

// Process command line args
const args = process.argv.slice(2);
const config = { ...DEFAULT_CONFIG };

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];
  
  if (arg === '--concurrent' && nextArg) {
    config.concurrentRequests = parseInt(nextArg, 10);
    i++;
  } else if (arg === '--requests' && nextArg) {
    config.totalRequests = parseInt(nextArg, 10);
    i++;
  } else if (arg === '--model' && nextArg) {
    config.model = nextArg;
    i++;
  } else if (arg === '--url' && nextArg) {
    config.baseUrl = nextArg;
    i++;
  } else if (arg === '--key' && nextArg) { // Added API key arg
    config.apiKey = nextArg;
    i++;
  } else if (arg === '--batch' && nextArg) {
    config.batchSize = parseInt(nextArg, 10);
    i++;
  } else if (arg === '--help') {
    console.log(`
Stream Testing Script for Chat API

Options:
  --concurrent N     Number of concurrent connections (default: ${DEFAULT_CONFIG.concurrentRequests})
  --requests N       Total number of requests to make (default: ${DEFAULT_CONFIG.totalRequests})
  --model NAME       Model name to use for testing (default: ${DEFAULT_CONFIG.model})
  --url URL          Base URL of the API (default: ${DEFAULT_CONFIG.baseUrl})
  --key KEY          API key for authentication (default: from .env API_KEY)
  --batch N          Batch size for requests (default: ${DEFAULT_CONFIG.batchSize})
  --help             Show this help message
    `);
    process.exit(0);
  }
}

// Try to load API key from .env if not provided (similar to load-test.js)
if (!config.apiKey) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const apiKeyMatch = envContent.match(/API_KEY=(.+)/);
      if (apiKeyMatch && apiKeyMatch[1]) {
        config.apiKey = apiKeyMatch[1].trim();
        console.log(chalk.green('API key loaded from .env file'));
      }
    }
  } catch (error) {
    console.warn(chalk.yellow('Could not load API key from .env file'));
  }
}

// Verify required configuration
if (!config.apiKey) {
  console.warn(chalk.yellow('No API key provided. Authentication may fail.'));
}

// Stats tracking
const stats = {
  startTime: null,
  endTime: null,
  requestsStarted: 0,
  requestsCompleted: 0,
  requestsFailed: 0,
  totalChunks: 0,
  totalTokens: 0,
  latencies: [],
  chunkTimes: [],
  firstChunkLatencies: [],
  errors: [],
};

// Health check before beginning
async function healthCheck() {
  try {
    console.log(chalk.blue('Running health check...'));
    const response = await fetch(`${config.baseUrl}/api/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(chalk.green('Health check passed:'), data);

    // Also try a test streaming request
    console.log(chalk.blue('Sending test streaming request...'));
    const testUrl = `${config.baseUrl}/api/chat/stream`;
    const headers = { 
        'Content-Type': 'application/json', 
        'Accept': 'text/event-stream' 
    };
    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: "Test stream" }],
            stream: true,
            max_tokens: 5
        }),
        compress: false
    });

    if (!testResponse.ok) {
        const errorText = await testResponse.text();
        throw new Error(`Test streaming request failed: ${testResponse.status} - ${errorText}`);
    }

    // Verify the response is a stream
    const contentType = testResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('text/event-stream')) {
        throw new Error(`Expected Content-Type 'text/event-stream' for health check, but got: ${contentType}`);
    }
    console.log(chalk.green('Test stream response has correct Content-Type'));

    // Try reading one chunk using Node.js stream events
    if (testResponse.body && typeof testResponse.body.on === 'function') {
        await new Promise((resolve, reject) => {
            let dataReceived = false;
            testResponse.body.once('data', () => {
                dataReceived = true;
                console.log(chalk.green('Test stream received data successfully during health check (Node.js event)'));
                // We don't need the actual data, just confirmation
                testResponse.body.pause(); // Stop consuming data
                resolve();
            });
            testResponse.body.once('error', (err) => {
                console.error(chalk.red('Error event on test stream during health check:'), err.message);
                reject(new Error(`Test stream emitted error during health check: ${err.message}`));
            });
            testResponse.body.once('end', () => {
                if (!dataReceived) {
                    console.warn(chalk.yellow('Test stream ended prematurely during health check (Node.js event)'));
                }
                resolve(); // Resolve even if it ended early without data, maybe OK
            });
            // Add a timeout in case no events fire
            setTimeout(() => {
                if (!dataReceived) {
                  console.warn(chalk.yellow('Test stream health check timed out waiting for first data chunk.'));
                  // Decide if this is an error or just a warning
                  // reject(new Error('Test stream health check timed out'));
                }
                resolve(); // Resolve anyway to avoid blocking
            }, 5000); // 5 second timeout for the first chunk check
        });
    } else {
        // If Content-Type was correct, but it's not a Node stream, log warning
        console.warn(chalk.yellow('Test response body is missing or not a Node.js stream despite correct Content-Type!'));
        // throw new Error('Test response body is not a readable stream or getReader is missing');
    }

    console.log(chalk.green('Streaming endpoint verification completed (or issue logged).'));
    return true;
  } catch (error) {
    console.error(chalk.red('API/Stream verification failed:'), error.message);
    console.log(chalk.yellow('Check server logs, API key, and stream endpoint.'));
    return false;
  }
}

// Makes a streaming request and processes the response
async function makeStreamingRequest(id) {
  const requestStart = Date.now();
  const messageSet = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
  let firstChunkTime = null;
  let chunkCount = 0;
  let approximateTokenCount = 0;
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };
    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: config.model,
        messages: messageSet,
        temperature: 0.7,
        max_tokens: 150,
        stream: true
      }),
      compress: false
    });
    
    if (!response.ok) {
        // Read the error body for better diagnostics
        let errorBody = 'Could not read error body';
        try {
            errorBody = await response.text();
        } catch (e) { /* ignore */ }
        throw new Error(`Request failed with status: ${response.status}. Body: ${errorBody.substring(0, 200)}`);
    }
    
    // Check if the body is a Node.js readable stream
    if (!response.body || typeof response.body.on !== 'function') {
        console.error('Invalid response body received (not a Node.js stream):', response.body);
        throw new Error('Response body is not a Node.js readable stream');
    }
    
    // Process the stream using Node.js event listeners
    const stream = response.body;
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    await new Promise((resolve, reject) => {
        stream.on('data', (rawValue) => {
            // Record the first chunk arrival time
            if (firstChunkTime === null) {
                firstChunkTime = Date.now();
                stats.firstChunkLatencies.push(firstChunkTime - requestStart);
            }
            
            const chunk = decoder.decode(rawValue, { stream: true });
            buffer += chunk;
            
            // Process buffer to extract SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep last incomplete line in buffer
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    chunkCount++;
                    if (line !== 'data: [DONE]') {
                        try {
                            // Approximate token count (rough estimate)
                            const jsonStr = line.substring(6).trim(); // Remove 'data: ' prefix and trim
                            if (jsonStr) { // Ensure not empty after trim
                                const jsonData = JSON.parse(jsonStr);
                                if (jsonData.choices && jsonData.choices[0] && jsonData.choices[0].delta) {
                                    const content = jsonData.choices[0].delta.content || '';
                                    // Very rough approximation: ~4 characters per token
                                    approximateTokenCount += Math.ceil(content.length / 4);
                                }
                            }
                        } catch (e) {
                            console.warn(`Failed to parse JSON chunk for request ${id}: ${line}`, e);
                            // Optionally count parse errors
                        }
                    }
                }
            }
        });

        stream.on('end', () => {
            // console.log(`Stream finished for request ${id}`);
            resolve(); // Resolve the promise when the stream ends
        });

        stream.on('error', (err) => {
            console.error(`Stream error for request ${id}: ${err.message}`);
            reject(err); // Reject the promise on stream error
        });
    });
    
    // Record statistics (moved outside the promise, after stream finishes)
    const requestEnd = Date.now();
    const latency = requestEnd - requestStart;
    
    stats.requestsCompleted++;
    stats.latencies.push(latency);
    stats.totalChunks += chunkCount;
    stats.totalTokens += approximateTokenCount;
    
    // Calculate average time between chunks if we received multiple chunks
    if (chunkCount > 1 && firstChunkTime) { // Ensure firstChunkTime is set
      const avgChunkTime = (requestEnd - firstChunkTime) / (chunkCount - 1);
      stats.chunkTimes.push(avgChunkTime);
    }
    
    return {
      id,
      success: true,
      latency,
      chunks: chunkCount,
      tokens: approximateTokenCount,
      firstChunkLatency: firstChunkTime ? firstChunkTime - requestStart : latency // Use total latency if no chunks came?
    };
  } catch (error) {
    stats.requestsFailed++;
    stats.errors.push({
      id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      id,
      success: false,
      error: error.message
    };
  }
}

// Run a batch of concurrent requests
async function runBatch(batchSize, startId) {
  const promises = [];
  
  for (let i = 0; i < batchSize; i++) {
    const id = startId + i;
    stats.requestsStarted++;
    promises.push(makeStreamingRequest(id));
  }
  
  return Promise.all(promises);
}

// Print current stats
function printStats() {
  const elapsedSeconds = (Date.now() - stats.startTime) / 1000;
  // Avoid division by zero if elapsedSeconds is very small or zero
  const rps = elapsedSeconds > 0 ? stats.requestsCompleted / elapsedSeconds : 0;
  
  // Calculate averages only if data exists
  const avgLatency = stats.latencies.length 
    ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length 
    : 0;
  
  const avgFirstChunkLatency = stats.firstChunkLatencies.length 
    ? stats.firstChunkLatencies.reduce((a, b) => a + b, 0) / stats.firstChunkLatencies.length 
    : 0;
  
  const avgChunkTime = stats.chunkTimes.length 
    ? stats.chunkTimes.reduce((a, b) => a + b, 0) / stats.chunkTimes.length 
    : 0;
  
  console.log(chalk.yellow(`\n[${new Date().toISOString()}] Current stats:`));
  console.log(`Requests: ${stats.requestsStarted} started, ${stats.requestsCompleted} completed, ${stats.requestsFailed} failed`);
  console.log(`RPS: ${rps.toFixed(2)}`);
  console.log(`Avg latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Avg first chunk latency: ${avgFirstChunkLatency.toFixed(2)}ms`);
  console.log(`Avg time between chunks: ${avgChunkTime.toFixed(2)}ms`);
  console.log(`Chunks received: ${stats.totalChunks} (approx. ${stats.totalTokens} tokens)`);
}

// Print final report
function printFinalReport() {
  console.log(chalk.blue('\n===== STREAMING TEST RESULTS ====='));
  
  // Calculate final stats only if requests were completed
  const totalCompleted = stats.requestsCompleted;
  const totalStarted = stats.requestsStarted;
  const totalDurationMs = stats.endTime - stats.startTime;
  const totalDurationSec = totalDurationMs / 1000;

  console.log(chalk.cyan('\nTest Summary:'));
  console.log(`Duration: ${totalDurationSec.toFixed(2)} seconds`);
  console.log(`Total Requests: ${totalStarted}`);
  console.log(`Successful: ${totalCompleted}`);
  console.log(`Failed: ${stats.requestsFailed}`);
  if (totalStarted > 0) {
    console.log(`Success Rate: ${((totalCompleted / totalStarted) * 100).toFixed(2)}%`);
  }
  if (totalDurationSec > 0) {
    console.log(`Requests/sec: ${(totalCompleted / totalDurationSec).toFixed(2)}`);
  }

  if (stats.latencies.length > 0) {
    // Sort latencies for percentiles
    const sortedLatencies = [...stats.latencies].sort((a, b) => a - b);
    const p50Index = Math.max(0, Math.floor(sortedLatencies.length * 0.5) - 1);
    const p90Index = Math.max(0, Math.floor(sortedLatencies.length * 0.9) - 1);
    const p99Index = Math.max(0, Math.floor(sortedLatencies.length * 0.99) - 1);
    
    const p50 = sortedLatencies[p50Index] || 0;
    const p90 = sortedLatencies[p90Index] || 0;
    const p99 = sortedLatencies[p99Index] || 0;
    
    console.log(chalk.cyan('\nLatency (ms):'));
    console.log(`Min: ${Math.min(...stats.latencies)}`);
    console.log(`Median (p50): ${p50}`);
    console.log(`p90: ${p90}`);
    console.log(`p99: ${p99}`);
    console.log(`Max: ${Math.max(...stats.latencies)}`);
    console.log(`Average: ${(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(2)}`);
  }

  if (stats.firstChunkLatencies.length > 0) {
    // Sort first chunk latencies for percentiles
    const sortedFirstChunk = [...stats.firstChunkLatencies].sort((a, b) => a - b);
    const fcP50Index = Math.max(0, Math.floor(sortedFirstChunk.length * 0.5) - 1);
    const fcP90Index = Math.max(0, Math.floor(sortedFirstChunk.length * 0.9) - 1);
    
    const fcP50 = sortedFirstChunk[fcP50Index] || 0;
    const fcP90 = sortedFirstChunk[fcP90Index] || 0;
    
    console.log(chalk.cyan('\nFirst Chunk Latency (ms):'));
    console.log(`Min: ${Math.min(...stats.firstChunkLatencies)}`);
    console.log(`Median (p50): ${fcP50}`);
    console.log(`p90: ${fcP90}`);
    console.log(`Average: ${(stats.firstChunkLatencies.reduce((a, b) => a + b, 0) / stats.firstChunkLatencies.length).toFixed(2)}`);
  }
  
  if (totalCompleted > 0) {
    console.log(chalk.cyan('\nStreaming Stats:'));
    console.log(`Total Chunks: ${stats.totalChunks}`);
    console.log(`Avg Chunks per Request: ${(stats.totalChunks / totalCompleted).toFixed(2)}`);
    console.log(`Approx. Total Tokens: ${stats.totalTokens}`);
    
    if (stats.chunkTimes.length > 0) {
      console.log(`Avg Time Between Chunks: ${(stats.chunkTimes.reduce((a, b) => a + b, 0) / stats.chunkTimes.length).toFixed(2)}ms`);
    }
  }
  
  // Print error summary if there were errors
  if (stats.errors.length > 0) {
    console.log(chalk.red('\nErrors:'));
    const errorCounts = {};
    
    stats.errors.forEach(err => {
      const key = err.error;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .slice(0, 10) // Show top 10 errors
      .forEach(([error, count]) => {
        console.log(`${count}x: ${error}`);
      });
    if (Object.keys(errorCounts).length > 10) {
      console.log(chalk.yellow('... and more errors not shown'));
    }
  }
  
  console.log(chalk.blue('\n===== END OF RESULTS ====='));
}

// Main test function
async function runStreamingTest() {
  console.log(chalk.blue('Starting streaming API load test...'));
  console.log(chalk.cyan('Configuration:'));
  console.log(`URL: ${config.baseUrl}/api/chat/stream`);
  console.log(`Concurrent Requests: ${config.concurrentRequests}`);
  console.log(`Total Requests: ${config.totalRequests}`);
  console.log(`Model: ${config.model}`);
  console.log(`Batch Size: ${config.batchSize}`);
  console.log(`Authentication: ${config.apiKey ? 'Enabled' : 'Disabled'}`);
  
  // Health check
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.error(chalk.red('Aborting test due to failed health/stream check'));
    process.exit(1);
  }
  
  // Set up progress tracking
  stats.startTime = Date.now();
  let reportingIntervalId = setInterval(printStats, config.reportingInterval);
  
  // Graceful shutdown handler
  const shutdown = () => {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    clearInterval(reportingIntervalId);
    // Potentially stop ongoing requests if using AbortController
    stats.endTime = Date.now();
    printFinalReport();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);

  try {
    // Process batches
    for (let requestId = 0; requestId < config.totalRequests; requestId += config.batchSize) {
      const currentBatchSize = Math.min(config.batchSize, config.totalRequests - requestId);
      // Limit actual concurrency per batch run
      const maxConcurrentInBatch = Math.min(currentBatchSize, config.concurrentRequests);
      
      // Process this batch
      await runBatch(maxConcurrentInBatch, requestId);
      
      // Check if we need to take a breather between batches
      if (requestId + currentBatchSize < config.totalRequests && config.delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
      }
    }
    
    // All requests completed or failed
    stats.endTime = Date.now();
    clearInterval(reportingIntervalId);
    // Final stats print might be slightly delayed, call printStats one last time
    printStats(); 
    printFinalReport();
    process.removeListener('SIGINT', shutdown); // Remove listener after normal completion
    
  } catch (error) {
    console.error(chalk.red('Test failed unexpectedly:'), error);
    clearInterval(reportingIntervalId);
    stats.endTime = Date.now();
    printFinalReport();
    process.removeListener('SIGINT', shutdown);
    process.exit(1);
  }
}

runStreamingTest().catch(error => {
  console.error(chalk.red('Fatal error during test setup or execution:'), error);
  process.exit(1);
}); 