/**
 * Anthropic API Provider
 * Implements the BaseProvider for Anthropic's Claude models
 */
import BaseProvider from './BaseProvider.js';
import axios from 'axios';
import { createBreaker } from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';
import { promisify } from 'util';

/**
 * Anthropic Provider implementation
 * Handles API requests to Anthropic for Claude models
 */
export class AnthropicProvider extends BaseProvider {
  /**
   * Create a new Anthropic provider
   */
  constructor(config) {
    super(config);
    
    this.name = 'anthropic'; // Set the provider name
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.apiVersion = config.apiVersion || '2023-06-01';
    this.defaultModel = config.defaultModel || 'claude-3-opus-20240229';
    this.modelFamily = config.modelFamily || 'claude';
    
    // Validate config
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    // Set up HTTP client
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'anthropic-version': this.apiVersion
      }
    });
    
    // Set up circuit breaker for API requests
    this.completionBreaker = createBreaker(`${this.name}-completion`, 
      (params) => this.rawCompletion(params), 
      {
        failureThreshold: 3,
        resetTimeout: 30000,
        errorThreshold: 50
      }
    );
    
    logger.info(`Anthropic provider initialized with model family: ${this.modelFamily}`);
  }
  
  /**
   * Get available models from Anthropic
   */
  async getModels() {
    try {
      // Anthropic doesn't have a specific models endpoint, so we hardcode the available models
      // This should be updated as new models are released
      const claudeModels = [
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: true,
            tools: true,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: true,
            tools: true,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: true,
            tools: true,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-2.1',
          name: 'Claude 2.1',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: false,
            tools: false,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-2.0',
          name: 'Claude 2.0',
          provider: this.name,
          tokenLimit: 100000,
          features: {
            vision: false,
            tools: false,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-instant-1.2',
          name: 'Claude Instant 1.2',
          provider: this.name,
          tokenLimit: 100000,
          features: {
            vision: false,
            tools: false,
            streaming: true,
            json: true,
            system: true
          }
        }
      ];
      
      return claudeModels;
    } catch (error) {
      logger.error(`Error fetching Anthropic models: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Anthropic-compatible messages from standard format
   */
  createMessages(messages) {
    // Convert standard messages to Anthropic format
    const anthropicMessages = [];
    
    for (const message of messages) {
      // Handle only user and assistant roles (system handled separately)
      if (message.role === 'user' || message.role === 'assistant') {
        // Handle simple text content
        if (typeof message.content === 'string') {
          anthropicMessages.push({
            role: message.role,
            content: message.content
          });
        } 
        // Handle array content (for multimodal messages)
        else if (Array.isArray(message.content)) {
          // For now, just extract text parts; ignore image parts
          // Claude API has specific handling for images that would need implementation
          const textContent = message.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
          
          anthropicMessages.push({
            role: message.role,
            content: textContent
          });
        }
      }
    }
    
    return anthropicMessages;
  }

  /**
   * Send a completion request to Anthropic
   */
  async sendCompletion(messages, options = {}) {
    try {
      // Get system message if present
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      
      // Convert messages to Anthropic format
      const anthropicMessages = this.createMessages(messages);
      
      // Prepare request parameters
      const params = {
        model: options.model || this.defaultModel,
        messages: anthropicMessages,
        max_tokens: options.max_tokens || 4096,
        temperature: options.temperature || 0.7,
        system: systemMessage,
        stream: false
      };
      
      // Add optional parameters if provided
      if (options.top_p) params.top_p = options.top_p;
      if (options.top_k) params.top_k = options.top_k;
      if (options.stop) params.stop_sequences = options.stop;
      
      logger.debug(`Sending request to Anthropic with model: ${params.model}`);
      
      // Use circuit breaker to protect against API failures
      return await this.completionBreaker.fire(params);
    } catch (error) {
      logger.error(`Error in Anthropic sendCompletion: ${error.message}`);
      return this.handleError(error);
    }
  }

  /**
   * Raw completion API call to Anthropic
   */
  async rawCompletion(params) {
    try {
      const startTime = Date.now();
      
      // Make API request
      const response = await this.httpClient.post('/v1/messages', params);
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Parse response
      return this.parseResponse(response.data, params.model, latency);
    } catch (error) {
      logger.error(`Error in Anthropic rawCompletion: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse and normalize Anthropic API response
   */
  parseResponse(data, model, latency) {
    // Extract the content text
    let contentText = '';
    
    if (data.content && Array.isArray(data.content)) {
      // Extract text content from content array
      contentText = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text || '')
        .join('');
    }
    
    // Create standardized response format
    const response = {
      id: data.id || `anthropic-${Date.now()}`,
      model: model,
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: contentText,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      latency: latency,
      finishReason: data.stop_reason || 'unknown',
      raw: data
    };
    
    return response;
  }

  /**
   * Handle streaming response from Anthropic
   */
  async handleStreamResponse(response, model) {
    // Implementation for streaming would go here
    throw new Error('Streaming not implemented for Anthropic provider');
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.response) {
      // Get error details from Anthropic response
      const errorData = error.response.data;
      statusCode = error.response.status;
      
      if (errorData && errorData.error) {
        errorMessage = `${errorData.error.type}: ${errorData.error.message}`;
      } else {
        errorMessage = `HTTP Error: ${error.response.status}`;
      }
    } else if (error.request) {
      // No response received
      errorMessage = 'No response received from Anthropic API';
    } else {
      // Request error
      errorMessage = error.message;
    }
    
    logger.error(`Anthropic API error: ${errorMessage}`);
    
    // Return error in standard format
    return {
      id: `error-${Date.now()}`,
      model: 'unknown',
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: '',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      latency: 0,
      finishReason: 'error',
      errorDetails: {
        message: errorMessage,
        type: 'api_error',
        param: null,
        code: statusCode.toString()
      }
    };
  }

  /**
   * Main chat completion method
   */
  async chatCompletion(options) {
    try {
      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);
      
      // Send to Anthropic API
      return await this.sendCompletion(standardOptions.messages, {
        model: standardOptions.model,
        max_tokens: standardOptions.max_tokens,
        temperature: standardOptions.temperature,
        top_p: standardOptions.top_p,
        top_k: standardOptions.top_k,
        stop: standardOptions.stop,
        stream: standardOptions.stream
      });
    } catch (error) {
      logger.error(`Error in Anthropic chatCompletion: ${error.message}`);
      return this.handleError(error);
    }
  }
} 