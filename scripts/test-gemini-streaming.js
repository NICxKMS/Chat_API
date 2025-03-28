/**
 * Test Gemini streaming specifically for first token delivery
 * This script tests the Gemini provider's streaming implementation with a focus on the first token
 */
require('dotenv').config();
const providerFactory = require('../src/providers/ProviderFactory');

async function testGeminiStreaming() {
  console.log('Testing Gemini streaming with focus on first token delivery...\n');
  
  try {
    // Get Gemini provider
    const provider = providerFactory.getProvider('gemini');
    if (!provider) {
      console.error('Gemini provider not configured. Check your .env file and ensure GOOGLE_API_KEY is set.');
      return;
    }
    
    console.log('Using Gemini provider:', provider.name);
    
    // Get the default model
    const modelToTest = provider.config.defaultModel;
    console.log(`Using model: ${modelToTest}`);
    
    // Create several test prompts to verify token delivery
    const testPrompts = [
      { name: "Short response test", prompt: "Say 'Hello world!'" },
      { name: "List test", prompt: "List 5 fruits, start immediately with '1.'" },
      { name: "JSON test", prompt: "Return a simple JSON object with a 'greeting' field. Start with the opening brace." },
      { name: "First word test", prompt: "Respond with only one word: 'Success'" },
      { name: "Long response test", prompt: "Write a short paragraph about token streaming. Make it about 3-4 sentences." },
      { name: "Character by character test", prompt: "Output exactly these 26 characters one at a time: abcdefghijklmnopqrstuvwxyz" },
      { name: "Code block test", prompt: "Generate a simple JavaScript function that adds two numbers. Start with the keyword 'function'." }
    ];
    
    // Run each test
    for (const test of testPrompts) {
      console.log(`\n------ ${test.name} ------`);
      
      const messages = [
        { role: 'system', content: 'You are a test assistant. Respond exactly as instructed without preamble or explanation.' },
        { role: 'user', content: test.prompt }
      ];
      
      // Record token delivery times and content
      const tokenTimes = [];
      let firstToken = null;
      let allContent = '';
      let tokenCount = 0;
      
      // Create a raw output log for debugging
      console.log('\nRAW TOKEN STREAM OUTPUT:');
      console.log('=======================');
      
      const startTime = Date.now();
      
      // Create callback for streaming
      const onChunk = (chunk) => {
        const tokenTime = Date.now() - startTime;
        tokenTimes.push({ time: tokenTime, content: chunk.content });
        
        // Record first token
        if (tokenCount === 0) {
          firstToken = chunk.content;
        }
        
        // Build complete content
        allContent += chunk.content;
        tokenCount++;
        
        // Display real-time information
        process.stdout.write(`\rToken #${tokenCount} at ${tokenTime}ms: "${chunk.content.replace(/\n/g, '\\n')}"${' '.repeat(20)}`);
        
        // Raw content debugging output
        console.log(`\n[RAW ${tokenCount}] (${chunk.content.length} chars): '${chunk.content}'`);
        
        // Output hex representation for whitespace debugging
        let hexOutput = '';
        for (let i = 0; i < chunk.content.length; i++) {
          const charCode = chunk.content.charCodeAt(i);
          hexOutput += '\\x' + charCode.toString(16).padStart(2, '0');
        }
        if (chunk.content.length > 0) {
          console.log(`[HEX ${tokenCount}]: ${hexOutput}`);
        }
      };
      
      // Run the stream
      try {
        const options = {
          model: modelToTest,
          messages,
          temperature: 0.2, // Low temperature for more predictable results
          max_tokens: 150   // Increased max tokens for longer test cases
        };
        
        // Stream completion
        await provider.streamChatCompletion(options, onChunk);
        console.log('\n=======================');
        
        // Display results
        console.log('\n\nResults:');
        console.log(`- First token: "${firstToken}" (after ${tokenTimes[0]?.time || 'N/A'}ms)`);
        console.log(`- Total tokens: ${tokenCount}`);
        console.log(`- Total time: ${Date.now() - startTime}ms`);
        
        // Show full content
        console.log('\nFull response:');
        console.log('-'.repeat(50));
        console.log(allContent);
        console.log('-'.repeat(50));
        
        // Analyze token delivery
        let tokensAnalysis = '';
        
        // Analyze first token
        if (firstToken && firstToken.trim()) {
          tokensAnalysis += '✅ First token received successfully\n';
        } else {
          tokensAnalysis += '❌ First token was empty or not received\n';
        }
        
        // Check for any big gaps in token timing that might indicate dropped tokens
        let suspiciousGaps = 0;
        for (let i = 1; i < tokenTimes.length; i++) {
          const timeDiff = tokenTimes[i].time - tokenTimes[i-1].time;
          if (timeDiff > 500) { // 500ms gap might indicate dropped tokens
            suspiciousGaps++;
          }
        }
        
        if (suspiciousGaps === 0) {
          tokensAnalysis += '✅ No suspicious timing gaps detected\n';
        } else {
          tokensAnalysis += `⚠️ ${suspiciousGaps} suspicious timing gaps detected (possible token drops)\n`;
        }
        
        // Check for unusually large token chunks that might indicate token bundling
        const largeChunks = tokenTimes.filter(t => t.content.length > 20).length;
        if (largeChunks === 0) {
          tokensAnalysis += '✅ All tokens are reasonably sized\n';
        } else {
          tokensAnalysis += `⚠️ ${largeChunks} unusually large chunks detected (possible token bundling)\n`;
        }
        
        console.log('\nAnalysis:');
        console.log(tokensAnalysis);
        
        // Add token-by-token summary
        console.log('\nToken-by-token summary:');
        tokenTimes.forEach((token, idx) => {
          console.log(`Token #${idx + 1}: ${token.time}ms - ${token.content.length} chars`);
        });
        
      } catch (error) {
        console.error(`\n❌ Error during streaming: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  console.log('\nTesting complete');
}

// Run the tests
testGeminiStreaming().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
}); 