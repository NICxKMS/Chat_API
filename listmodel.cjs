// Import the dotenv package to load environment variables
require('dotenv').config();
// Node.js < 18 might need a polyfill or use 'node-fetch' package:
// const fetch = require('node-fetch'); // Uncomment if using node-fetch

// Get the API key from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

// Check if the API key is loaded
if (!apiKey) {
  console.error(
    'Error: GOOGLE_API_KEY not found in environment variables.'
  );
  console.error('Please create a .env file with GOOGLE_API_KEY="YOUR_API_KEY"');
  process.exit(1); // Exit the script with an error code
}

// Google Generative Language API endpoint for listing models
// Using v1beta as it's commonly used for Gemini models
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Fetches and lists available Google AI models.
 */
async function listAvailableModels() {
  console.log('Fetching available models from Google AI...');

  try {
    const response = await fetch(`${API_ENDPOINT}?key=${apiKey}`); // Pass key as query param

    // Check if the request was successful
    if (!response.ok) {
      // Try to parse error details from Google's response
      let errorBody = 'Could not parse error body.';
      try {
          errorBody = JSON.stringify(await response.json(), null, 2);
      } catch (parseError) {
          // Ignore if parsing fails, keep the default message
      }
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}\n${errorBody}`
      );
    }

    // Parse the JSON response
    const data = await response.json();

    // Check if the response contains the 'models' array
    if (!data.models || !Array.isArray(data.models)) {
      console.error('Unexpected response format from API:', data);
      throw new Error("API response did not contain a 'models' array.");
    }

    console.log('\n--- Available Google AI Models ---');
    if (data.models.length === 0) {
        console.log("No models found.");
    } else {
        console.log(data);
        // data.models.forEach((model) => {
        //   console.log(`\nModel Name: ${model.name}`);
        //   console.log(`Display Name: ${model.displayName}`);
        //   console.log(`Description: ${model.description}`);
        //   console.log(`Version: ${model.version}`);
        //   console.log(`Supported Generation Methods: ${model.supportedGenerationMethods.join(', ')}`);
        //   // Add other relevant fields if needed (e.g., input/output token limits)
        //   if (model.inputTokenLimit) {
        //     console.log(`Input Token Limit: ${model.inputTokenLimit}`);
        //   }
        //    if (model.outputTokenLimit) {
        //     console.log(`Output Token Limit: ${model.outputTokenLimit}`);
          // }
          console.log('---------------------------------');
    }

  } catch (error) {
    console.error('\n--- Error fetching models ---');
    console.error(error.message);
    // Optionally log the full error stack for debugging
    // console.error(error);
    process.exit(1); // Exit on error
  }
}

// Run the function
listAvailableModels();