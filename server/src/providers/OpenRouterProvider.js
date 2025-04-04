/**
 * OpenRouter Provider Implementation
 * Provides access to multiple LLM APIs through a single interface
 * Efficiently integrates with OpenRouter's API
 */
import axios from "axios";
import BaseProvider from "./BaseProvider.js";
import { createBreaker } from "../utils/circuitBreaker.js";
import * as metrics from "../utils/metrics.js";

class OpenRouterProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = "openrouter";
    
    // Configure HTTP client settings
    this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
    
    // Initialize HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`
      }
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
  }
  
  /**
   * Validate the API key format 
   * OpenRouter now expects a proper JWT or the new "sk-or-" prefixed keys
   */
  isValidApiKey(apiKey) {
    // Check for the new OpenRouter API key format (sk-or-v1-...)
    if (apiKey.startsWith("sk-or-v1-")) {
      return true;
    }
    
    // Otherwise check if it's a valid JWT (three sections separated by dots)
    const jwtParts = apiKey.split(".");
    return jwtParts.length === 3;
  }

  /**
   * Get available models from OpenRouter
   */
  async getModels() {
    try {
      // Start with hardcoded models (if any) for fast initial response
      let models = (this.config.models || []).map(id => ({
        id,
        name: id,
        provider: this.name,
        tokenLimit: 8192, // Default token limit
        features: {
          streaming: true,
          system: true
        }
      }));
      
      // Dynamically fetch models if enabled
      if (this.config.dynamicModelLoading) {
        try {
          // Call OpenRouter API for models
          const response = await this.client.get("/models");
          
          if (response.data && Array.isArray(response.data.data)) {
            // Process each model from the API
            const dynamicModels = response.data.data.map((model) => {
              return {
                id: model.id,
                name: model.name || model.id,
                provider: this.name,
                tokenLimit: model.context_length || 8192,
                features: {
                  streaming: model.features?.includes("streaming") || true,
                  vision: model.features?.includes("vision") || false,
                  json: model.features?.includes("json") || false,
                  tools: model.features?.includes("tools") || false,
                  system: true
                }
              };
            });
            
            // Combine with existing models, prioritizing API results
            const modelIds = new Set(models.map(m => m.id));
            for (const model of dynamicModels) {
              if (!modelIds.has(model.id)) {
                models.push(model);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to dynamically load OpenRouter models: ${error.message}`);
        }
      }
      
      return models;
    } catch (error) {
      console.error(`OpenRouter getModels error: ${error.message}`);
      return [];
    }
  }

  /**
   * Handle API errors with better diagnostics
   */
  _handleApiError(error, context = "API call") {
    if (axios.isAxiosError(error)) {
      // Extract detailed error information
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const data = error.response?.data;
      
      // Check for authentication errors
      if (status === 401 || status === 403) {
        console.error(`OpenRouter authentication error (${status}): ${statusText}`);
        console.error("Please verify your API key is valid and properly formatted");
        // Log any clerk auth messages if present
        if (error.response?.headers?.["x-clerk-auth-message"]) {
          console.error(`Auth details: ${error.response.headers["x-clerk-auth-message"]}`);
        }
      } else if (status === 400) {
        console.error(`OpenRouter bad request (400): ${JSON.stringify(data)}`);
      } else {
        console.error(`${context}: ${error.message}`);
      }
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
      const response = await this.completionBreaker.fire(standardOptions);
      
      // Record successful API call
      metrics.incrementProviderRequestCount(
        this.name,
        standardOptions.model,
        "success"
      );
      
      return response;
    } catch (error) {
      // Use enhanced error handling
      this._handleApiError(error, `ChatCompletion with model ${options.model}`);
      
      // Record failed API call
      metrics.incrementProviderRequestCount(
        this.name,
        options.model,
        "error"
      );
      
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
    
    // Add optional parameters if provided
    if (options.top_p !== undefined) {requestBody.top_p = options.top_p;}
    if (options.frequency_penalty !== undefined) {requestBody.frequency_penalty = options.frequency_penalty;}
    if (options.presence_penalty !== undefined) {requestBody.presence_penalty = options.presence_penalty;}
    if (options.stop) {requestBody.stop = options.stop;}
    
    try {
      // Start timer for latency tracking
      const startTime = Date.now();
      
      // Make the API request
      const response = await this.client.post("/chat/completions", requestBody);
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Parse the response into standardized format
      const result = {
        id: response.data.id,
        model: response.data.model,
        provider: this.name,
        createdAt: new Date(response.data.created * 1000).toISOString(),
        content: response.data.choices[0]?.message?.content || "",
        usage: {
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0
        },
        latency,
        finishReason: response.data.choices[0]?.finish_reason || "unknown",
        raw: response.data
      };
      
      return result;
    } catch (error) {
      // Handle errors gracefully with fallback
      this._handleApiError(error, `OpenRouter completion with ${options.model}`);
      return this._completionFallback(options, error);
    }
  }

  /**
   * Fallback for when the API request fails
   */
  async _completionFallback(options, error) {
    // Track error metrics
    metrics.incrementProviderErrorCount(
      this.name,
      options.model,
      error.response?.status || "unknown"
    );
    
    // Create a standard error response
    return {
      id: `error-${Date.now()}`,
      model: options.model,
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: "",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      latency: 0,
      finishReason: "error",
      errorDetails: {
        message: error.response?.data?.error?.message || error.message || "Unknown error",
        type: error.response?.data?.error?.type || "api_error",
        param: error.response?.data?.error?.param || null,
        code: error.response?.status?.toString() || "500"
      }
    };
  }

  /**
   * Sends a chat completion request to OpenRouter with streaming response (SSE).
   * Uses Axios with `responseType: 'stream'` to handle the Server-Sent Events.
   * Implements the `chatCompletionStream` method defined in `BaseProvider`.
   * @param {object} options - The request options (model, messages, etc.), standardized.
   * @yields {object} Standardized response chunks compatible with the API format.
   * @throws {Error} If the API request fails or the stream encounters an error.
   */
  async *chatCompletionStream(options) {
    const startTime = process.hrtime();
    let modelName;
    let accumulatedLatency = 0;
    let firstChunk = true;
    let stream;

    try {
      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);
      
      modelName = standardOptions.model;

      // Prepare request body for OpenRouter API (OpenAI-compatible)
      const requestBody = {
        model: modelName,
        messages: standardOptions.messages,
        temperature: standardOptions.temperature,
        max_tokens: standardOptions.max_tokens,
        stream: true // Enable streaming
      };
      
      // Add optional parameters if provided
      if (standardOptions.top_p !== undefined) {requestBody.top_p = standardOptions.top_p;}
      if (standardOptions.frequency_penalty !== undefined) {requestBody.frequency_penalty = standardOptions.frequency_penalty;}
      if (standardOptions.presence_penalty !== undefined) {requestBody.presence_penalty = standardOptions.presence_penalty;}
      if (standardOptions.stop) {requestBody.stop = standardOptions.stop;}

      // Use axios with responseType: 'stream' to handle the SSE stream
      const response = await this.client.post("/chat/completions", requestBody, {
        responseType: "stream"
      });

      stream = response.data; // Get the stream from the response data
      
      let buffer = "";
      for await (const chunk of stream) {
        buffer += chunk.toString(); // Append chunk to buffer

        // Use a simple buffer and split approach to parse SSE messages
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const message = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 2);
          
          if (message.startsWith("data: ")) {
            const dataStr = message.substring(6);
            if (dataStr.trim() === "[DONE]") {
              break; // Stream finished
            }
            
            try {
              const data = JSON.parse(dataStr);
              
              if (firstChunk) {
                const duration = process.hrtime(startTime);
                accumulatedLatency = (duration[0] * 1000) + (duration[1] / 1000000);
                metrics.recordStreamTtfb(this.name, modelName, accumulatedLatency / 1000);
                firstChunk = false;
              }
              
              const normalizedChunk = this._normalizeStreamChunk(data, modelName, accumulatedLatency);
              yield normalizedChunk;

            } catch (jsonError) {
              console.error(`Error parsing JSON from OpenRouter stream: ${jsonError.message}`, dataStr);
              // Decide how to handle JSON parse errors, e.g., skip or throw
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
        // If the special [DONE] message was processed, exit the loop
        if (buffer.includes("[DONE]")) {break;}
      }
      
      // Record successful stream completion
      metrics.incrementProviderRequestCount(this.name, modelName, "success");

    } catch (error) {
      this._handleApiError(error, `OpenRouter stream with ${modelName || "unknown model"}`);
      if (modelName) {
        metrics.incrementProviderRequestCount(this.name, modelName, "error");
        metrics.incrementProviderErrorCount(this.name, modelName, error.response?.status || "network");
      }
      // Ensure the stream is destroyed on error if it exists
      if (stream && typeof stream.destroy === "function") {
        stream.destroy(error);
      } 
      throw new Error(`OpenRouter stream error: ${error.message}`);
    } finally {
      // Optional: Explicitly destroy the stream if it wasn't fully consumed or errored
      if (stream && !stream.destroyed && typeof stream.destroy === "function") {
        stream.destroy();
      }
    }
  }

  /**
   * Normalizes a streaming chunk received from the OpenRouter API (which uses OpenAI format).
   * @param {object} chunk - The raw, parsed JSON object from an SSE data line.
   * @param {string} model - The model name used for the request.
   * @param {number} latency - The latency to the first chunk (milliseconds).
   * @returns {object} A standardized chunk object matching the API schema.
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
      usage: { // Usage data is typically not present in OpenAI stream chunks until the end
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      latency: latency || 0, // Latency to first chunk
      raw: chunk // Include the raw chunk
    };
  }
}

export default OpenRouterProvider; 