/**
 * Verify Token Dropping Fix
 * This script tests the Gemini token implementation with cases that would likely trigger the token dropping issue
 */
require('dotenv').config();
const providerFactory = require('../src/providers/ProviderFactory');

// Enable Gemini streaming debug logs
process.env.DEBUG_GEMINI_STREAM = 'true';

async function verifyTokenFix() {
  console.log('Verifying Gemini provider token dropping fix...\n');
  
  try {
    // Get Gemini provider
    const provider = providerFactory.getProvider('gemini');
    if (!provider) {
      console.error('Gemini provider not configured. Check your .env file and ensure GOOGLE_API_KEY is set.');
      return;
    }
    
    // Get the default model
    const modelToTest = provider.config.defaultModel;
    console.log(`Using Gemini provider with model: ${modelToTest}\n`);
    
    // Test cases specifically designed to catch token dropping issues
    const testCases = [
      {
        name: "Common token dropping test (quick brown fox)",
        prompt: "Respond with exactly this sentence: The quick brown fox jumps over the lazy dog."
      },
      {
        name: "Word boundary test",
        prompt: "Respond with these precise words in order: certainly quickly absolutely positively definitely"
      },
      {
        name: "Repetitive characters test",
        prompt: "Respond with only this: AAABBBCCCDDDEEEFFFGGG"
      },
      {
        name: "Special character test",
        prompt: "Respond with exactly: !@#$%^&*()_+-=[]{};':\",./<>?"
      },
      {
        name: "Code snippet test",
        prompt: "Respond with this JavaScript function: function addNumbers(a, b) { return a + b; }"
      }
    ];
    
    // Run each test case
    for (const testCase of testCases) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`TEST CASE: ${testCase.name}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Prompt: "${testCase.prompt}"\n`);
      
      // Set up streaming
      const messages = [
        { role: 'system', content: 'You are a test assistant. Respond EXACTLY with what is asked, without any additional text.' },
        { role: 'user', content: testCase.prompt }
      ];
      
      // Records for analysis
      let allTokens = [];
      let fullText = '';
      
      // Streaming callback
      const onChunk = (chunk) => {
        // Record this token
        allTokens.push({
          index: allTokens.length,
          content: chunk.content,
          length: chunk.content.length,
          finishReason: chunk.finishReason,
          timestamp: Date.now(),
          hex: Buffer.from(chunk.content).toString('hex')
        });
        
        // Add to full text
        fullText += chunk.content;
        
        // Detailed output for analysis
        const contentPreview = chunk.content.replace(/\n/g, '\\n');
        const hexOutput = Buffer.from(chunk.content).toString('hex');
        console.log(`TOKEN #${allTokens.length}:`);
        console.log(`  Content (${chunk.content.length} chars): "${contentPreview}"`);
        console.log(`  Hex: ${hexOutput}`);
        if (chunk.finishReason) {
          console.log(`  Finish Reason: ${chunk.finishReason}`);
        }
        console.log();
      };
      
      // Run the test
      try {
        console.log("Starting stream...");
        const startTime = Date.now();
        
        await provider.streamChatCompletion({
          model: modelToTest,
          messages,
          temperature: 0.1, // Low temperature for deterministic output
          max_tokens: 150
        }, onChunk);
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        // Analyze the results
        console.log("\nRESULTS ANALYSIS:");
        console.log(`Total time: ${totalTime}ms`);
        
        // Check if we got any tokens
        if (allTokens.length === 0) {
          console.log("❌ No tokens received!");
          continue;
        }
        
        // Total token count
        console.log(`Total tokens: ${allTokens.length}`);
        console.log(`Combined length: ${fullText.length} characters`);
        
        // Look for evidence of token dropping
        // If tokens are being dropped, the full text might not include portions of the expected output
        const expectedTextLowercase = testCase.prompt.toLowerCase().includes("respond with") ? 
          testCase.prompt.toLowerCase().split("respond with")[1].replace(/exactly:?|only:?|this:?|these precise words:?|in order:?/g, '').trim() : 
          "";
        
        if (expectedTextLowercase && !expectedTextLowercase.includes("function")) {
          // Don't do this check for the function test as it might have whitespace differences
          
          const fullTextLowercase = fullText.toLowerCase();
          let missingText = false;
          
          // Split expected text into words and check each word
          const words = expectedTextLowercase.split(/\s+/);
          for (const word of words) {
            if (word.length > 2 && !fullTextLowercase.includes(word)) {
              console.log(`❌ Missing expected word: "${word}"`);
              missingText = true;
            }
          }
          
          if (!missingText) {
            console.log("✅ All expected text appears to be present");
          }
        }
        
        // Output the complete received text
        console.log("\nFull received text:");
        console.log("-".repeat(40));
        console.log(fullText);
        console.log("-".repeat(40));
        
        // Full text as hex for debugging whitespace issues
        console.log("\nFull received text (hex):");
        console.log(Buffer.from(fullText).toString('hex'));
        
        // Token-by-token timing information
        console.log("\nToken timing information:");
        let prevTimestamp = startTime;
        allTokens.forEach((token, i) => {
          const timeSincePrev = i === 0 ? token.timestamp - startTime : token.timestamp - prevTimestamp;
          const status = token.length > 0 ? "✅" : "⚠️";
          console.log(`${status} Token #${i + 1}: ${token.length} chars, +${timeSincePrev}ms${token.finishReason ? ` (${token.finishReason})` : ''}`);
          prevTimestamp = token.timestamp;
        });
        
      } catch (error) {
        console.error(`Error running test: ${error.message}`);
      }
    }
    
    console.log("\nVerification complete!");
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the verification
verifyTokenFix().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
}); 