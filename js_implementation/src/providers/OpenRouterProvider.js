/**
 * OpenRouter Provider Implementation
 * Provides access to multiple LLM APIs through a single interface
 * Efficiently integrates with OpenRouter's API
 */
const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const { createBreaker } = require('../utils/circuitBreaker');
const metrics = require('../utils/metrics');

class OpenRouterProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'openrouter';
    
    // Configure HTTP client settings
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
    
    // Initialize HTTP client
    axios.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout
    });
    
    // Extract API version info
    this.apiVersionInfo = {
      version: 'v1',
      lastUpdated: new Date().toISOString()
    };
    
    // Set up circuit breaker for completion API calls
    this.completionBreaker = createBreaker(`${this.name}-completion`, this._rawChatCompletion.bind(this), {
      failureThreshold: 3,
      resetTimeout: 30000,
      fallback: this._completionFallback.bind(this)
    });
  }
  
  /**
   * Validate the API key format 
   * OpenRouter now expects a proper JWT or the new "sk-or-" prefixed keys
   */
  isValidApiKey(apiKey) {
    // Check for the new OpenRouter API key format (sk-or-v1-...)
    if (apiKey.startsWith('sk-or-v1-')) {
      return true;
    }
    
    // Otherwise check if it's a valid JWT (three sections separated by dots)
    const jwtParts = apiKey.split('.');
    return jwtParts.length === 3;
  }

  /**
   * Get available models (dynamically fetches from OpenRouter API)
   */
  async getModels() {
    try {
      // Start with hardcoded models for fast initial response
      let models = this.config.models || [];
      
      // Dynamically fetch models from OpenRouter
      if (this.config.dynamicModelLoading) {
        try {
          // Call OpenRouter API for models
          const response = await this.client.get('/models');
          
          // Extract model IDs from response
          const dynamicModels = response.data.data.map(model => model.id);
          
          // Combine with hardcoded models, removing duplicates
          models = [...new Set([...models, ...dynamicModels])];
          
          // Record successful API call
          metrics.providerRequestCounter.inc({
            provider: this.name,
            model: 'list',
            status: 'success'
          });
        } catch (error) {
          this._handleApiError(error, 'Failed to dynamically load OpenRouter models');
          
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
      console.error(`OpenRouter getModels error: ${error.message}`);
      return this.config.models || [];
    }
  }

  /**
   * Handle API errors with better diagnostics
   */
  _handleApiError(error, context = 'API call') {
    // Extract detailed error information
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const data = error.response?.data;
    
    // Check for authentication errors
    if (status === 401 || status === 403) {
      console.error(`OpenRouter authentication error (${status}): ${statusText}`);
      console.error('Please verify your API key is valid and properly formatted');
      // Log any clerk auth messages if present
      if (error.response?.headers?.['x-clerk-auth-message']) {
        console.error(`Auth details: ${error.response.headers['x-clerk-auth-message']}`);
      }
    } else if (status === 400) {
      console.error(`OpenRouter bad request (400): ${JSON.stringify(data)}`);
    } else {
      console.error(`${context}: ${error.message}`);
    }
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async chatCompletion(options) {
    try {
      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);
      
      // Use circuit breaker for resilient API call
      const response = await this.completionBreaker.exec(standardOptions);
      
      // Record successful API call
      metrics.providerRequestCounter.inc({
        provider: this.name,
        model: standardOptions.model,
        status: 'success'
      });
      
      return response;
    } catch (error) {
      // Use enhanced error handling
      this._handleApiError(error, `ChatCompletion with model ${options.model}`);
      
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
    // Prepare request body for OpenRouter API (OpenAI-compatible)
    const requestBody = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: false
    };
    
    // Call OpenRouter API directly
    const response = await this.client.post('/chat/completions', requestBody);
    
    // Extract the content from the response
    const responseData = response.data;
    const content = responseData.choices[0]?.message?.content || '';
    const role = responseData.choices[0]?.message?.role || 'assistant';
    const finishReason = responseData.choices[0]?.finish_reason || '';
    
    // Return normalized response
    return this.normalizeResponse({
      model: options.model,
      id: responseData.id,
      content,
      role,
      finish_reason: finishReason,
      created: responseData.created,
      usage: responseData.usage
    });
  }
  
  /**
   * Fallback function for circuit breaker failures
   */
  async _completionFallback(options, error) {
    console.warn(`Using fallback for OpenRouter completion (${options.model}): ${error.message}`);
    
    // Return a normalized error response
    return this.normalizeResponse({
      model: options.model,
      id: `openrouter-error-${Date.now()}`,
      content: `I'm sorry, but I encountered an issue while processing your request. Please try again later. (Error: ${error.message})`,
      role: 'assistant',
      finish_reason: 'error',
      created: Date.now() / 1000,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    });
  }
}

module.exports = OpenRouterProvider; 