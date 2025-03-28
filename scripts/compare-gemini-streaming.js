/**
 * Gemini Streaming Performance Comparison
 * 
 * This script compares the Gemini proxy streaming approach with other providers,
 * focusing on token delivery reliability, timing, and content integrity.
 */
require('dotenv').config();
const providerFactory = require('../src/providers/ProviderFactory');

// Enable debug logging for Gemini
process.env.DEBUG_GEMINI_STREAM = 'true';

// Helper for text formatting
const formatText = {
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`
};

async function compareGeminiStreaming() {
  console.log(formatText.blue(formatText.bold('\n===== GEMINI STREAMING COMPARISON =====\n')));

  // Manually list available providers
  const availableProviders = ['openai', 'anthropic', 'gemini', 'openrouter'];
  console.log(`Testing ${availableProviders.length} provider(s): ${availableProviders.join(', ')}\n`);

  // Test prompt designed to check token dropping issues
  const testPrompt = "Please start your response with 'Certainly, the quick brown fox jumps over the lazy dog.' Then write a couple more sentences about foxes.";
  
  // Set up messages for the API call
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' },
    { role: 'user', content: testPrompt }
  ];

  // Results collection for comparison
  const results = [];

  // Run tests on each provider
  for (const providerName of availableProviders) {
    try {
      console.log(formatText.yellow(`\n===== Testing ${providerName} Provider =====`));
      
      // Get provider instance
      const provider = providerFactory.getProvider(providerName);
      if (!provider) {
        console.error(`Provider ${providerName} not configured correctly.`);
        continue;
      }

      // Skip providers that don't support streaming
      if (!provider.supportsStreaming) {
        console.log(formatText.red(`${providerName} does not support streaming, skipping...`));
        continue;
      }

      // Get the default model
      const model = provider.config.defaultModel;
      console.log(`Using model: ${model}`);

      // Collection for this provider's test
      const providerResult = {
        provider: providerName,
        model,
        tokens: [],
        firstTokenTime: null,
        totalTime: null,
        totalTokens: 0,
        fullText: '',
        hasQuickBrownFox: false,
        firstTokenIntegrity: false,
        certainlyCheck: false,
        startTime: Date.now()
      };

      console.log(`Starting stream...\n`);

      // Define token callback
      const onChunk = (chunk) => {
        const now = Date.now();
        const timeSinceStart = now - providerResult.startTime;
        
        // Record this token
        providerResult.tokens.push({
          index: providerResult.tokens.length,
          content: chunk.content,
          length: chunk.content.length,
          finishReason: chunk.finishReason,
          timeSinceStart
        });

        // Calculate first token time
        if (providerResult.tokens.length === 1) {
          providerResult.firstTokenTime = timeSinceStart;
        }

        // Add to full text
        providerResult.fullText += chunk.content;

        // Print token info to console
        const contentPreview = chunk.content.replace(/\n/g, '\\n');
        console.log(`Token #${providerResult.tokens.length} (${timeSinceStart}ms): "${contentPreview}"`);
      };

      // Execute streaming request
      await provider.streamChatCompletion({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 100
      }, onChunk);

      // Post-process results
      providerResult.totalTokens = providerResult.tokens.length;
      providerResult.totalTime = Date.now() - providerResult.startTime;

      // Check for "quick brown fox" content
      providerResult.hasQuickBrownFox = providerResult.fullText.toLowerCase().includes('quick brown fox');
      
      // Check for "Certainly" in first token
      if (providerResult.tokens.length > 0) {
        providerResult.firstTokenIntegrity = providerResult.tokens[0].content.includes('Certainly') ||
                                              providerResult.tokens[0].content.includes('certainly');
        providerResult.certainlyCheck = providerResult.fullText.toLowerCase().includes('certainly');
      }

      // Add to results collection
      results.push(providerResult);

      // Summary for this provider
      console.log(formatText.green(`\n--- ${providerName} Summary ---`));
      console.log(`Total time: ${providerResult.totalTime}ms`);
      console.log(`First token: ${providerResult.firstTokenTime}ms`);
      console.log(`Total tokens: ${providerResult.totalTokens}`);
      console.log(`Content integrity check:`);
      console.log(`  - Contains "quick brown fox": ${providerResult.hasQuickBrownFox ? '✅' : '❌'}`);
      console.log(`  - Contains "Certainly": ${providerResult.certainlyCheck ? '✅' : '❌'}`);
      console.log(`  - "Certainly" in first token: ${providerResult.firstTokenIntegrity ? '✅' : '❌'}`);
      
      // Show full text
      console.log(formatText.blue('\nFull response:'));
      console.log('-'.repeat(50));
      console.log(providerResult.fullText.substring(0, 200) + (providerResult.fullText.length > 200 ? '...' : ''));
      console.log('-'.repeat(50));

    } catch (error) {
      console.error(`Error testing ${providerName}: ${error.message}`);
    }
  }

  // Create comparison table
  console.log(formatText.blue(formatText.bold('\n===== STREAMING PERFORMANCE COMPARISON =====\n')));
  
  console.log(formatText.yellow('Provider'.padEnd(12) + 
               'First Token'.padEnd(15) + 
               'Total Time'.padEnd(15) + 
               'Tokens'.padEnd(10) + 
               'Contains Fox'.padEnd(15) + 
               'Has Certainly'.padEnd(15) +
               'First Token OK'.padEnd(15)));
  
  console.log('-'.repeat(85));
  
  // Sort by first token time
  results.sort((a, b) => a.firstTokenTime - b.firstTokenTime);
  
  for (const result of results) {
    console.log(
      result.provider.padEnd(12) + 
      `${result.firstTokenTime}ms`.padEnd(15) + 
      `${result.totalTime}ms`.padEnd(15) + 
      `${result.totalTokens}`.padEnd(10) + 
      (result.hasQuickBrownFox ? formatText.green('✅') : formatText.red('❌')).padEnd(15) + 
      (result.certainlyCheck ? formatText.green('✅') : formatText.red('❌')).padEnd(15) +
      (result.firstTokenIntegrity ? formatText.green('✅') : formatText.red('❌')).padEnd(15)
    );
  }
}

// Run the test
compareGeminiStreaming().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
}); 