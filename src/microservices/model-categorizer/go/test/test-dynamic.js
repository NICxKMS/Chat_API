const http = require('http');

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

// Create request body
const requestBody = {
  providers: {
    openai: {
      api_key: "test_key_for_debugging" // This is a test key that won't work but should trigger the endpoint
    }
  },
  query_options: {
    output_format: "raw",
    timeout: 5 // Short timeout for testing
  }
};

console.log("Sending test request to dynamic endpoint...");

// Create the request
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  // Collect data chunks
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // Process the complete response
  res.on('end', () => {
    console.log('Response received. Status code:', res.statusCode);
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
console.log('Request body:', bodyString);
req.write(bodyString);
req.end();

console.log("Request sent. Waiting for response..."); 