// server.js
const Fastify = require('fastify');
const { pipeline } = require('stream');
const { promisify } = require('util');
const fetch = require('node-fetch');
const { Readable, PassThrough } = require('stream');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Put your OpenAI key in .env

// Check for OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USE_MOCK_RESPONSES = process.env.USE_MOCK_RESPONSES === 'true';

const pipelineAsync = promisify(pipeline);

const fastify = Fastify({
  logger: true // Enable logging
});

// Add CORS support with more comprehensive settings
fastify.register(require('@fastify/cors'), {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cache-Control', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400 // 24 hours
});

// Register content type parser to handle all types
fastify.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => {
  done(null, body);
});

// Add hook to log detailed request info
fastify.addHook('onRequest', (request, reply, done) => {
  fastify.log.info(`Received ${request.method} request to ${request.url} from ${request.ip}`);
  done();
});

// Add a route for checking server status
fastify.get('/health', async (req, reply) => {
  fastify.log.info('Health check requested');
  return { status: 'ok', time: new Date().toISOString() };
});

// Test endpoint for very simple responses
fastify.get('/test', async (request, reply) => {
  fastify.log.info('Test endpoint requested');
  return { message: 'Test response success' };
});

// Simple text stream endpoint using Fastify's proper streaming API
fastify.get('/simple-stream', (request, reply) => {
  fastify.log.info('Simple stream requested');
  
  // Set correct headers
  reply.header('Content-Type', 'text/plain');
  reply.header('Cache-Control', 'no-cache');
  reply.header('X-Accel-Buffering', 'no');
  
  // Create a PassThrough stream to send data
  const stream = new PassThrough();
  
  // Send the stream as the response (this is the correct way in Fastify)
  reply.send(stream);
  
  // Start writing to the stream
  stream.write('Starting stream...\n');
  
  let lineCount = 0;
  const maxLines = 10;
  
  // Set up interval to write to stream
  const interval = setInterval(() => {
    lineCount++;
    
    if (lineCount <= maxLines) {
      stream.write(`Line ${lineCount} at ${new Date().toISOString()}\n`);
      fastify.log.info(`Sent line ${lineCount} to simple stream`);
    } else {
      // End the stream after 10 lines
      stream.write('Stream complete!');
      stream.end();
      clearInterval(interval);
      fastify.log.info('Simple stream completed');
    }
  }, 500);
  
  // Clean up if request is aborted
  request.raw.on('close', () => {
    clearInterval(interval);
    if (!stream.writableEnded) {
      stream.end();
    }
    fastify.log.info('Client closed simple stream connection');
  });
});

// JSON object streaming endpoint - sends objects one by one
fastify.get('/object-stream', (request, reply) => {
  fastify.log.info('Object stream requested');
  
  // Set headers for JSON streaming
  reply.header('Content-Type', 'application/x-ndjson'); // newline-delimited JSON
  reply.header('Cache-Control', 'no-cache');
  reply.header('X-Accel-Buffering', 'no');
  
  // Create a stream
  const stream = new PassThrough();
  
  // Send the stream
  reply.send(stream);
  
  // Mock data objects to stream
  const dataObjects = [
    { id: 1, name: 'Product A', price: 19.99, inStock: true },
    { id: 2, name: 'Product B', price: 29.99, inStock: false },
    { id: 3, name: 'Product C', price: 39.99, inStock: true },
    { id: 4, name: 'Product D', price: 49.99, inStock: true },
    { id: 5, name: 'Product E', price: 59.99, inStock: false }
  ];
  
  // Send each object with a delay to simulate streaming
  let index = 0;
  
  // Start with metadata
  stream.write(JSON.stringify({ 
    type: 'metadata', 
    totalItems: dataObjects.length,
    startTime: new Date().toISOString() 
  }) + '\n');
  
  const interval = setInterval(() => {
    if (index < dataObjects.length) {
      // Add a timestamp to each object
      const objectToSend = {
        ...dataObjects[index],
        timestamp: new Date().toISOString()
      };
      
      // Convert to string and send (with newline for ndjson format)
      stream.write(JSON.stringify(objectToSend) + '\n');
      fastify.log.info(`Sent object ${index + 1}/${dataObjects.length}`);
      
      index++;
    } else {
      // Send end marker and complete
      stream.write(JSON.stringify({ 
        type: 'end', 
        totalSent: dataObjects.length,
        endTime: new Date().toISOString() 
      }));
      
      stream.end();
      clearInterval(interval);
      fastify.log.info('Object stream completed');
    }
  }, 800); // Slower to make it more visible
  
  // Handle client disconnect
  request.raw.on('close', () => {
    clearInterval(interval);
    if (!stream.writableEnded) {
      stream.end();
    }
    fastify.log.info('Client closed object stream connection');
  });
});

// File streaming endpoint - streams a file in chunks
fastify.get('/file-stream', (request, reply) => {
  fastify.log.info('File stream requested');
  
  // Create a sample file if it doesn't exist
  const sampleFilePath = path.join(__dirname, 'sample-data.txt');
  
  try {
    // Check if file exists
    if (!fs.existsSync(sampleFilePath)) {
      // Create a sample file with some content
      let fileContent = '# Sample Data File\n\n';
      fileContent += 'This is a sample file created for streaming demonstration.\n\n';
      
      // Add some mock lines
      for (let i = 1; i <= 50; i++) {
        fileContent += `Line ${i}: ${Array(i).fill('*').join('')}\n`;
      }
      
      fs.writeFileSync(sampleFilePath, fileContent);
      fastify.log.info(`Created sample file at ${sampleFilePath}`);
    }
    
    // Set proper headers
    reply.header('Content-Type', 'text/plain');
    reply.header('Cache-Control', 'no-cache');
    
    // Create a readable stream from the file
    const fileStream = fs.createReadStream(sampleFilePath, {
      highWaterMark: 256, // Small buffer to make streaming more visible
      encoding: 'utf8'
    });
    
    // Log when data is read from file
    fileStream.on('data', (chunk) => {
      fastify.log.info(`File stream: sent ${chunk.length} bytes`);
    });
    
    // Log when file is fully read
    fileStream.on('end', () => {
      fastify.log.info('File stream completed');
    });
    
    // Log any errors
    fileStream.on('error', (err) => {
      fastify.log.error(`File stream error: ${err.message}`);
    });
    
    // Send the file stream
    reply.send(fileStream);
    
  } catch (error) {
    fastify.log.error(`File stream error: ${error.message}`);
    reply.code(500).send({ error: `Failed to stream file: ${error.message}` });
  }
});

// Manual streaming endpoint (character by character with anti-buffering)
fastify.get('/manual-stream', async (request, reply) => {
  fastify.log.info('Manual stream requested');
  
  try {
    // Headers to prevent buffering
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'identity'
    });
    
    // Send an initial chunk to force the browser to start rendering
    reply.raw.write('• ');
    fastify.log.info('Sent initial marker for manual stream');
    
    const text = "This is a manually streamed response, sending characters one by one to demonstrate streaming...";
    let index = 0;
    
    const interval = setInterval(() => {
      if (index >= text.length) {
        // Send final newline to flush any remaining buffer
        reply.raw.write('\n');
        clearInterval(interval);
        reply.raw.end();
        fastify.log.info('Manual stream completed');
        return;
      }
      
      // Send the character with a space to increase byte size (helps with buffering)
      reply.raw.write(text[index] + ' ');
      fastify.log.debug(`Sent character: "${text[index]}" (${index+1}/${text.length})`);
      
      // Force flush after each character
      reply.raw.flushHeaders();
      
      index++;
    }, 100); // Increased delay to make streaming more visible
    
    request.raw.on('close', () => {
      clearInterval(interval);
      fastify.log.info('Client closed manual stream connection');
    });
    
    return reply;
  } catch (error) {
    fastify.log.error(`Error in manual stream: ${error.message}`);
    return reply.code(500).send({ error: error.message });
  }
});

// Simpler streaming implementation with anti-buffering techniques
fastify.get('/openai-stream', async (request, reply) => {
  fastify.log.info('OpenAI stream request received');
  
  try {
    // Headers to prevent buffering
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'identity',
      'Transfer-Encoding': 'chunked'
    });
    
    // Send a leading character to force rendering to start
    reply.raw.write('• ');
    fastify.log.info('Sent initial marker for OpenAI stream');
    
    const mockText = "Fastify streaming is a powerful feature that allows servers to send data to clients as it becomes available, rather than waiting for the entire response to be ready. This approach significantly reduces time-to-first-byte, improves perceived performance, and enables real-time updates for applications like chat interfaces or live data feeds.";
    
    // Directly stream character by character with anti-buffering technique
    let index = 0;
    const streamInterval = setInterval(() => {
      if (index >= mockText.length) {
        // Send final newline to flush any buffers
        reply.raw.write('\n');
        clearInterval(streamInterval);
        reply.raw.end();
        fastify.log.info('OpenAI stream completed successfully');
        return;
      }
      
      try {
        // Add padding to each character to make it a larger chunk
        // This helps break through browser buffering
        const char = mockText[index];
        reply.raw.write(char + ' ');
        fastify.log.debug(`Sent character: "${char}" (${index+1}/${mockText.length})`);
        
        // Force flush
        reply.raw.flushHeaders();
        
        index++;
      } catch (err) {
        clearInterval(streamInterval);
        fastify.log.error(`Error writing to stream: ${err.message}`);
        try {
          reply.raw.end();
        } catch (e) {
          fastify.log.error(`Error ending stream: ${e.message}`);
        }
      }
    }, 100); // Increased delay to make streaming more visible
    
    // Clean up if request is aborted
    request.raw.on('close', () => {
      clearInterval(streamInterval);
      fastify.log.info('Client closed connection');
    });
    
    return reply;
  } catch (error) {
    fastify.log.error(`Error in OpenAI stream: ${error.message}`);
    return reply.code(500).send({ error: error.message });
  }
});

// Example of correct external API streaming using pipeline
fastify.get('/api/swapi-stream', async (request, reply) => {
  fastify.log.info('SWAPI stream requested');
  
  try {
    const response = await fetch('https://swapi.dev/api/people/1/');
    
    if (!response.ok) {
      return reply.code(response.status).send({ error: 'Failed to fetch from SWAPI' });
    }
    
    // The proper way to handle streaming in Fastify
    reply.header('Content-Type', 'application/json');
    reply.header('Cache-Control', 'no-cache, no-transform');
    reply.header('X-Accel-Buffering', 'no');
    
    // Create a pass-through stream and pipe the response to it
    const stream = new PassThrough();
    response.body.pipe(stream);
    
    // Send the stream
    reply.send(stream);
    
    // Log completion and errors
    response.body.on('end', () => {
      fastify.log.info('SWAPI stream completed');
    });
    
    response.body.on('error', (err) => {
      fastify.log.error(`SWAPI stream error: ${err.message}`);
      if (!stream.writableEnded) {
        stream.end();
      }
    });
    
    // Handle client disconnect
    request.raw.on('close', () => {
      fastify.log.info('Client closed SWAPI stream connection');
      if (!stream.writableEnded) {
        stream.end();
      }
    });
    
  } catch (error) {
    fastify.log.error(`SWAPI stream error: ${error.message}`);
    if (!reply.sent) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
});

// Demonstration of the correct pipeline approach with anti-buffering
fastify.get('/pipeline-stream', async (request, reply) => {
  fastify.log.info('Pipeline stream requested');
  
  try {
    // Create a readable stream that sends data with deliberate delays
    const stream = new Readable({
      read() {} // No-op, we'll push data manually
    });
    
    // Set headers and send the stream
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-transform');
    reply.header('X-Accel-Buffering', 'no');
    
    // Send the stream immediately
    reply.send(stream);
    
    // Write initial content to start rendering
    stream.push('• Starting pipeline stream...\n');
    
    const mockText = "This is a demonstration of Node.js pipeline streaming. This technique is more advanced but provides better backpressure handling and error management for high-throughput applications.";
    
    // Send data with delays between chunks to demonstrate streaming
    let currentIndex = 0;
    const words = mockText.split(' ');
    
    const interval = setInterval(() => {
      if (currentIndex >= words.length) {
        stream.push('\nStream complete!');
        stream.push(null); // End the stream
        clearInterval(interval);
        fastify.log.info('Pipeline stream completed');
        return;
      }
      
      // Send each word with a space and flush
      stream.push(words[currentIndex] + ' ');
      fastify.log.debug(`Sent word: "${words[currentIndex]}" (${currentIndex+1}/${words.length})`);
      currentIndex++;
    }, 300); // Slower interval for words
    
    // Handle connection close
    request.raw.on('close', () => {
      clearInterval(interval);
      fastify.log.info('Client closed pipeline stream connection');
      if (!stream.readableEnded) {
        stream.push(null);
      }
    });
    
  } catch (error) {
    fastify.log.error(`Pipeline stream error: ${error.message}`);
    if (!reply.sent) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
});

// Add a true OpenAI streaming endpoint
fastify.get('/openai-4o-mini-stream', async (request, reply) => {
  fastify.log.info('OpenAI 4o-mini stream requested');
  
  // Get query parameter for the prompt or use default
  const userPrompt = request.query.prompt || 'Explain streaming data in web applications concisely.';
  
  // Set up streaming headers
  reply.header('Content-Type', 'text/plain; charset=utf-8');
  reply.header('Cache-Control', 'no-cache');
  reply.header('Connection', 'keep-alive');
  reply.header('X-Accel-Buffering', 'no');
  
  // Create a stream to send to the client
  const stream = new PassThrough();
  
  // Send the stream as the response
  reply.send(stream);
  
  try {
    // Check if we have an API key or if we should use mock responses
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here' || USE_MOCK_RESPONSES) {
      fastify.log.warn('Using mock OpenAI response (API key not configured or mock mode enabled)');
      stream.write('Using mock response mode (no API key configured)\n\n');
      
      // Send a mock response character by character
      const mockResponses = {
        'Explain streaming data in web applications concisely.': 
          'Streaming data in web applications allows servers to send data to clients incrementally as it becomes available, rather than waiting for the entire response to be ready. This approach:\n\n1. Reduces time-to-first-byte, improving perceived performance\n2. Enables real-time updates for chat interfaces, notifications, and live data feeds\n3. Uses techniques like Server-Sent Events (SSE), WebSockets, or chunked transfer encoding\n4. Efficiently handles long-running processes or large dataset transfers\n5. Provides better user experience for AI-generated content by showing partial results immediately',
        
        'What are the benefits of streaming responses?':
          'Benefits of streaming responses:\n\n• Improved perceived performance: Users see content starting to appear immediately\n• Better resource utilization: Processing and transfer happen concurrently\n• Enhanced user experience: Provides visual feedback that work is happening\n• Reduced timeout issues: Long-running operations less likely to hit timeouts\n• Lower memory usage: No need to buffer entire responses before sending\n• Real-time capabilities: Enables live updates and continuous data feeds\n• Optimized for modern applications: Particularly valuable for AI-generated content',
        
        'How does HTTP streaming work?':
          'HTTP streaming works through several mechanisms:\n\n1. Chunked Transfer Encoding: The server sends the response in small chunks with their size prefixed, allowing browsers to process each chunk as it arrives\n\n2. Content-Encoding: The server can compress data on-the-fly and send it progressively\n\n3. Implementation methods include:\n   - Traditional response.write() in server frameworks\n   - Server-Sent Events (SSE) for one-way server-to-client streaming\n   - WebSockets for bidirectional streaming\n   - Fetch API with ReadableStream on modern browsers\n\nThe server keeps the connection open and flushes buffers after each chunk to ensure immediate delivery. Properly configured cache-control headers prevent intermediaries from buffering the response.'
      };
      
      // Find the closest matching prompt or use default
      let responseText = mockResponses[userPrompt];
      if (!responseText) {
        // If not an exact match, find the closest one or use first response
        const promptKeys = Object.keys(mockResponses);
        const closestPrompt = promptKeys.find(key => 
          userPrompt.toLowerCase().includes(key.toLowerCase().substring(0, 10))
        ) || promptKeys[0];
        
        responseText = mockResponses[closestPrompt];
      }
      
      // Stream the response character by character with delays
      let index = 0;
      const mockInterval = setInterval(() => {
        if (index >= responseText.length) {
          stream.write('\n\n[Mock Stream Complete]');
          stream.end();
          clearInterval(mockInterval);
          fastify.log.info('Mock OpenAI stream completed');
          return;
        }
        
        // Send one character at a time
        stream.write(responseText[index]);
        index++;
      }, 30); // Faster than real OpenAI for demo purposes
      
      // Handle client disconnect
      request.raw.on('close', () => {
        clearInterval(mockInterval);
        fastify.log.info('Client closed mock OpenAI stream connection');
        if (!stream.writableEnded) {
          stream.end();
        }
      });
      
      return;
    }
    
    // Continue with real OpenAI API request
    fastify.log.info(`Sending request to OpenAI with prompt: "${userPrompt.substring(0, 50)}..."`);
    
    // Write an initial message
    stream.write('Connecting to OpenAI...\n\n');
    
    // Make the request to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Provide concise, informative responses.' },
          { role: 'user', content: userPrompt }
        ],
        stream: true,
        max_tokens: 500
      })
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = errorData.error?.message || `Status code: ${response.status}`;
      
      fastify.log.error(`OpenAI API error: ${errorMessage}`);
      stream.write(`Error from OpenAI API: ${errorMessage}`);
      stream.end();
      return;
    }
    
    // Process the stream from OpenAI
    const reader = response.body;
    
    reader.on('data', (chunk) => {
      // Convert the chunk to text
      const chunkText = chunk.toString();
      
      try {
        // OpenAI sends 'data: ' prefixed JSON objects, split by double newlines
        const lines = chunkText.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          // Skip lines that don't start with 'data: '
          if (!line.startsWith('data: ')) continue;
          
          // Remove the 'data: ' prefix
          const jsonData = line.slice(6);
          
          // Check for the [DONE] marker
          if (jsonData === '[DONE]') {
            fastify.log.info('OpenAI stream complete');
            continue;
          }
          
          // Parse the JSON
          try {
            const data = JSON.parse(jsonData);
            
            // Extract the content if it exists
            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              const content = data.choices[0].delta.content;
              
              // Write the content to our stream
              stream.write(content);
            }
          } catch (jsonErr) {
            fastify.log.warn(`Error parsing JSON from OpenAI: ${jsonErr.message}`);
          }
        }
      } catch (err) {
        fastify.log.error(`Error processing chunk: ${err.message}`);
      }
    });
    
    reader.on('end', () => {
      fastify.log.info('OpenAI response stream ended');
      stream.write('\n\n[OpenAI Stream Complete]');
      stream.end();
    });
    
    reader.on('error', (err) => {
      fastify.log.error(`Error in OpenAI stream: ${err.message}`);
      stream.write(`\n\nError: ${err.message}`);
      stream.end();
    });
    
    // Handle client disconnect
    request.raw.on('close', () => {
      fastify.log.info('Client closed OpenAI stream connection');
      stream.end();
    });
    
  } catch (error) {
    fastify.log.error(`OpenAI stream error: ${error.message}`);
    stream.write(`Error: ${error.message}`);
    stream.end();
  }
});

// Start the server with more robust error handling
const start = async () => {
  try {
    // Listen on all interfaces and enable additional logging
    await fastify.listen({ 
      port: 4000, 
      host: '0.0.0.0',
      backlog: 511
    });
    console.log('Server running on http://localhost:4000');
    console.log('Try these endpoints:');
    console.log('- http://localhost:4000/test (simple test)');
    console.log('- http://localhost:4000/simple-stream (basic streaming)');
    console.log('- http://localhost:4000/object-stream (JSON object streaming)');
    console.log('- http://localhost:4000/file-stream (file streaming)');
    console.log('- http://localhost:4000/openai-stream (character streaming)');
    console.log('- http://localhost:4000/openai-4o-mini-stream (real OpenAI streaming)');
    console.log('- http://localhost:4000/manual-stream (manual streaming)');
    console.log('- http://localhost:4000/pipeline-stream (pipeline streaming)');
  } catch (err) {
    fastify.log.error(`Error starting server: ${err.message}`);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  fastify.close();
  process.exit(0);
});

start();