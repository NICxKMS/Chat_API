/**
 * Anthropic Provider Implementation
 * Integrates with Anthropic's API using their official SDK
 */
const Anthropic = require('@anthropic-ai/sdk');
const BaseProvider = require('./BaseProvider');
const { createBreaker } = require('../utils/circuitBreaker');
const metrics = require('../utils/metrics');

class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'anthropic';
    this.supportsStreaming = true;
    
    // Initialize Anthropic SDK with custom configuration
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
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
    
    this.streamingBreaker = createBreaker(`${this.name}-streaming`, this._rawStreamChatCompletion.bind(this), {
      failureThreshold: 3,
      resetTimeout: 30000
    });
  }

  /**
   * Get available models (combines static model list and potential dynamic API calls)
   */
  async getModels() {
    try {
      // Start with hardcoded models for fast initial response
      let models = this.config.models || [];
      
      // Dynamically fetch models if enabled
      if (this.config.dynamicModelLoading) {
        try {
          // Call Anthropic API for models
          // Note: As of now, Anthropic may not have a dedicated endpoint for model listing
          // This structure allows for future implementation if Anthropic adds such capability
          console.log('Anthropic dynamic model loading not fully implemented yet');
          
          // Record API call attempt in metrics
          metrics.providerRequestCounter.inc({
            provider: this.name,
            model: 'list',
            status: 'info'
          });
          
          // For now, rely on the hardcoded models
        } catch (error) {
          console.warn(`Failed to dynamically load Anthropic models: ${error.message}`);
          
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
      console.error(`Anthropic getModels error: ${error.message}`);
      return this.config.models || [];
    }
  }

  /**
   * Send a chat completion request to Anthropic
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
      
      // Use circuit breaker for resilient API call
      const response = await this.completionBreaker.exec(apiOptions);
      
      // Record successful API call
      metrics.providerRequestCounter.inc({
        provider: this.name,
        model: modelName,
        status: 'success'
      });
      
      return response;
    } catch (error) {
      console.error(`Anthropic chatCompletion error: ${error.message}`);
      
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
   * Stream a chat completion from Anthropic
   */
  async streamChatCompletion(options, onChunk) {
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
      
      // Use circuit breaker for resilient API call
      await this.streamingBreaker.exec(apiOptions, onChunk);
      
      // Record successful API call
      metrics.providerRequestCounter.inc({
        provider: this.name,
        model: modelName,
        status: 'success'
      });
      
    } catch (error) {
      console.error(`Anthropic streamChatCompletion error: ${error.message}`);
      
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
    // Prepare messages for Anthropic API format
    const { messages, system } = this._prepareMessages(options.messages);
    
    // API request parameters
    const requestParams = {
      model: options.model,
      messages,
      max_tokens: options.max_tokens,
      temperature: options.temperature
    };
    
    // Add system prompt if available
    if (system) {
      requestParams.system = system;
    }
    
    // Call Anthropic API directly
    const response = await this.client.messages.create(requestParams);
    
    // Extract the content from the response
    const content = response.content[0]?.text || '';
    
    // Return normalized response
    return this.normalizeResponse({
      model: options.model,
      id: response.id,
      content,
      role: 'assistant',
      finish_reason: response.stop_reason,
      created: Date.now() / 1000,
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    });
  }
  
  /**
   * Raw streaming implementation (used by circuit breaker)
   */
  async _rawStreamChatCompletion(options, onChunk) {
    // Prepare messages for Anthropic API format
    const { messages, system } = this._prepareMessages(options.messages);
    
    // API request parameters
    const requestParams = {
      model: options.model,
      messages,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      stream: true
    };
    
    // Add system prompt if available
    if (system) {
      requestParams.system = system;
    }
    
    // Call Anthropic API with streaming enabled
    const stream = await this.client.messages.create(requestParams);
    
    // Process the stream
    for await (const chunk of stream) {
      // Process each chunk type
      if (chunk.type === 'content_block_delta') {
        // Get the text delta
        const content = chunk.delta?.text || '';
        
        if (content) {
          // Send content chunk
          onChunk(this.normalizeStreamChunk({
            model: options.model,
            id: `anthropic-chunk-${Date.now()}`,
            content,
            role: 'assistant',
            finish_reason: null
          }));
        }
      } else if (chunk.type === 'message_stop') {
        // This is the end of the stream
        onChunk(this.normalizeStreamChunk({
          model: options.model,
          id: `anthropic-chunk-${Date.now()}`,
          content: '',
          role: 'assistant',
          finish_reason: chunk.message_stop?.stop_reason || 'stop'
        }));
      } 
    }
  }
  
  /**
   * Prepare messages for Anthropic API format
   * Converts from OpenAI-style messages to Anthropic format
   */
  _prepareMessages(messages) {
    let system = null;
    const formattedMessages = [];
    
    // Process each message
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Extract system message (Anthropic handles these separately)
        system = msg.content;
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        // User and assistant messages can be passed directly
        formattedMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
      // Ignore other roles
    }
    
    return { messages: formattedMessages, system };
  }
  
  /**
   * Fallback function for circuit breaker failures
   */
  async _completionFallback(options, error) {
    console.warn(`Using fallback for Anthropic completion (${options.model}): ${error.message}`);
    
    // Return a normalized error response
    return this.normalizeResponse({
      model: options.model,
      id: `anthropic-error-${Date.now()}`,
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

module.exports = AnthropicProvider; 