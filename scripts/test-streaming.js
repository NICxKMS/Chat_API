/**
 * Test streaming functionality for all providers
 * This script tests streaming functionality for each configured provider
 */
require('dotenv').config();
const express = require('express');
const providerFactory = require('../src/providers/ProviderFactory');

// Check if a specific provider is requested from command line
const requestedProvider = process.argv[2];

async function runStreamingTests() {
  console.log('Testing streaming functionality for all providers...\n');
  
  // Get all available providers
  const providers = providerFactory.getAllProviders();
  
  if (providers.length === 0) {
    console.error('No providers configured. Please check your .env file.');
    return;
  }
  
  // Filter providers if specific one is requested
  const testsToRun = requestedProvider 
    ? providers.filter(p => p.name === requestedProvider) 
    : providers;
  
  if (testsToRun.length === 0) {
    console.error(`Provider "${requestedProvider}" not found or not configured.`);
    console.log('Available providers:', providers.map(p => p.name).join(', '));
    return;
  }
  
  // Test each provider
  for (const provider of testsToRun) {
    await testProvider(provider);
  }
  
  console.log('\nAll streaming tests completed!');
}

async function testProvider(provider) {
  console.log(`\n----- Testing ${provider.name} Provider -----`);
  
  try {
    // Get available models
    const models = await provider.getModels();
    if (!models || models.length === 0) {
      console.log(`❌ No models available for ${provider.name}`);
      return;
    }
    
    // Use the default model for testing
    const modelToTest = provider.config.defaultModel;
    console.log(`Using model: ${modelToTest}`);
    
    // Create a test message
    const messages = [
      { role: 'system', content: 'You are a helpful assistant. Keep responses very short for this test.' },
      { role: 'user', content: 'Generate a list of 5 random words, one per line.' }
    ];
    
    console.log('Starting streaming test...');
    
    // Collect all tokens to verify completeness
    let collectedContent = '';
    let streamFinished = false;
    let tokenCount = 0;
    
    // Create a callback for streaming
    const onChunk = (chunk) => {
      // Add to collected content
      collectedContent += chunk.content;
      tokenCount++;
      
      // Display token information
      process.stdout.write(`\rReceived ${tokenCount} chunks: "${chunk.content.replace(/\n/g, '\\n')}"${' '.repeat(20)}`);
      
      // Check if this is the end
      if (chunk.finishReason) {
        streamFinished = true;
        console.log(`\n✅ Stream completed with reason: ${chunk.finishReason}`);
      }
    };
    
    // Run streaming request
    try {
      const options = {
        model: modelToTest,
        messages,
        temperature: 0.7,
        max_tokens: 200
      };
      
      // Set a timeout to detect stalled streams
      const timeoutId = setTimeout(() => {
        if (!streamFinished) {
          console.log('\n⚠️ Streaming test timed out after 30 seconds');
        }
      }, 30000);
      
      // Start streaming
      await provider.streamChatCompletion(options, onChunk);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Verify stream completed
      if (!streamFinished) {
        console.log('\n❌ Stream ended without finish reason');
      }
      
      console.log(`\nFinal content (${collectedContent.length} characters):`);
      console.log('-'.repeat(50));
      console.log(collectedContent);
      console.log('-'.repeat(50));
      
    } catch (error) {
      console.log(`\n❌ Streaming error: ${error.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

// Run the tests
runStreamingTests().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
}); 