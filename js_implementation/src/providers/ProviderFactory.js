/**
 * Provider Factory
 * Creates and manages AI model providers
 */

const OpenAIProvider = require('./OpenAIProvider');
const AnthropicProvider = require('./AnthropicProvider');
const GeminiProvider = require('./GeminiProvider');
const OpenRouterProvider = require('./OpenRouterProvider');
const config = require('../config/config');

class ProviderFactory {
  constructor() {
    console.log('Initializing ProviderFactory...');
    
    // Initialize provider instances
    this.providers = {
      openai: new OpenAIProvider(config.providers.openai || {}),
      anthropic: new AnthropicProvider(config.providers.anthropic || {}),
      gemini: new GeminiProvider(config.providers.gemini || {}),
      openrouter: new OpenRouterProvider(config.providers.openrouter || {})
    };
    
    // Default provider
    this.defaultProvider = 'gemini';
    
    // Bind our own methods
    this.getProvider = this.getProvider.bind(this);
    this.getAllProviders = this.getAllProviders.bind(this);
    this.getProviderNames = this.getProviderNames.bind(this);
    this.getAllModels = this.getAllModels.bind(this);
    this.getProvidersInfo = this.getProvidersInfo.bind(this);
    
    console.log('ProviderFactory initialized successfully');
  }
  
  /**
   * Get a provider instance
   * 
   * @param {string} providerName - Name of the provider (optional, uses default if not specified)
   * @returns {Object} - Provider instance
   */
  getProvider(providerName = null) {
    const name = providerName ? providerName.toLowerCase() : this.defaultProvider;
    
    if (!this.providers[name]) {
      console.log(`Creating new provider instance: ${name}`);
      
      // Get provider config
      const providerConfig = this.config.providers[name];
      
      if (!providerConfig) {
        console.warn(`Provider ${name} not found in configuration`);
        return this.getDefaultProvider();
      }
      
      try {
        // Dynamically require the provider class
        const ProviderClass = require(`./${capitalizeFirstLetter(name)}Provider`);
        
        // Create new provider instance with config
        const provider = new ProviderClass(providerConfig);
        
        // Store provider instance for future use
        this.providers[name] = provider;
        
        console.log(`Provider ${name} initialized successfully`);
      } catch (error) {
        console.error(`Failed to initialize provider ${name}: ${error.message}`);
        return this.getDefaultProvider();
      }
    }
    
    return this.providers[name];
  }
  
  /**
   * Get the default provider
   * 
   * @returns {Object} - Default provider instance
   */
  getDefaultProvider() {
    // If the requested provider isn't available, return the default provider
    if (!this.providers[this.defaultProvider]) {
      console.warn(`Default provider ${this.defaultProvider} not available. Using first available provider.`);
      // Use the first available provider as fallback
      const availableProvider = Object.keys(this.providers)[0];
      if (availableProvider) {
        return this.providers[availableProvider];
      }
      throw new Error('No providers available');
    }
    
    return this.providers[this.defaultProvider];
  }
  
  /**
   * Get all providers
   * 
   * @returns {Array} - Array of provider instances
   */
  getAllProviders() {
    return Object.values(this.providers);
  }
  
  /**
   * Get all provider names
   * 
   * @returns {Array} - Array of provider names
   */
  getProviderNames() {
    return Object.keys(this.providers);
  }
  
  /**
   * Get models from all providers
   * 
   * @returns {Object} - Object with provider names as keys and arrays of models as values
   */
  async getAllModels() {
    const models = {};
    
    for (const provider of Object.values(this.providers)) {
      try {
        models[provider.name] = {
          models: await provider.getModels(),
          defaultModel: provider.config.defaultModel
        };
      } catch (error) {
        console.error(`Error getting models for ${provider.name}:`, error);
        models[provider.name] = {
          models: [],
          defaultModel: provider.config.defaultModel,
          error: error.message
        };
      }
    }
    
    return models;
  }
  
  /**
   * Get info about all providers
   * 
   * @returns {Array} - Array of provider info objects
   */
  async getProvidersInfo() {
    const providerInfoPromises = Object.values(this.providers).map(provider => 
      provider.getInfo ? provider.getInfo() : 
        Promise.resolve({
          name: provider.name,
          defaultModel: provider.config.defaultModel
        })
    );
    
    return Promise.all(providerInfoPromises);
  }
}

// Create and export singleton instance
const factory = new ProviderFactory();
module.exports = factory;