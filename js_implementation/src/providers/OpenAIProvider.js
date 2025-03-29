/**
 * OpenAI Provider Implementation
 * Efficiently integrates with OpenAI's API using their official SDK
 */
const { OpenAI } = require('openai');
const BaseProvider = require('./BaseProvider');
const { createBreaker } = require('../utils/circuitBreaker');
const metrics = require('../utils/metrics');

class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'openai';
    
    // Initialize OpenAI SDK with custom configuration
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries || 3
    });
    
    // Extract API version info
    this.apiVersionInfo = {
      version: 'v1',
      lastUpdated: new Date().toISOString()
    };
    
    // Set up circuit breaker for API calls
    this.completionBreaker = createBreaker(`${this.name}-completion`, this._rawChatCompletion.bind(this), {
      failureThreshold: 3,
      resetTimeout: 30000,
      fallback: this._completionFallback.bind(this)
    });
  }

  /**
   * Get available models (combines static model list and dynamic API calls)
   * Response is cached for improved performance
   */
  async getModels() {
    try {
      // Start with hardcoded models for fast initial response
      let models = this.config.models || [];
      
      // Dynamically fetch models if enabled
      if (this.config.dynamicModelLoading) {
        try {
          // Request models from OpenAI API
          const response = await this.client.models.list();
          
          // Extract and filter model IDs (only include chat models)
          const dynamicModels = response.data
            // .filter(model => model.id.includes('gpt'))  filter is off to include O series models like o1 and o1 mini
            .map(model => model.id);
          
          // Combine with hardcoded models, removing duplicates
          models = [...new Set([...models, ...dynamicModels])];
          
          // Record successful API call
          metrics.providerRequestCounter.inc({
            provider: this.name,
            model: 'list',
            status: 'success'
          });
        } catch (error) {
          console.warn(`Failed to dynamically load OpenAI models: ${error.message}`);
          
          // Record failed API call
          metrics.providerRequestCounter.inc({
            provider: this.name,
            model: 'list',
            status: 'error'
          });
          
          // Continue with hardcoded models
        }
      }
      
      // Sort models alphabetically for consistent order
      return models.sort();
      
    } catch (error) {
      console.error(`OpenAI getModels error: ${error.message}`);
      return this.config.models || [];
    }
  }

  /**
   * Send a chat completion request to OpenAI
   */
  async chatCompletion(options) {
    try {
      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);
      
      // Extract model name (without provider prefix)
      const modelName = standardOptions.model.includes('/') 
        ? standardOptions.model.split('/')[1] 
        : standardOptions.model;
      
      // Update options with extracted model name
      const apiOptions = {
        ...standardOptions,
        model: modelName
      };
      
      // Use circuit breaker for API calls
      const response = await this.completionBreaker.exec(apiOptions);
      
      // Record successful API call
      metrics.providerRequestCounter.inc({
        provider: this.name,
        model: modelName,
        status: 'success'
      });
      
      return response;
    } catch (error) {
      console.error(`OpenAI chatCompletion error: ${error.message}`);
      
      // Record failed API call
      metrics.providerRequestCounter.inc({
        provider: this.name,
        model: options.model,
        status: 'error'
      });
      
      throw error;
    }
  }
  
  /**
   * Raw chat completion method (used by circuit breaker)
   */
  async _rawChatCompletion(options) {
    // Call OpenAI API directly
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: false
    });
    
    // Extract the content from the response
    const content = response.choices[0]?.message?.content || '';
    const role = response.choices[0]?.message?.role || 'assistant';
    const finishReason = response.choices[0]?.finish_reason || '';
    
    // Return normalized response
    return this.normalizeResponse({
      model: options.model,
      id: response.id,
      content,
      role,
      finish_reason: finishReason,
      created: response.created,
      usage: response.usage
    });
  }
  
  /**
   * Fallback function for circuit breaker failures
   */
  async _completionFallback(options, error) {
    console.warn(`Using fallback for OpenAI completion (${options.model}): ${error.message}`);
    
    // Return a minimal fallback response
    return {
      provider: this.name,
      model: options.model,
      content: "I'm sorry, I'm currently experiencing connectivity issues with my language model provider. Please try again in a moment.",
      role: 'assistant',
      tokenUsage: {
        input: options.messages.reduce((acc, msg) => acc + msg.content.length / 4, 0), // Rough estimation
        output: 0,
        total: 0
      },
      finishReason: 'error',
      createdAt: new Date().toISOString(),
      id: `fallback-${this.name}-${Date.now()}`
    };
  }
}

module.exports = OpenAIProvider;