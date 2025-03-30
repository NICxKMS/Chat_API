/**
 * OpenAI Provider Implementation
 * Efficiently integrates with OpenAI's API using their official SDK
 */
import { OpenAI } from 'openai';
import BaseProvider from './BaseProvider.js';
import { createBreaker } from '../utils/circuitBreaker.js';
import * as metrics from '../utils/metrics.js';

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
    this.completionBreaker = createBreaker(`${this.name}-completion`, 
      (options) => this._rawChatCompletion(options),
      {
        failureThreshold: 3,
        resetTimeout: 30000
      }
    );
    
    // Initialize empty cached models array
    this.cachedModels = [];
  }

  /**
   * Get available models from OpenAI
   */
  async getModels() {
    try {
      // Check if we have a cached model list first
      if (this.cachedModels.length > 0) {
        return this.cachedModels;
      }
      
      // Call the OpenAI API to get available models
      const response = await this.client.models.list();
      
      // Filter models (optionally)
      let filteredModels = response.data
        .filter(model => model.id.startsWith('gpt-'))
        .map(model => ({
          id: model.id,
          name: model.id,
          provider: this.name,
          tokenLimit: this._getTokenLimit(model.id),
          features: this._getModelFeatures(model.id)
        }));
      
      // If specific models were configured, filter to only those
      if (this.config.models && this.config.models.length > 0) {
        filteredModels = filteredModels.filter(model => 
          this.config.models?.includes(model.id)
        );
      }
      
      // Cache the models
      this.cachedModels = filteredModels;
      
      return filteredModels;
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      
      // Return empty array or use fallback models from config
      return this.config.models?.map(id => ({
        id,
        name: id,
        provider: this.name,
        tokenLimit: this._getTokenLimit(id),
        features: this._getModelFeatures(id)
      })) || [];
    }
  }

  /**
   * Get token limit for a model
   */
  _getTokenLimit(modelId) {
    const tokenLimits = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384
    };
    
    // Match model to its base version (without date suffix)
    const baseModel = Object.keys(tokenLimits).find(base => 
      modelId.startsWith(base)
    );
    
    return baseModel ? tokenLimits[baseModel] : 4096; // Default to 4K
  }
  
  /**
   * Get features supported by a model
   */
  _getModelFeatures(modelId) {
    // Default features
    const features = {
      vision: false,
      streaming: true,
      functionCalling: false,
      tools: false,
      json: false,
      system: true
    };
    
    // GPT-4 Vision models
    if (modelId.includes('vision') || modelId.includes('gpt-4-turbo') || modelId.includes('gpt-4o')) {
      features.vision = true;
    }
    
    // Tool/function calling models
    if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5-turbo')) {
      features.functionCalling = true;
      features.tools = true;
    }
    
    // JSON mode support
    if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5-turbo')) {
      features.json = true;
    }
    
    return features;
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
      const response = await this.completionBreaker.fire(apiOptions);
      
      // Record successful API call
      metrics.incrementProviderRequestCount(
        this.name,
        modelName,
        '200'
      );
      
      return response;
    } catch (error) {
      console.error(`OpenAI API error: ${error.message}`);
      
      // Record failed API call
      metrics.incrementProviderRequestCount(
        this.name,
        options.model?.includes('/') ? options.model.split('/')[1] : options.model,
        'error'
      );
      
      throw error;
    }
  }

  /**
   * Raw chat completion API call
   */
  async _rawChatCompletion(options) {
    try {
      const startTime = Date.now();
      
      // Prepare final options for API call
      const finalOptions = {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: false
      };
      
      // Add optional parameters if provided
      if (options.response_format) {
        finalOptions.response_format = options.response_format;
      }
      
      if (options.tools) {
        finalOptions.tools = options.tools;
      }
      
      if (options.tool_choice) {
        finalOptions.tool_choice = options.tool_choice;
      }
      
      // Call the OpenAI API
      const completion = await this.client.chat.completions.create(finalOptions);
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Process response
      return this._normalizeResponse(completion, options.model, latency);
    } catch (error) {
      console.error(`OpenAI raw API error: ${error.message}`, error);
      
      // Rethrow with useful message
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Normalize OpenAI response to common format
   */
  _normalizeResponse(response, model, latency) {
    // Handle OpenAI's response format
    const result = {
      id: response.id,
      model: model,
      provider: this.name,
      createdAt: new Date(response.created * 1000).toISOString(),
      content: '',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      latency: latency,
      finishReason: '',
      raw: response
    };
    
    // Extract content from the message
    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      result.content = choice.message?.content || '';
      result.finishReason = choice.finish_reason || 'stop';
      
      // Handle tool calls if present
      if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
        result.toolCalls = choice.message.tool_calls;
      }
    }
    
    return result;
  }
}

export default OpenAIProvider; 