/**
 * Debug Streaming Tool
 * This script provides a raw debugging console for streaming from any configured provider
 * 
 * Usage: node scripts/debug-streaming.js [provider] [model] "prompt"
 * Example: node scripts/debug-streaming.js gemini gemini-1.5-flash "Write a short poem"
 */
require('dotenv').config();
const providerFactory = require('../src/providers/ProviderFactory');

// Process command line arguments
const providerName = process.argv[2] || 'gemini';
const modelName = process.argv[3]; // Optional - will use default if not provided
const promptText = process.argv[4] || 'Hello, please respond with a detailed answer of at least 10 tokens.';

async function debugStreaming() {
  try {
    // Get the provider
    const provider = providerFactory.getProvider(providerName);
    if (!provider) {
      console.error(`Provider '${providerName}' not configured or not found`);
      console.log('Available providers:', providerFactory.getProviderNames().join(', '));
      return;
    }
    
    // Get the model to test
    const modelToTest = modelName || provider.config.defaultModel;
    
    console.log('==========================================');
    console.log('STREAMING DEBUG CONSOLE');
    console.log('==========================================');
    console.log(`Provider: ${provider.name}`);
    console.log(`Model: ${modelToTest}`);
    console.log(`Prompt: "${promptText}"`);
    console.log('==========================================');
    
    // Set up streaming test
    const messages = [
      { role: 'user', content: promptText }
    ];
    
    // Records and stats
    let tokenCount = 0;
    let rawOutput = '';
    let startTime = Date.now();
    let lastTokenTime = startTime;
    
    // Create callback for streaming
    const onChunk = (chunk) => {
      const now = Date.now();
      const elapsedFromStart = now - startTime;
      const elapsedFromLast = now - lastTokenTime;
      lastTokenTime = now;
      
      tokenCount++;
      rawOutput += chunk.content;
      
      // Output token debug info
      console.log(`\n--- TOKEN #${tokenCount} (${elapsedFromStart}ms, +${elapsedFromLast}ms) ---`);
      
      // Content info
      if (chunk.content === '') {
        console.log(`Content: [EMPTY STRING] (finish_reason: ${chunk.finishReason || 'null'})`);
      } else {
        console.log(`Content (${chunk.content.length} chars): "${chunk.content}"`);
        
        // Character analysis for debugging
        const charCodes = [];
        for (let i = 0; i < chunk.content.length; i++) {
          const char = chunk.content[i];
          const code = chunk.content.charCodeAt(i);
          charCodes.push(`${char}:${code}`);
        }
        console.log('Character analysis:', charCodes.join(', '));
        
        // Hex representation for whitespace debugging
        let hexOutput = '';
        for (let i = 0; i < chunk.content.length; i++) {
          const charCode = chunk.content.charCodeAt(i);
          hexOutput += '\\x' + charCode.toString(16).padStart(2, '0');
        }
        console.log(`Hex: ${hexOutput}`);
      }
      
      // Metadata
      console.log(`Role: ${chunk.role}`);
      console.log(`Finish reason: ${chunk.finishReason || 'null'}`);
      console.log(`ID: ${chunk.id}`);
      
      // Is this a final token?
      if (chunk.finishReason) {
        console.log('\n==========================================');
        console.log('STREAMING COMPLETE');
        console.log('==========================================');
        console.log(`Total tokens received: ${tokenCount}`);
        console.log(`Total time: ${elapsedFromStart}ms`);
        console.log(`Average time per token: ${Math.round(elapsedFromStart / tokenCount)}ms`);
        console.log('==========================================');
        console.log('FULL OUTPUT:');
        console.log('==========================================');
        console.log(rawOutput);
        console.log('==========================================');
      }
    };
    
    console.log('\nStarting stream...\n');
    
    // Run the stream
    await provider.streamChatCompletion({
      model: modelToTest,
      messages,
      temperature: 0.2, // Low temperature for more predictable results
      max_tokens: 200   // Reasonable length for debugging
    }, onChunk);
    
  } catch (error) {
    console.error('\nSTREAMING ERROR:', error);
  }
}

// Run the debug tool
debugStreaming().catch(error => {
  console.error('Debug script error:', error);
  process.exit(1);
}); 