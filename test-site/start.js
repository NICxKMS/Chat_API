/**
 * Test Site Startup Script
 * Checks the API connection before starting the server
 */
const http = require('http');
const { exec } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_TEST_ENDPOINT = '/api/health';
const MAX_RETRIES = 3;
let retries = 0;

console.log(`Starting test site with API connection to: ${API_URL}`);
console.log('Checking API connection...');

function checkApiConnection() {
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

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ API connection successful!');
      startServer();
    } else {
      console.warn(`❌ API returned status code: ${res.statusCode}`);
      handleRetry();
    }
  });

  req.on('error', (error) => {
    console.error(`❌ API connection error: ${error.message}`);
    handleRetry();
  });

  req.on('timeout', () => {
    console.error('❌ API connection timeout');
    req.destroy();
    handleRetry();
  });

  req.end();
}

function handleRetry() {
  if (retries < MAX_RETRIES) {
    retries++;
    console.log(`Retrying API connection (${retries}/${MAX_RETRIES})...`);
    setTimeout(checkApiConnection, 2000);
  } else {
    console.warn(`
⚠️ Could not connect to API after ${MAX_RETRIES} attempts.
   Starting the test site anyway with fallback data.
   The /api/models/classified endpoint might return 500 errors.
   This is expected and the client will fallback to hardcoded model data.
`);
    startServer();
  }
}

function startServer() {
  console.log('Starting test site server...');
  
  const server = exec('node server.js', { cwd: __dirname });
  
  server.stdout.on('data', (data) => {
    console.log(data.toString().trim());
  });
  
  server.stderr.on('data', (data) => {
    console.error(data.toString().trim());
  });
  
  server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

// Start by checking API connection
checkApiConnection(); 