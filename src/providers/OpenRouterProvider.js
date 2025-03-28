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
    this.supportsStreaming = true;
    
    // Create Axios instance with default configuration
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'localhost:3000', // Required by OpenRouter
        'X-Title': 'Centralized Chat API' // Optional but helpful for OpenRouter stats
      }
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
          console.warn(`Failed to dynamically load OpenRouter models: ${error.message}`);
          
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
      console.error(`OpenRouter chatCompletion error: ${error.message}`);
      
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
   * Stream a chat completion from OpenRouter
   */
  async streamChatCompletion(options, onChunk) {
    try {
      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);
      
      // Use circuit breaker for resilient API call
      await this.streamingBreaker.exec(standardOptions, onChunk);
      
      // Record successful API call
      metrics.providerRequestCounter.inc({
        provider: this.name,
        model: standardOptions.model,
        status: 'success'
      });
      
    } catch (error) {
      console.error(`OpenRouter streamChatCompletion error: ${error.message}`);
      
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
   * Raw streaming implementation (used by circuit breaker)
   */
  async _rawStreamChatCompletion(options, onChunk) {
    // Prepare request body for OpenRouter API (OpenAI-compatible)
    const requestBody = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: true
    };
    
    // Making streaming request with axios
    try {
      const response = await this.client.post('/chat/completions', requestBody, {
        responseType: 'stream',
        timeout: this.config.timeout || 60000 // Longer timeout for streaming
      });
      
      // Process the stream
      let buffer = '';
      let hasEnded = false;
      
      // Set up event listeners for stream processing
      response.data.on('data', (chunk) => {
        try {
          // Convert Buffer to string and append to existing buffer
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // Process any complete SSE messages in the buffer
          let delimiterIndex;
          while ((delimiterIndex = buffer.indexOf('\n\n')) !== -1) {
            // Extract a complete SSE message
            const sseMessage = buffer.substring(0, delimiterIndex);
            buffer = buffer.substring(delimiterIndex + 2);
            
            // Process the SSE message
            this._processSseMessage(sseMessage, options, onChunk);
          }
        } catch (dataError) {
          console.error('Error processing data chunk:', dataError);
          // Continue processing despite errors in individual chunks
        }
      });
      
      // Handle stream end
      response.data.on('end', () => {
        try {
          hasEnded = true;
          // Process any remaining data in buffer
          if (buffer.trim()) {
            this._processSseMessage(buffer, options, onChunk);
          }
          
          // Send final chunk with finish reason
          onChunk(this.normalizeStreamChunk({
            model: options.model,
            id: `openrouter-chunk-${Date.now()}`,
            content: '',
            role: 'assistant',
            finish_reason: 'stop'
          }));
        } catch (endError) {
          console.error('Error handling stream end:', endError);
        }
      });
      
      // Handle errors
      response.data.on('error', (err) => {
        console.error('Stream error:', err);
        
        // Only send error if stream hasn't ended yet
        if (!hasEnded) {
          onChunk(this.normalizeStreamChunk({
            model: options.model,
            id: `openrouter-error-${Date.now()}`,
            content: `\n\nStreaming error: ${err.message}`,
            role: 'assistant',
            finish_reason: 'error'
          }));
        }
        
        throw err;
      });
      
    } catch (error) {
      console.error('Streaming error:', error);
      
      // Send error message through the stream
      onChunk(this.normalizeStreamChunk({
        model: options.model,
        id: `openrouter-error-${Date.now()}`,
        content: `\n\nStreaming error: ${error.message}`,
        role: 'assistant',
        finish_reason: 'error'
      }));
      
      throw error;
    }
  }
  
  /**
   * Process an SSE message from the stream
   */
  _processSseMessage(sseMessage, options, onChunk) {
    // Skip empty messages or "[DONE]"
    if (!sseMessage.trim() || sseMessage.includes('[DONE]')) {
      return;
    }
    
    // Extract JSON data from the SSE message
    const dataMatch = sseMessage.match(/data: ({.*})/);
    if (!dataMatch) return;
    
    try {
      // Parse JSON data
      const data = JSON.parse(dataMatch[1]);
      
      // Extract content from the delta
      const content = data.choices && data.choices[0]?.delta?.content || '';
      const role = data.choices && data.choices[0]?.delta?.role || 'assistant';
      const finishReason = data.choices && data.choices[0]?.finish_reason || null;
      
      // Only send non-empty chunks or finish chunks
      if (content || finishReason) {
        onChunk(this.normalizeStreamChunk({
          model: options.model,
          id: data.id || `openrouter-chunk-${Date.now()}`,
          content,
          role,
          finish_reason: finishReason
        }));
      }
    } catch (error) {
      console.error('Error parsing SSE message:', error, 'Message:', sseMessage);
      // Continue processing despite errors in individual messages
    }
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