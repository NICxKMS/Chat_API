/**
 * Test Site Startup Script
 */
const express = require('express');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const dotenv = require('dotenv');
const net = require('net');
const path = require('path');

// Load environment variables
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_TEST_ENDPOINT = '/api/health';
const MAX_RETRIES = 3;
const DEFAULT_PORT = process.env.PORT || 3001;
let retries = 0;
let serverStarted = false;
let currentRequest = null;
let retryTimeout = null;

console.log(`Starting test site with API connection to: ${API_URL}`);
console.log('Checking API connection...');

// function checkApiConnection() {
  // Skip if server already started
  if (serverStarted) return;
  
  // Extract host and port from API URL
  const url = new URL(API_URL);
  const host = url.hostname;
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const path = `${API_TEST_ENDPOINT}`;

  const options = {
    hostname: host,
    port: port,
    path: path,
    method: 'GET',
    timeout: 3000
  };

  // Cancel any existing request
  if (currentRequest) {
    currentRequest.destroy();
    currentRequest = null;
  }

  currentRequest = http.request(options, (res) => {
    if (serverStarted) return;
    
    if (res.statusCode === 200) {
      console.log('✅ API connection successful!');
      currentRequest = null;
      checkPortAvailability(DEFAULT_PORT);
    } else {
      console.warn(`❌ API returned status code: ${res.statusCode}`);
      currentRequest = null;
      handleRetry();
    }
  });

  currentRequest.on('error', (error) => {
    if (serverStarted) return;
    
    console.error(`❌ API connection error: ${error.message}`);
    currentRequest = null;
    handleRetry();
  });

  currentRequest.on('timeout', () => {
    if (serverStarted) {
      if (currentRequest) {
        currentRequest.destroy();
        currentRequest = null;
      }
      return;
    }
    
    console.error('❌ API connection timeout');
    if (currentRequest) {
      currentRequest.destroy();
      currentRequest = null;
    }
    handleRetry();
  });

  currentRequest.end();
// }

// function handleRetry() {
  // Skip if server already started
  if (serverStarted) return;
  
  if (retries < MAX_RETRIES) {
    retries++;
    console.log(`Retrying API connection (${retries}/${MAX_RETRIES})...`);
    
    // Clear any existing timeout
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    
    retryTimeout = setTimeout(checkApiConnection, 2000);
  } else {
    console.warn(`
⚠️ Could not connect to API after ${MAX_RETRIES} attempts.
   Starting the test site anyway with fallback data.
   The /api/models/classified endpoint might return 500 errors.
   This is expected and the client will fallback to hardcoded model data.
`);
    checkPortAvailability(DEFAULT_PORT);
  }
// }

function cleanupPendingRequests() {
  // Clean up any pending HTTP requests
  if (currentRequest) {
    currentRequest.destroy();
    currentRequest = null;
  }
  
  // Clean up any pending timeouts
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
}

function checkPortAvailability(port) {
  // Skip if server already started
  if (serverStarted) return;
  
  const tester = net.createServer()
    .once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${port} is already in use.`);
        // Try to find an available port
        findAvailablePort(port + 1);
      } else {
        console.error(`Error checking port availability: ${err.message}`);
        process.exit(1);
      }
    })
    .once('listening', () => {
      tester.close();
      console.log(`✅ Port ${port} is available.`);
      startServer(port);
    })
    .listen(port);
}

function findAvailablePort(startPort) {
  // Skip if server already started
  if (serverStarted) return;
  
  const tester = net.createServer();
  
  tester.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${startPort} is in use, trying ${startPort + 1}`);
      findAvailablePort(startPort + 1);
    } else {
      console.error(`Error finding available port: ${err.message}`);
      process.exit(1);
    }
  });
  
  tester.once('listening', () => {
    const port = tester.address().port;
    tester.close();
    console.log(`✅ Found available port: ${port}`);
    startServer(port);
  });
  
  tester.listen(startPort);
}

function startServer(port) {
  // Skip if server already started
  if (serverStarted) return;
  
  // Mark server as started to prevent multiple instances
  serverStarted = true;
  
  // Clean up any pending requests
  cleanupPendingRequests();
  
  console.log('Starting test site server...');
  
  const app = express();
  
  // Enable CORS
  app.use(cors());
  
  // Serve static files from the public directory
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Set up API proxy
  console.log(`Proxying API requests to: ${API_URL}`);
  app.use('/api', createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api'
    },
    logLevel: 'warn'
  }));
  
  // Serve index.html for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  
  // Start server
  app.listen(port, () => {
    console.log(`Test site running on port ${port}`);
    console.log(`Open http://localhost:${port} in your browser to test the Chat API`);
    console.log(`API proxy target: ${API_URL}`);
  });
}

// Start by checking API connection
// checkApiConnection(); 