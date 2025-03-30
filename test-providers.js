// Test script for providers
import factory from './src/providers/ProviderFactory.js';

async function testOpenAIProvider() {
  try {
    console.log('=== Testing OpenAI Provider Model Loading ===');
    const provider = factory.getProvider('gemini');
    
    if (!provider) {
      console.log('OpenAI provider not available');
      return;
    }
    
    // First get config models
    console.log('\n1. Getting initial models from config...');
    const initialModels = await provider.getModels();
    console.log(`Got ${initialModels.length} initial models loaded from config:`);
    console.log(initialModels.map(m => m.id).join(', '));
    
    // Now force refresh from API
    console.log('\n2. Now forcing model refresh from the OpenAI API...');
    const apiModels = await provider.getModels({ forceRefresh: true });
    
    console.log(`Got ${apiModels.length} models from OpenAI API:`);
    if (apiModels.length > 0) {
      console.log('First 10 API models:');
      apiModels.slice(0, 10).forEach(model => {
        console.log(`- ${model.id} (Token limit: ${model.tokenLimit})`);
      });
      
      if (apiModels.length > 10) {
        console.log(`...and ${apiModels.length - 10} more models`);
      }
    } else {
      console.log('No models loaded from API!');
    }
    
    // Test using cached API models
    console.log('\n3. Getting models again (should use API cache)...');
    const cachedModels = await provider.getModels();
    console.log(`Got ${cachedModels.length} models from cache (should match API count)`);
    
    // Compare counts
    console.log('\nModel count comparison:');
    console.log(`- Initial config models: ${initialModels.length}`);
    console.log(`- API models: ${apiModels.length}`);
    console.log(`- Cached models: ${cachedModels.length}`);
  } catch (error) {
    console.error('Test error:', error);
  }
}

testOpenAIProvider().then(() => {
  console.log('\nTest complete!');
}); 