/**
 * Combined Test Script for Model Categorizer
 * 
 * This script provides:
 * 1. A test server (runs on port 3000)
 * 2. Direct testing of endpoints
 * 3. Command-line interface for testing
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const PORT = 3000;
const MODEL_SERVICE_URL = 'http://localhost:8080';
const TEST_API_KEY = "test_key_for_debugging";

// ==========================================================
// Test Server Implementation
// ==========================================================

function startServer() {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    console.log(`Received request: ${req.method} ${req.url}`);
    
    // Serve static HTML files
    if (req.url === '/' || req.url === '/index.html') {
      serveFile(res, 'index.html', 'text/html');
      return;
    }
    
    if (req.url === '/test' || req.url === '/test-browser.html') {
      serveFile(res, 'test-browser.html', 'text/html');
      return;
    }
    
    // Proxy requests to the Go microservice
    if (req.url === '/health' || req.url === '/models' || req.url === '/dynamic') {
      proxyRequest(req, res);
      return;
    }
    
    // Handle 404
    res.writeHead(404);
    res.end('404 Not Found');
  });

  server.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
    console.log(`Proxying requests to the model-categorizer service at ${MODEL_SERVICE_URL}`);
  });
  
  return server;
}

function serveFile(res, filename, contentType) {
  const filePath = path.join(__dirname, filename);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end(`Error loading ${filename}: ${err.message}`);
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
}

function proxyRequest(req, res) {
  const targetUrl = `${MODEL_SERVICE_URL}${req.url}`;
  console.log(`Proxying request to: ${targetUrl}`);
  
  const isHttps = targetUrl.startsWith('https');
  const httpModule = isHttps ? https : http;
  const parsedUrl = new URL(targetUrl);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  // Handle body data for POST requests
  if (req.method === 'POST') {
    let body = [];
    req.on('data', chunk => {
      body.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(body).toString();
      console.log(`Request body: ${body}`);
      
      const proxyReq = httpModule.request(options, proxyRes => {
        console.log(`Response status: ${proxyRes.statusCode}`);
        
        // Set headers from proxy response
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        
        let responseData = '';
        proxyRes.on('data', chunk => {
          responseData += chunk;
        });
        
        proxyRes.on('end', () => {
          console.log(`Response body: ${responseData}`);
          res.end(responseData);
        });
      });
      
      proxyReq.on('error', e => {
        console.error(`Problem with proxy request: ${e.message}`);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          status: 'error', 
          message: `Proxy error: ${e.message}` 
        }));
      });
      
      // Set request headers
      if (req.headers['content-type']) {
        proxyReq.setHeader('Content-Type', req.headers['content-type']);
      }
      
      if (req.headers['content-length']) {
        proxyReq.setHeader('Content-Length', body.length);
      }
      
      console.log('Writing request body to proxy request');
      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    // For GET requests
    httpModule.get(options, proxyRes => {
      console.log(`Response status: ${proxyRes.statusCode}`);
      
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      let responseData = '';
      proxyRes.on('data', chunk => {
        responseData += chunk;
      });
      
      proxyRes.on('end', () => {
        console.log(`Response body: ${responseData}`);
        res.end(responseData);
      });
    }).on('error', e => {
      console.error(`Problem with proxy request: ${e.message}`);
      res.writeHead(500);
      res.end(JSON.stringify({ 
        status: 'error', 
        message: `Proxy error: ${e.message}` 
      }));
    });
  }
}

// ==========================================================
// Direct Testing Functions
// ==========================================================

function testHealthEndpoint() {
  console.log("Testing health endpoint...");
  
  http.get(`${MODEL_SERVICE_URL}/health`, (res) => {
    console.log(`Health endpoint status: ${res.statusCode}`);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonResponse = JSON.parse(data);
        console.log('Health response:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
        console.error('Error parsing JSON:', e.message);
      }
    });
  }).on('error', (e) => {
    console.error(`Error testing health endpoint: ${e.message}`);
  });
}

function testModelsEndpoint() {
  console.log("Testing models endpoint...");
  
  http.get(`${MODEL_SERVICE_URL}/models`, (res) => {
    console.log(`Models endpoint status: ${res.statusCode}`);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonResponse = JSON.parse(data);
        console.log('Models response status:', jsonResponse.status);
        console.log('Total models:', jsonResponse.total_count);
        console.log('First few models:', JSON.stringify(Object.keys(jsonResponse.models).slice(0, 3), null, 2));
      } catch (e) {
        console.log('Raw response:', data);
        console.error('Error parsing JSON:', e.message);
      }
    });
  }).on('error', (e) => {
    console.error(`Error testing models endpoint: ${e.message}`);
  });
}

function testDynamicEndpoint(provider = 'openai') {
  console.log(`Testing dynamic endpoint with ${provider} provider...`);
  
  // Create request body
  const requestBody = {
    providers: {
      [provider]: {
        api_key: TEST_API_KEY
      }
    },
    query_options: {
      output_format: "raw",
      timeout: 5
    }
  };
  
  // Target API endpoint
  const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/dynamic',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  console.log("Request body:", JSON.stringify(requestBody, null, 2));
  
  // Create the request
  const req = http.request(options, (res) => {
    console.log(`Dynamic endpoint status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    
    // Collect data chunks
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    // Process the complete response
    res.on('end', () => {
      console.log('Response received');
      try {
        const jsonResponse = JSON.parse(data);
        console.log('Response data:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
        console.error('Error parsing JSON:', e.message);
      }
    });
  });
  
  // Handle request errors
  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });
  
  // Send the request body
  const bodyString = JSON.stringify(requestBody);
  req.write(bodyString);
  req.end();
  
  console.log("Request sent, waiting for response...");
}

// ==========================================================
// Proxy Testing Functions
// ==========================================================

function testProxyDynamic(provider = 'openai') {
  console.log(`Testing dynamic endpoint through proxy with ${provider} provider...`);
  
  // Create request body
  const requestBody = {
    providers: {
      [provider]: {
        api_key: TEST_API_KEY
      }
    },
    query_options: {
      output_format: "raw",
      timeout: 5
    }
  };
  
  // Target API endpoint via proxy
  const options = {
    hostname: 'localhost',
    port: 3000, // Proxy server port
    path: '/dynamic',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  console.log("Request body:", JSON.stringify(requestBody, null, 2));
  
  // Create the request
  const req = http.request(options, (res) => {
    console.log(`Proxy dynamic endpoint status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    
    // Collect data chunks
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    // Process the complete response
    res.on('end', () => {
      console.log('Response received');
      try {
        const jsonResponse = JSON.parse(data);
        console.log('Response data:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
        console.error('Error parsing JSON:', e.message);
      }
    });
  });
  
  // Handle request errors
  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });
  
  // Send the request body
  const bodyString = JSON.stringify(requestBody);
  req.write(bodyString);
  req.end();
  
  console.log("Request sent, waiting for response...");
}

// ==========================================================
// Command Line Interface
// ==========================================================

function showHelp() {
  console.log(`
Model Categorizer Test Script
=============================

Usage:
  node combined-test.js [command]

Commands:
  server        Start the test server on port 3000
  health        Test the health endpoint
  models        Test the models endpoint
  dynamic       Test the dynamic endpoint directly
  proxy         Test the dynamic endpoint via proxy
  all           Run all tests
  help          Show this help message

Examples:
  node combined-test.js server
  node combined-test.js dynamic openai
  node combined-test.js all
  `);
}

// ==========================================================
// Main Function
// ==========================================================

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const param = args[1] || 'openai';
  
  switch (command) {
    case 'server':
      startServer();
      break;
      
    case 'health':
      testHealthEndpoint();
      break;
      
    case 'models':
      testModelsEndpoint();
      break;
      
    case 'dynamic':
      testDynamicEndpoint(param);
      break;
      
    case 'proxy':
      // Start server first
      const server = startServer();
      // Wait a bit before making the request
      setTimeout(() => {
        testProxyDynamic(param);
        // Keep server running to receive response
      }, 1000);
      break;
      
    case 'all':
      console.log("Running all tests...");
      testHealthEndpoint();
      setTimeout(() => testModelsEndpoint(), 1000);
      setTimeout(() => testDynamicEndpoint(param), 2000);
      break;
      
    case 'help':
    default:
      showHelp();
      break;
  }
}

// Run the main function
main(); 