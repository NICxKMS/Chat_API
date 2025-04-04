/**
 * Server Load Testing Script
 * 
 * This script simulates load on the Chat API server by generating concurrent
 * chat completion requests. It supports various testing scenarios and
 * provides detailed performance metrics.
 */
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import autocannon from 'autocannon';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Configuration
const DEFAULT_CONFIG = {
  // Server settings
  baseUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  apiKey: process.env.API_KEY || '',
  
  // Test parameters
  connections: 10,           // Number of concurrent connections
  duration: 30,              // Test duration in seconds
  pipelining: 50,             // Number of pipelined requests
  timeout: 20,               // Request timeout in seconds
  
  // Chat completion parameters
  model: process.env.TEST_MODEL || 'gemini/gemini-2.0-flash-lite',
  temperature: 0.7,
  maxTokens: 100,
  
  // Rate limiting
  requestsPerSecond: 10000,      // Reduced from 0 (unlimited) to 5 per second to avoid rate limiting
  
  // Monitoring
  printInterval: 5,          // Print stats every N seconds
};

// Command line arguments processing
const args = process.argv.slice(2);
const config = { ...DEFAULT_CONFIG };

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];
  
  if (arg === '--connections' && nextArg) {
    config.connections = parseInt(nextArg, 10);
    i++;
  } else if (arg === '--duration' && nextArg) {
    config.duration = parseInt(nextArg, 10);
    i++;
  } else if (arg === '--model' && nextArg) {
    config.model = nextArg;
    i++;
  } else if (arg === '--url' && nextArg) {
    config.baseUrl = nextArg;
    i++;
  } else if (arg === '--key' && nextArg) {
    config.apiKey = nextArg;
    i++;
  } else if (arg === '--requests-per-second' && nextArg) {
    config.requestsPerSecond = parseInt(nextArg, 10);
    i++;
  } else if (arg === '--help') {
    console.log(`
Load Testing Script for Chat API

Options:
  --connections N          Number of concurrent connections (default: ${DEFAULT_CONFIG.connections})
  --duration N             Test duration in seconds (default: ${DEFAULT_CONFIG.duration})
  --model NAME             Model name to use for testing (default: ${DEFAULT_CONFIG.model})
  --url URL                Base URL of the API (default: ${DEFAULT_CONFIG.baseUrl})
  --key KEY                API key for authentication (default: from .env API_KEY)
  --requests-per-second N  Rate limit requests per second (default: ${DEFAULT_CONFIG.requestsPerSecond})
  --help                   Show this help message
    `);
    process.exit(0);
  }
}

// Try to load API key from .env if not provided
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

// Sample messages for testing
const SAMPLE_MESSAGES = [
  [{ role: "user", content: "What is the capital of France?" }],
  [{ role: "user", content: "Tell me a joke about programming." }],
  [{ role: "user", content: "Explain quantum computing in simple terms." }],
  [{ role: "user", content: "What's the best way to learn JavaScript?" }],
  [{ role: "user", content: "How does machine learning work?" }],
  [{ role: "user", content: "Write a haiku about coding." }],
  [{ role: "user", content: "Describe the differences between REST and GraphQL." }],
  [{ role: "user", content: "Give me 3 tips for productivity." }],
  [{ role: "user", content: "What are the benefits of microservices?" }],
  [{ role: "user", content: "Explain how blockchain works." }],
];

/**
 * Run a health check before starting load test
 */
async function runHealthCheck() {
  try {
    console.log(chalk.blue('Running health check...'));
    const healthCheckUrl = `${config.baseUrl}/api/health`;
    
    const response = await fetch(healthCheckUrl);
    
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(chalk.green('Health check passed:'), data);
    
    // Also try a test request to verify the API endpoint and format
    console.log(chalk.blue('Sending test request to verify API endpoint...'));
    
    const testRequestUrl = `${config.baseUrl}/api/chat/completions`;
    const testRequestBody = {
      model: config.model,
      messages: [{ role: "user", content: "Hello, this is a test message." }],
      temperature: config.temperature,
      max_tokens: 10
    };
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    
    const testResponse = await fetch(testRequestUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testRequestBody),
      timeout: 10000
    });
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      throw new Error(`Test request failed with status: ${testResponse.status} - ${errorText}`);
    }
    
    console.log(chalk.green('API endpoint verified successfully'));
    return true;
  } catch (error) {
    console.error(chalk.red('API verification failed:'), error.message);
    console.log(chalk.yellow('Make sure the server is running and the API endpoint is correct.'));
    
    // Provide troubleshooting tips
    console.log(chalk.cyan('\nTroubleshooting tips:'));
    console.log('1. Verify the API endpoint format (check /api/chat/completions vs /api/chat)');
    console.log('2. Check if authentication is required (provide --key or set API_KEY in .env)');
    console.log('3. Verify the model format (provider/model format, e.g., openai/gpt-3.5-turbo)');
    console.log('4. Try with a lower rate limit (--requests-per-second 2)');
    
    return false;
  }
}

/**
 * Run load test using autocannon
 */
async function runLoadTest() {
  // First run a health check
  const healthStatus = await runHealthCheck();
  if (!healthStatus) {
    process.exit(1);
  }
  
  console.log(chalk.blue('\nStarting load test with the following configuration:'));
  console.log(chalk.cyan('URL:'), config.baseUrl);
  console.log(chalk.cyan('Connections:'), config.connections);
  console.log(chalk.cyan('Duration:'), `${config.duration} seconds`);
  console.log(chalk.cyan('Model:'), config.model);
  console.log(chalk.cyan('Rate limit:'), `${config.requestsPerSecond} requests per second`);
  console.log(chalk.cyan('Authentication:'), config.apiKey ? 'Enabled' : 'Disabled');
  
  // Prepare request headers
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  // Set up test
  const instance = autocannon({
    url: `${config.baseUrl}/api/chat/completions`,
    connections: config.connections,
    duration: config.duration,
    timeout: config.timeout * 1000,
    headers: headers,
    requests: [
      {
        method: 'POST',
        path: '/api/chat/completions',
        body: JSON.stringify({
          model: config.model,
          messages: SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
        onResponse: (status, body, context) => {
          try {
            if (status < 200 || status >= 300) {
              context.errors = (context.errors || 0) + 1;
              // Log the first few errors to help debugging
              if (context.errors <= 3) {
                console.error(chalk.red(`Error response (${status}): ${body.substring(0, 200)}...`));
              }
            }
          } catch (e) {
            // Handle parsing errors
            context.errors = (context.errors || 0) + 1;
          }
        }
      }
    ],
    setupClient: (client) => {
      // Custom per-client tracking
      client.customData = {
        successfulRequests: 0,
        failedRequests: 0,
        totalLatency: 0,
      };
      
      // Track successful responses
      client.on('response', (statusCode, resBytes, responseTime) => {
        if (statusCode >= 200 && statusCode < 300) {
          client.customData.successfulRequests++;
          client.customData.totalLatency += responseTime;
        } else {
          client.customData.failedRequests++;
        }
      });
    },
    // Always apply rate limiting to avoid overwhelming the server
    maxConnectionRequests: Math.ceil(config.requestsPerSecond / config.connections)
  });
  
  // Set up tracking
  let intervalId;
  let lastBytesRead = 0;
  let lastResponses = 0;
  
  if (config.printInterval > 0) {
    intervalId = setInterval(() => {
      const stats = instance.stats;
      if (!stats || typeof stats !== 'object') {
        return; // Skip this interval if stats not ready
      }
      
      const currentResponses = stats.responses || 0;
      const currentBytesRead = stats.bytesRead || 0;
      
      const newResponses = currentResponses - lastResponses;
      const newBytesRead = currentBytesRead - lastBytesRead;
      
      console.log(chalk.yellow(`[${new Date().toISOString()}] Current RPS: ${(newResponses / config.printInterval).toFixed(2)}, Transfer rate: ${(newBytesRead / 1024 / config.printInterval).toFixed(2)} KB/s`));
      
      lastResponses = currentResponses;
      lastBytesRead = currentBytesRead;
    }, config.printInterval * 1000);
  }
  
  // Start tracking
  autocannon.track(instance, {
    renderProgressBar: true,
    renderLatencyTable: true,
    renderResultsTable: true,
  });
  
  // Handle results
  instance.on('done', (results) => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    printResults(results);
  });
  
  // Handle errors
  process.once('SIGINT', () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    console.log(chalk.yellow('\nGracefully shutting down test...'));
    instance.stop();
  });
}

/**
 * Print detailed results
 */
function printResults(results) {
  if (!results || typeof results !== 'object') {
    console.log(chalk.red('No valid results to display'));
    return;
  }

  console.log('\n');
  console.log(chalk.blue('===== LOAD TEST RESULTS ====='));
  
  // Request statistics
  console.log(chalk.cyan('\nRequest Statistics:'));
  if (results.requests) {
    console.log(`Total requests:     ${chalk.bold(results.requests.total || 0)}`);
    console.log(`Requests/sec:       ${chalk.bold((results.requests.average || 0).toFixed(2))}`);
    
    const non2xx = results.non2xx || 0;
    const total = results.requests.total || 1; // Avoid division by zero
    const successful = total - non2xx;
    
    console.log(`Successful:         ${chalk.bold.green(successful)} (${((successful / total) * 100).toFixed(2)}%)`);
    console.log(`Failed:             ${chalk.bold.red(non2xx)} (${((non2xx / total) * 100).toFixed(2)}%)`);
  } else {
    console.log(chalk.yellow('Request statistics not available'));
  }
  
  // Latency statistics
  console.log(chalk.cyan('\nLatency Statistics (ms):'));
  if (results.latency) {
    console.log(`Min:                ${chalk.bold(results.latency.min || 0)}`);
    console.log(`Mean:               ${chalk.bold((results.latency.average || 0).toFixed(2))}`);
    console.log(`Median:             ${chalk.bold((results.latency.p50 || 0).toFixed(2))}`);
    console.log(`p90:                ${chalk.bold((results.latency.p90 || 0).toFixed(2))}`);
    console.log(`p99:                ${chalk.bold((results.latency.p99 || 0).toFixed(2))}`);
    console.log(`Max:                ${chalk.bold(results.latency.max || 0)}`);
  } else {
    console.log(chalk.yellow('Latency statistics not available'));
  }
  
  // Throughput statistics
  console.log(chalk.cyan('\nThroughput Statistics:'));
  if (results.throughput) {
    console.log(`Transfer/sec:       ${chalk.bold(((results.throughput.average || 0) / 1024 / 1024).toFixed(2))} MB`);
    console.log(`Total transfer:     ${chalk.bold(((results.throughput.total || 0) / 1024 / 1024).toFixed(2))} MB`);
  } else {
    console.log(chalk.yellow('Throughput statistics not available'));
  }
  
  // Detailed performance advice
  console.log(chalk.cyan('\nPerformance Analysis:'));
  
  if (results.errors > 0) {
    console.log(chalk.red(`⚠️ ${results.errors} errors detected during testing`));
    console.log(chalk.yellow('Check server logs for more detailed information'));
  }
  
  if (results.latency && results.latency.average > 2000) {
    console.log(chalk.yellow('⚠️ Average response time is high (>2s). Consider optimizing response times.'));
  }
  
  if (results.timeouts > 0) {
    console.log(chalk.red(`⚠️ ${results.timeouts} requests timed out`));
    console.log(chalk.yellow('Consider increasing timeout or optimizing server processing'));
  }
  
  // Add recommendations based on success rate
  if (results.requests && results.non2xx) {
    const successRate = ((results.requests.total - results.non2xx) / results.requests.total) * 100;
    
    if (successRate < 10) {
      console.log(chalk.red('\n⚠️ Very low success rate detected. Consider:'));
      console.log('1. Checking API endpoint URL and format');
      console.log('2. Verifying API key and authentication');
      console.log('3. Checking server logs for specific errors');
      console.log('4. Reducing request rate further (--requests-per-second 1)');
    } else if (successRate < 50) {
      console.log(chalk.yellow('\n⚠️ Low success rate detected. Consider:'));
      console.log('1. Checking for rate limiting issues');
      console.log('2. Verifying model availability');
      console.log('3. Increasing server resources if self-hosted');
    }
  }
  
  console.log(chalk.blue('\n===== END OF RESULTS ====='));
}

// Run the load test
runLoadTest().catch(err => {
  console.error(chalk.red('Error running load test:'), err);
  process.exit(1);
}); 