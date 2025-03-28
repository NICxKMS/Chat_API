/**
 * Load Testing Script for Chat API
 * Uses autocannon for HTTP benchmarking
 */
const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

// Default test configuration
const defaultConfig = {
  url: 'http://localhost:3000',
  connections: 10,
  duration: 10,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Test cases
const tests = [
  {
    name: 'Root Endpoint',
    method: 'GET',
    path: '/'
  },
  {
    name: 'Get Models API',
    method: 'GET',
    path: '/models'
  },
  {
    name: 'Get Chat Capabilities API',
    method: 'GET',
    path: '/chat/capabilities'
  },
  {
    name: 'Chat Completion API - Small',
    method: 'POST',
    path: '/chat/completions',
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
      temperature: 0.7,
      max_tokens: 150
    })
  },
  {
    name: 'Chat Completion API - Medium',
    method: 'POST',
    path: '/chat/completions',
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Explain the concept of API performance optimization in 2-3 sentences.' }
      ],
      temperature: 0.7,
      max_tokens: 300
    })
  }
];

// Run tests sequentially
async function runTests() {
  console.log('Starting load tests for Chat API...');
  console.log(`Target: ${defaultConfig.url}`);
  console.log(`Connections: ${defaultConfig.connections}, Duration: ${defaultConfig.duration}s`);
  console.log('=====================================================');
  
  const results = {};
  
  for (const test of tests) {
    console.log(`Running test: ${test.name}`);
    
    const config = {
      ...defaultConfig,
      title: test.name,
      method: test.method,
      url: `${defaultConfig.url}${test.path}`,
      headers: {
        ...defaultConfig.headers
      }
    };
    
    if (test.body) {
      config.body = test.body;
    }
    
    try {
      const result = await autocannon(config);
      results[test.name] = result;
      
      console.log(`Test completed: ${test.name}`);
      console.log(`Latency: ${result.latency.average}ms average, ${result.latency.p99}ms p99`);
      console.log(`Requests/sec: ${result.requests.average}`);
      console.log('-----------------------------------');
    } catch (error) {
      console.error(`Error in test ${test.name}:`, error);
      results[test.name] = { error: error.message };
    }
  }
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = path.join(__dirname, '../test-results');
  
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(resultsDir, `load-test-${timestamp}.json`),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`Results saved to test-results/load-test-${timestamp}.json`);
  
  // Generate performance report
  generateReport(results, timestamp);
}

function generateReport(results, timestamp) {
  // Create a simple HTML report
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chat API Performance Report - ${timestamp}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary { margin: 20px 0; padding: 15px; background-color: #f8f8f8; border-left: 4px solid #4CAF50; }
        .error { color: red; }
      </style>
    </head>
    <body>
      <h1>Chat API Performance Report</h1>
      <div class="summary">
        <p><strong>Date:</strong> ${new Date(timestamp.replace(/[-]/g, ':')).toLocaleString()}</p>
        <p><strong>Test Duration:</strong> ${defaultConfig.duration} seconds</p>
        <p><strong>Connections:</strong> ${defaultConfig.connections}</p>
      </div>
      
      <h2>Results Summary</h2>
      <table>
        <tr>
          <th>Test</th>
          <th>Method</th>
          <th>Path</th>
          <th>Avg. Latency (ms)</th>
          <th>P99 Latency (ms)</th>
          <th>Requests/sec</th>
          <th>Errors</th>
        </tr>
  `;
  
  // Add each test result
  for (const test of tests) {
    const result = results[test.name];
    
    if (result.error) {
      html += `
        <tr>
          <td>${test.name}</td>
          <td>${test.method}</td>
          <td>${test.path}</td>
          <td colspan="3" class="error">Error: ${result.error}</td>
        </tr>
      `;
    } else {
      html += `
        <tr>
          <td>${test.name}</td>
          <td>${test.method}</td>
          <td>${test.path}</td>
          <td>${result.latency.average}</td>
          <td>${result.latency.p99}</td>
          <td>${result.requests.average}</td>
          <td>${result.errors || 0}</td>
        </tr>
      `;
    }
  }
  
  html += `
      </table>
      
      <h2>Recommendations</h2>
      <ul>
        <li>API endpoints with latencies above 100ms should be reviewed for optimization opportunities</li>
        <li>Consider adding caching for GET endpoints with high latency</li>
        <li>Monitor the number of errors and investigate any non-zero values</li>
        <li>For endpoints with high P99 values, check for potential memory leaks or garbage collection issues</li>
      </ul>
    </body>
    </html>
  `;
  
  // Save the HTML report
  fs.writeFileSync(
    path.join(path.join(__dirname, '../test-results'), `report-${timestamp}.html`),
    html
  );
  
  console.log(`Performance report generated: test-results/report-${timestamp}.html`);
}

// Run tests when script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
} else {
  // Export for programmatic usage
  module.exports = { runTests };
}