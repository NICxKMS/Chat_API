/**
 * Compare Streaming Across Providers
 * This script compares streaming performance across all configured providers
 * using the same prompt and parameters.
 * 
 * Usage: node scripts/compare-streaming.js "prompt"
 * Example: node scripts/compare-streaming.js "List the first 5 prime numbers"
 */
require('dotenv').config();
const providerFactory = require('../src/providers/ProviderFactory');

// Process command line arguments
const promptText = process.argv[2] || 'Write exactly 50 characters, no more, no less.';

async function compareProviders() {
  try {
    // Get all available providers
    const providers = providerFactory.getAllProviders();
    
    if (providers.length === 0) {
      console.error('No providers configured. Check your .env file.');
      return;
    }
    
    console.log('==========================================');
    console.log('STREAMING COMPARISON ACROSS PROVIDERS');
    console.log('==========================================');
    console.log(`Providers: ${providers.map(p => p.name).join(', ')}`);
    console.log(`Prompt: "${promptText}"`);
    console.log('==========================================');
    
    // Results collection
    const results = {};
    
    // Run each provider in sequence
    for (const provider of providers) {
      console.log(`\n\n-> TESTING ${provider.name.toUpperCase()} <-`);
      console.log('-'.repeat(40));
      
      // Get default model
      const modelToTest = provider.config.defaultModel;
      console.log(`Using model: ${modelToTest}`);
      
      // Set up streaming test
      const messages = [
        { role: 'system', content: 'You are a test assistant. Be concise and direct.' },
        { role: 'user', content: promptText }
      ];
      
      // Records and stats
      let tokenCount = 0;
      let rawOutput = '';
      let startTime = Date.now();
      let firstTokenTime = null;
      let tokenTimes = [];
      let finished = false;
      
      // Create callback for streaming
      const onChunk = (chunk) => {
        const now = Date.now();
        const elapsedFromStart = now - startTime;
        
        if (tokenCount === 0) {
          firstTokenTime = elapsedFromStart;
        }
        
        tokenCount++;
        rawOutput += chunk.content;
        tokenTimes.push({
          number: tokenCount,
          time: elapsedFromStart,
          content: chunk.content,
          length: chunk.content.length
        });
        
        // Output token debug info
        const contentPreview = chunk.content.replace(/\n/g, '\\n').substring(0, 30);
        console.log(`Token #${tokenCount} (${elapsedFromStart}ms): "${contentPreview}${chunk.content.length > 30 ? '...' : ''}"`);
        
        // Is this a final token?
        if (chunk.finishReason) {
          finished = true;
          const totalTime = Date.now() - startTime;
          console.log(`\nFinished: ${chunk.finishReason} (${totalTime}ms)`);
        }
      };
      
      console.log('\nStarting stream...\n');
      
      try {
        // Run the stream
        const streamStart = Date.now();
        await provider.streamChatCompletion({
          model: modelToTest,
          messages,
          temperature: 0.2, // Low temperature for more predictable results
          max_tokens: 200   // Reasonable length for testing
        }, onChunk);
        const streamEnd = Date.now();
        
        // Collect results
        results[provider.name] = {
          model: modelToTest,
          tokenCount,
          firstTokenLatency: firstTokenTime,
          totalTime: streamEnd - streamStart,
          avgTimePerToken: tokenCount > 0 ? Math.round((streamEnd - streamStart) / tokenCount) : 0,
          output: rawOutput,
          completed: finished,
          tokenTimingSummary: tokenTimes.map(t => ({
            number: t.number,
            time: t.time,
            length: t.length
          }))
        };
        
        // Show summary
        console.log('\nSummary:');
        console.log(`- First token: ${firstTokenTime}ms`);
        console.log(`- Total tokens: ${tokenCount}`);
        console.log(`- Total time: ${streamEnd - streamStart}ms`);
        console.log(`- Average time per token: ${results[provider.name].avgTimePerToken}ms`);
        
      } catch (error) {
        console.error(`\nError testing ${provider.name}: ${error.message}`);
        results[provider.name] = {
          error: error.message,
          completed: false
        };
      }
    }
    
    // Print comparison table
    console.log('\n\n==========================================');
    console.log('STREAMING COMPARISON RESULTS');
    console.log('==========================================');
    console.log('Provider     | Model             | Tokens | 1st Token | Avg Token | Total Time');
    console.log('-------------|-------------------|--------|-----------|-----------|----------');
    
    Object.entries(results).forEach(([name, data]) => {
      if (data.completed) {
        const formattedName = name.padEnd(12, ' ');
        const formattedModel = (data.model || 'N/A').padEnd(18, ' ');
        const formattedTokens = (data.tokenCount?.toString() || 'N/A').padEnd(7, ' ');
        const formattedFirstToken = (data.firstTokenLatency?.toString() + 'ms' || 'N/A').padEnd(10, ' ');
        const formattedAvgToken = (data.avgTimePerToken?.toString() + 'ms' || 'N/A').padEnd(10, ' ');
        const formattedTotalTime = (data.totalTime?.toString() + 'ms' || 'N/A');
        
        console.log(`${formattedName}| ${formattedModel}| ${formattedTokens}| ${formattedFirstToken}| ${formattedAvgToken}| ${formattedTotalTime}`);
      } else {
        const formattedName = name.padEnd(12, ' ');
        console.log(`${formattedName}| ERROR: ${data.error || 'Unknown error'}`);
      }
    });
    
    console.log('==========================================');
    
  } catch (error) {
    console.error('Comparison script error:', error);
  }
}

// Run the comparison
compareProviders().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
}); 