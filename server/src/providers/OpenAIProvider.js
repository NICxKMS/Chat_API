/**
 * OpenAI Provider Implementation
 * Efficiently integrates with OpenAI's API using their official SDK
 */
import { OpenAI } from "openai";
import BaseProvider from "./BaseProvider.js";
import { createBreaker } from "../utils/circuitBreaker.js";
import * as metrics from "../utils/metrics.js";

class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = "openai";
    
    // Initialize OpenAI SDK with custom configuration
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries || 3
    });
    
    // Extract API version info
    this.apiVersionInfo = {
      version: "v1",
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
    
    // Initialize with fallback models if specified in config
    this.cachedModels = this.config.models ? this._createModelObjects(this.config.models) : [];
    
    // Track if models were loaded from API (not just config)
    this.modelsLoadedFromAPI = false;
    // Track if we have any models (config or API)
    this.hasModels = this.cachedModels.length > 0;
    
    // Log initialization status
    console.log(`OpenAIProvider initialized with ${this.cachedModels.length} initial models from config`);
  }

  /**
   * Get available models from OpenAI
   * @param {Object} options - Options for fetching models
   * @param {boolean} options.forceRefresh - Whether to force refresh from API
   */
  async getModels(options = {}) {
    try {
      // Return cache if we have data from API and not forcing refresh
      if (this.modelsLoadedFromAPI && this.cachedModels.length > 0 && !options.forceRefresh) {
        console.log(`Using ${this.cachedModels.length} cached OpenAI models from previous API call`);
        return this.cachedModels;
      }
      
      console.log("Fetching models from OpenAI API...");
      
      // Create fallback models in case API call fails
      const fallbackModels = [
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k",
      ];
      
      // Call the OpenAI API to get available models
      try {
        // Explicitly call the list method and await the response
        const response = await this.client.models.list();
        
        if (!response || !response.data || !Array.isArray(response.data)) {
          console.error("Invalid response format from OpenAI API:", response);
          throw new Error("Invalid response format from OpenAI models API");
        }
        
        console.log(`Received ${response.data.length} models from OpenAI API`);
        
        let filteredModels = response.data
          .filter(model => {
            let id = model.id || ""; // Ensure `id` is a string
            let firstChar = id[0];   // Get the first character safely
      
            return !(
              firstChar === "t" || 
            firstChar === "b" || 
            firstChar === "w" || 
            (id.length > 1 && id.slice(0, 2) === "om") || // Check "om" only if ID has at least 2 chars
            (id.length > 2 && id.slice(0, 3) === "dav")  // Check "dav" only if ID has at least 3 chars
            );
          })
          .map(model => ({
            id: model.id,
            name: model.id,
            provider: this.name,
            tokenLimit: this._getTokenLimit(model.id),
            features: this._getModelFeatures(model.id)
          }));
      
      
        // Cache all available models from API - no config filtering
        this.cachedModels = filteredModels;
        this.modelsLoadedFromAPI = true;
        this.hasModels = true;
        
        console.log(`Successfully loaded ${this.cachedModels.length} models from OpenAI API`);
        
        return filteredModels;
      } catch (error) {
        console.error("Error fetching OpenAI models from API:", error.message);
        
        // If we have previously loaded models from the API, return those
        if (this.modelsLoadedFromAPI && this.cachedModels.length > 0) {
          console.log(`Using ${this.cachedModels.length} previously cached models from API due to error`);
          return this.cachedModels;
        }
        
        // If we have config models, return those
        if (this.hasModels && this.cachedModels.length > 0) {
          console.log(`Using ${this.cachedModels.length} models from config due to API error`);
          return this.cachedModels;
        }
        
        // Otherwise use fallback models
        console.log(`Using ${fallbackModels.length} hardcoded fallback models due to API error`);
        const models = this._createModelObjects(fallbackModels);
        this.cachedModels = models;
        this.hasModels = true;
        return models;
      }
    } catch (error) {
      console.error("Error in getModels:", error.message);
      
      // Return any models we have or use fallback models
      if (this.hasModels && this.cachedModels.length > 0) {
        return this.cachedModels;
      }
      
      return this._createModelObjects(this.config.models || []);
    }
  }

  /**
   * Create model objects from model IDs
   */
  _createModelObjects(modelIds) {
    return modelIds.map(id => ({
      id,
      name: id,
      provider: this.name,
      tokenLimit: this._getTokenLimit(id),
      features: this._getModelFeatures(id)
    }));
  }

  /**
   * Get token limit for a model
   */
  _getTokenLimit(modelId) {
    const tokenLimits = {
      "gpt-4": 8192,
      "gpt-4-32k": 32768,
      "gpt-4-turbo": 128000,
      "gpt-4o": 128000,
      "gpt-3.5-turbo": 4096,
      "gpt-3.5-turbo-16k": 16384
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
    if (modelId.includes("vision") || modelId.includes("gpt-4-turbo") || modelId.includes("gpt-4o")) {
      features.vision = true;
    }
    
    // Tool/function calling models
    if (modelId.includes("gpt-4") || modelId.includes("gpt-3.5-turbo")) {
      features.functionCalling = true;
      features.tools = true;
    }
    
    // JSON mode support
    if (modelId.includes("gpt-4") || modelId.includes("gpt-3.5-turbo")) {
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
      const modelName = standardOptions.model.includes("/") 
        ? standardOptions.model.split("/")[1] 
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
        "200"
      );
      
      return response;
    } catch (error) {
      console.error(`OpenAI API error: ${error.message}`);
      
      // Record failed API call
      metrics.incrementProviderRequestCount(
        this.name,
        options.model?.includes("/") ? options.model.split("/")[1] : options.model,
        "error"
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
        max_completion_tokens: options.max_tokens,
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
      content: "",
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      latency: latency,
      finishReason: "",
      raw: response
    };
    
    // Extract content from the message
    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      result.content = choice.message?.content || "";
      result.finishReason = choice.finish_reason || "stop";
      
      // Handle tool calls if present
      if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
        result.toolCalls = choice.message.tool_calls;
      }
    }
    
    return result;
  }

  /**
   * Send a chat completion request with streaming response
   */
  async *chatCompletionStream(options) {
    const startTime = process.hrtime();
    let modelName;
    try {
      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);
      
      // Extract model name
      modelName = standardOptions.model.includes("/") 
        ? standardOptions.model.split("/")[1] 
        : standardOptions.model;

      // Prepare API options
      const apiOptions = {
        ...standardOptions,
        model: modelName,
        stream: true, // Enable streaming
      };

      // Use circuit breaker for API calls
      // Note: Circuit breaker needs adjustment for streams if using .fire
      // Direct call for simplicity here, consider stream-compatible breaker
      const stream = await this.client.chat.completions.create(apiOptions);
      
      let firstChunk = true;
      let accumulatedLatency = 0;

      for await (const chunk of stream) {
        if (firstChunk) {
          const duration = process.hrtime(startTime);
          accumulatedLatency = (duration[0] * 1000) + (duration[1] / 1000000);
          metrics.recordStreamTtfb(this.name, modelName, accumulatedLatency / 1000);
          firstChunk = false;
        }
        
        // Normalize chunk format (example, adapt as needed)
        const normalizedChunk = this._normalizeStreamChunk(chunk, modelName, accumulatedLatency);
        yield normalizedChunk;
      }
      
      // Record successful stream completion
      metrics.incrementProviderRequestCount(
        this.name,
        modelName,
        "200"
      );

    } catch (error) {
      console.error(`OpenAI stream error: ${error.message}`);
      if (modelName) {
        metrics.incrementProviderErrorCount(this.name, modelName);
      }
      // Re-throw specific error for upstream handling
      // Consider yielding an error object instead if the stream already started
      throw new Error(`OpenAI stream error: ${error.message}`);
    }
  }

  /**
   * Normalize a streaming chunk from OpenAI
   */
  _normalizeStreamChunk(chunk, model, latency) {
    const choice = chunk.choices && chunk.choices[0];
    const delta = choice?.delta;

    return {
      id: chunk.id || `chunk-${Date.now()}`,
      model: chunk.model || model,
      provider: this.name,
      createdAt: chunk.created 
        ? new Date(chunk.created * 1000).toISOString() 
        : new Date().toISOString(),
      content: delta?.content || "",
      finishReason: choice?.finish_reason || null,
      usage: {
        promptTokens: chunk.usage?.prompt_tokens || 0, // Often null in stream chunks
        completionTokens: chunk.usage?.completion_tokens || 0, // Often null in stream chunks
        totalTokens: chunk.usage?.total_tokens || 0 // Often null in stream chunks
      },
      latency: latency || 0, // Latency to first chunk
      raw: chunk // Include the raw chunk for potential downstream use
    };
  }
}

export default OpenAIProvider; 