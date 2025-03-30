# Model Categorizer Test Tools

This directory contains tools to test the Model Categorizer microservice.

## Contents

- `index.html` - A web interface for testing all endpoints of the service
- `server.js` - A simple Node.js server to serve the test interface and proxy requests

## Usage

1. Make sure the Model Categorizer microservice is running on port 8080:
   ```
   cd ..
   go run main.go
   ```

2. In a separate terminal, start the test server:
   ```
   # If you have Node.js installed
   node server.js

   # Or navigate to the HTML file directly in your browser
   # by opening test/index.html in your file explorer
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Testing Endpoints

The test interface provides three tabs to test different functionality:

1. **Health Check** - Tests the `/health` endpoint to verify that the service is running correctly
2. **Models List** - Tests the `/models` endpoint to fetch all categorized models
3. **Dynamic Provider** - Tests the `/dynamic` endpoint to fetch models using your own API keys

### Dynamic Provider Testing

To test with your own API key:

1. Select a provider (OpenAI, Anthropic, Gemini, or OpenRouter)
2. Enter your API key
3. (Optional) Enter a custom base URL if using a proxy
4. Select the output format:
   - Raw: Unprocessed response from the provider
   - Structured: Organized by provider and model ID
   - Categorized: Organized by provider, family, and type
5. Click "Test Dynamic Provider"

## How the Test Server Works

The test server in `server.js` serves as both a static file server for the test interface and a proxy to the Model Categorizer microservice:

1. It serves the `index.html` test interface
2. It proxies API requests to the microservice running at http://localhost:8080
3. It handles CORS issues automatically

This architecture allows you to test the API endpoints without having to worry about cross-origin issues.

## Notes

- The server automatically proxies `/health`, `/models`, and `/dynamic` requests to the microservice
- CORS headers are automatically added to responses
- Error handling is included to provide meaningful feedback when something goes wrong 