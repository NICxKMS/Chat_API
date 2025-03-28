/**
 * Provider Factory
 * Manages provider instances and provides access to them
 */
const config = require('../config/config');
const OpenAIProvider = require('./OpenAIProvider');
const AnthropicProvider = require('./AnthropicProvider');
const GeminiProvider = require('./GeminiProvider');
const OpenRouterProvider = require('./OpenRouterProvider');
const cache = require('../utils/cache');

class ProviderFactory {
  constructor() {
    this.providers = {};
    this.loadProviders();
  }

  /**
   * Initialize all configured providers
   */
  loadProviders() {
    // Initialize provider instances based on configuration
    const providerConfigs = config.providers;
    
    // Load OpenAI provider if configured
    if (providerConfigs.openai?.apiKey) {
      this.providers.openai = new OpenAIProvider(providerConfigs.openai);
      console.log('OpenAI provider loaded');
    }
    
    // Load Anthropic provider if configured
    if (providerConfigs.anthropic?.apiKey) {
      this.providers.anthropic = new AnthropicProvider(providerConfigs.anthropic);
      console.log('Anthropic provider loaded');
    }
    
    // Load Gemini provider if configured
    if (providerConfigs.gemini?.apiKey) {
      this.providers.gemini = new GeminiProvider(providerConfigs.gemini);
      console.log('Gemini provider loaded');
    }
    
    // Load OpenRouter provider if configured
    if (providerConfigs.openrouter?.apiKey) {
      this.providers.openrouter = new OpenRouterProvider(providerConfigs.openrouter);
      console.log('OpenRouter provider loaded');
    }
    
    // Update default provider if the configured one isn't available
    if (!this.providers[config.defaultProvider]) {
      const availableProviders = Object.keys(this.providers);
      if (availableProviders.length > 0) {
        console.warn(`Default provider '${config.defaultProvider}' not available, using '${availableProviders[0]}' instead`);
        config.defaultProvider = availableProviders[0];
      } else {
        console.warn('No providers available! Please check your configuration.');
      }
    }
  }

  /**
   * Get a provider instance by name
   * 
   * @param {string} name Provider name
   * @returns {BaseProvider} Provider instance
   */
  getProvider(name) {
    const providerName = name || config.defaultProvider;
    const provider = this.providers[providerName];
    
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found or not configured`);
    }
    
    return provider;
  }

  /**
   * Get all available providers
   * 
   * @returns {Array<BaseProvider>} Array of provider instances
   */
  getAllProviders() {
    return Object.values(this.providers);
  }
  
  /**
   * Get the names of all available providers
   * 
   * @returns {Array<string>} Array of provider names
   */
  getProviderNames() {
    return Object.keys(this.providers);
  }
  
  /**
   * Get information about all providers
   * Using efficient caching for better performance
   * 
   * @returns {Promise<Array<Object>>} Array of provider info objects
   */
  async getProvidersInfo() {
    // Try to get cached provider info
    const cacheKey = cache.generateKey('providers-info');
    const cachedInfo = await cache.get(cacheKey, 'model');
    
    if (cachedInfo) {
      return cachedInfo;
    }
    
    // If not cached, gather info from all providers
    const providers = this.getAllProviders();
    const infoPromises = providers.map(provider => {
      return {
        name: provider.name,
        ...provider.getInfo()
      };
    });
    
    // Store in cache for future requests
    await cache.set(cacheKey, infoPromises, 300, 'model'); // Cache for 5 minutes
    
    return infoPromises;
  }
  
  /**
   * Get all models from all providers
   * Using efficient parallel fetching and caching
   * 
   * @returns {Promise<Object>} Object mapping provider names to their models
   */
  async getAllModels() {
    // Try to get cached models
    const cacheKey = cache.generateKey('all-models');
    const cachedModels = await cache.get(cacheKey, 'model');
    
    if (cachedModels) {
      return cachedModels;
    }
    
    // If not cached, fetch models from all providers in parallel
    const providers = this.getAllProviders();
    const modelPromises = providers.map(async (provider) => {
      try {
        // Get models for this provider (may be cached at provider level)
        const models = await provider.getModels();
        
        // Return provider name with models
        return {
          provider: provider.name,
          models: models,
          defaultModel: provider.config.defaultModel
        };
      } catch (error) {
        console.error(`Error fetching models from ${provider.name}:`, error);
        
        // Return empty models array on error
        return {
          provider: provider.name,
          models: [],
          defaultModel: provider.config.defaultModel,
          error: error.message
        };
      }
    });
    
    // Wait for all promises to resolve
    const results = await Promise.all(modelPromises);
    
    // Convert array to object by provider name
    const modelsByProvider = {};
    results.forEach(result => {
      modelsByProvider[result.provider] = {
        models: result.models,
        defaultModel: result.defaultModel,
        error: result.error
      };
    });
    
    // Cache the results for future requests
    await cache.set(cacheKey, modelsByProvider, 600, 'model'); // Cache for 10 minutes
    
    return modelsByProvider;
  }
}

// Create singleton instance
const providerFactory = new ProviderFactory();
module.exports = providerFactory;