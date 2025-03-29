/**
 * Provider Factory
 * Creates and initializes provider instances based on configuration
 */
import BaseProvider from './BaseProvider';
import OpenAIProvider from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import GeminiProvider from './GeminiProvider';
import OpenRouterProvider from './OpenRouterProvider';
import config from '../config/config';
import { ProviderModel } from './BaseProvider';

// Provider info interface
interface ProviderInfo {
  models: string[] | ProviderModel[];
  defaultModel?: string;
  error?: string;
}

/**
 * Provider Factory Class
 * Creates and manages provider instances
 */
class ProviderFactory {
  private providers: Record<string, any>;
  public defaultProvider: string;
  
  /**
   * Initialize the provider factory
   */
  constructor() {
    try {
      // Initialize provider instances
      this.providers = this._initializeProviders();
      
      // Default provider
      this.defaultProvider = config.providers.openai?.apiKey ? 'openai' : 
                            config.providers.anthropic?.apiKey ? 'anthropic' : 
                            config.providers.gemini?.apiKey ? 'gemini' : 'openai';
    } catch (error) {
      console.error('Error initializing provider factory:', error);
      // Initialize with empty providers if there's an error
      this.providers = {};
      this.defaultProvider = 'none';
    }
  }
  
  /**
   * Get a provider by name
   */
  getProvider(providerName?: string): any {
    const name = providerName || this.defaultProvider;
    
    if (!this.providers[name]) {
      throw new Error(`Provider ${name} not found or not initialized`);
    }
    
    return this.providers[name];
  }
  
  /**
   * Get info for all providers or a specific provider
   */
  async getProvidersInfo(providerName?: string): Promise<Record<string, ProviderInfo>> {
    try {
      const results: Record<string, ProviderInfo> = {};
      
      // If provider name is specified, return info for that provider only
      if (providerName) {
        if (!this.providers[providerName]) {
          return {
            [providerName]: {
              models: [],
              error: `Provider ${providerName} not found or not initialized`
            }
          };
        }
        
        // Get info for the specified provider
        try {
          const provider = this.providers[providerName];
          const models = await provider.getModels();
          
          results[providerName] = {
            models: models,
            defaultModel: provider.config.defaultModel
          };
        } catch (error) {
          results[providerName] = {
            models: [],
            error: `Failed to get models for ${providerName}: ${(error as Error).message}`
          };
        }
        
        return results;
      }
      
      // Get info for all providers
      const providerInfoPromises = Object.entries(this.providers).map(async ([name, provider]) => {
        try {
          const models = await provider.getModels();
          
          results[name] = {
            models: models,
            defaultModel: provider.config.defaultModel
          };
        } catch (error) {
          results[name] = {
            models: [],
            error: `Failed to get models for ${name}: ${(error as Error).message}`
          };
        }
      });
      
      await Promise.all(providerInfoPromises);
      return results;
    } catch (error) {
      return {
        error: {
          models: [],
          error: `Failed to get provider info: ${(error as Error).message}`
        }
      };
    }
  }
  
  /**
   * Get all available providers
   */
  getProviders(): Record<string, any> {
    return { ...this.providers };
  }
  
  /**
   * Check if a provider is available
   */
  hasProvider(providerName: string): boolean {
    return !!this.providers[providerName];
  }
  
  /**
   * Initialize provider instances
   */
  private _initializeProviders(): Record<string, any> {
    try {
      // Get config values with type safety
      const openaiConfig = config.providers.openai || {};
      const anthropicConfig = config.providers.anthropic || {};
      const geminiConfig = config.providers.gemini || {};
      const openrouterConfig = config.providers.openrouter || {};

      // Create provider instances
      return {
        openai: new OpenAIProvider({
          apiKey: openaiConfig.apiKey || '',
          baseUrl: openaiConfig.baseUrl,
          defaultModel: openaiConfig.defaultModel,
          ...openaiConfig
        }),
        anthropic: new AnthropicProvider({
          apiKey: anthropicConfig.apiKey || '',
          baseUrl: anthropicConfig.baseUrl || 'https://api.anthropic.com',
          defaultModel: anthropicConfig.defaultModel || 'claude-3-opus-20240229',
          modelFamily: 'claude',
          ...anthropicConfig
        }),
        gemini: new GeminiProvider({
          apiKey: geminiConfig.apiKey || '',
          baseUrl: geminiConfig.baseUrl,
          defaultModel: geminiConfig.defaultModel,
          ...geminiConfig
        }),
        openrouter: new OpenRouterProvider({
          apiKey: openrouterConfig.apiKey || '',
          baseUrl: openrouterConfig.baseUrl,
          defaultModel: openrouterConfig.defaultModel,
          ...openrouterConfig
        })
      };
    } catch (error) {
      console.error('Error initializing providers:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const factory = new ProviderFactory();
export default factory; 