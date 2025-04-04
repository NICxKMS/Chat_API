/**
 * Anthropic API Provider
 * Implements the BaseProvider for Anthropic's Claude models
 */
import BaseProvider from "./BaseProvider.js";
import axios from "axios";
import { createBreaker } from "../utils/circuitBreaker.js";
import logger from "../utils/logger.js";
import * as metrics from "../utils/metrics.js";
import { promisify } from "util";

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
    
    this.name = "anthropic"; // Set the provider name
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.anthropic.com";
    this.apiVersion = config.apiVersion || "2023-06-01";
    this.defaultModel = config.defaultModel || "claude-3-opus-20240229";
    this.modelFamily = config.modelFamily || "claude";
    
    // Validate config
    if (!this.apiKey) {
      throw new Error("Anthropic API key is required");
    }
    
    // Set up HTTP client
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "anthropic-version": this.apiVersion
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
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
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
          id: "claude-3-sonnet-20240229",
          name: "Claude 3 Sonnet",
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
          id: "claude-3-haiku-20240307",
          name: "Claude 3 Haiku",
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
          id: "claude-2.1",
          name: "Claude 2.1",
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
          id: "claude-2.0",
          name: "Claude 2.0",
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
          id: "claude-instant-1.2",
          name: "Claude Instant 1.2",
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
      if (message.role === "user" || message.role === "assistant") {
        // Handle simple text content
        if (typeof message.content === "string") {
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
            .filter(item => item.type === "text")
            .map(item => item.text)
            .join("\n");
          
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
      const systemMessage = messages.find(m => m.role === "system")?.content || "";
      
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
      if (options.top_p) {params.top_p = options.top_p;}
      if (options.top_k) {params.top_k = options.top_k;}
      if (options.stop) {params.stop_sequences = options.stop;}
      
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
      const response = await this.httpClient.post("/v1/messages", params);
      
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
   * Parses and standardizes the non-streaming response from the Anthropic API.
   * @param {object} data - The raw response data from Anthropic.
   * @param {string} model - The model name used.
   * @param {number} latency - The request latency in milliseconds.
   * @returns {object} A standardized response object.
   */
  parseResponse(data, model, latency) {
    // Extract the content text
    let contentText = "";
    
    if (data.content && Array.isArray(data.content)) {
      // Extract text content from content array
      contentText = data.content
        .filter(item => item.type === "text")
        .map(item => item.text || "")
        .join("");
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
      finishReason: data.stop_reason || "unknown",
      raw: data
    };
    
    return response;
  }

  /**
   * Handle streaming response from Anthropic
   */
  async handleStreamResponse(response, model) {
    // Implementation for streaming would go here
    throw new Error("Streaming not implemented for Anthropic provider");
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    let errorMessage = "Unknown error";
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
      errorMessage = "No response received from Anthropic API";
    } else {
      // Request error
      errorMessage = error.message;
    }
    
    logger.error(`Anthropic API error: ${errorMessage}`);
    
    // Return error in standard format
    return {
      id: `error-${Date.now()}`,
      model: "unknown",
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
        message: errorMessage,
        type: "api_error",
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

  /**
   * Sends a chat completion request to Anthropic with streaming response (SSE).
   * Uses Axios with `responseType: 'stream'` to handle the Anthropic SSE format.
   * Implements the `chatCompletionStream` method defined in `BaseProvider`.
   * @param {object} options - The request options (model, messages, etc.), standardized.
   * @yields {object} Standardized response chunks compatible with the API format, derived from Anthropic events.
   * @throws {Error} If the API request fails or the stream encounters an error.
   */
  async *chatCompletionStream(options) {
    const startTime = process.hrtime();
    let modelName;
    let accumulatedLatency = 0;
    let firstChunk = true;
    let stream;
    let eventCount = 0; // Counter for events processed

    try {
      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);

      modelName = standardOptions.model;

      // Get system message if present
      const systemMessage = standardOptions.messages.find(m => m.role === "system")?.content || "";
      
      // Convert messages to Anthropic format (excluding system message)
      const anthropicMessages = this.createMessages(standardOptions.messages.filter(m => m.role !== "system"));

      // Prepare request parameters for Anthropic API v1
      const params = {
        model: modelName,
        messages: anthropicMessages,
        max_tokens: standardOptions.max_tokens || 4096,
        temperature: standardOptions.temperature || 0.7,
        stream: true
      };
      
      // Only include system message if it's not empty
      if (systemMessage) {
        params.system = systemMessage;
      }

      // Add optional parameters if provided
      if (standardOptions.top_p !== undefined) {params.top_p = standardOptions.top_p;}
      if (standardOptions.top_k !== undefined) {params.top_k = standardOptions.top_k;}
      if (standardOptions.stop) {params.stop_sequences = standardOptions.stop;}

      // Create request configuration
      const requestConfig = {
        responseType: "stream"
      };

      // Add abort signal if provided
      if (standardOptions.abortSignal instanceof AbortSignal) {
        requestConfig.signal = standardOptions.abortSignal;
      }

      // Use axios with responseType: 'stream' for streaming
      const response = await this.httpClient.post("/v1/messages", params, requestConfig);

      stream = response.data; // Get the stream from the response data
      let buffer = "";
      let streamEnded = false;

      // Stream cleanup function
      const cleanupStream = () => {
        streamEnded = true;
        if (stream && !stream.destroyed && typeof stream.destroy === 'function') {
          try {
            stream.destroy();
          } catch (e) {
            console.error("Error destroying Anthropic stream:", e);
          }
        }
      };

      // Handle abort signal if provided
      if (standardOptions.abortSignal instanceof AbortSignal) {
        standardOptions.abortSignal.addEventListener('abort', cleanupStream, { once: true });
      }

      try {
        // Process the stream with proper event handling for Anthropic's API v1
        for await (const chunk of stream) {
          if (streamEnded) break; // Check if stream was aborted
          buffer += chunk.toString(); // Append chunk to buffer
          
          // Process complete SSE messages using a buffer and line-by-line parsing
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const messageLines = buffer.substring(0, boundary).split("\n");
            buffer = buffer.substring(boundary + 2);
            
            let eventType = "";
            let dataStr = "";

            // Extract event type and data from lines
            for (const line of messageLines) {
              if (line.startsWith("event: ")) {
                eventType = line.substring(7);
              } else if (line.startsWith("data: ")) {
                dataStr = line.substring(6);
              }
            }

            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                eventCount++;

                // Record first chunk timing for meaningful events
                if (firstChunk && (eventType === "message_start" || eventType === "content_block_start" || eventType === "content_block_delta")) {
                  const duration = process.hrtime(startTime);
                  accumulatedLatency = (duration[0] * 1000) + (duration[1] / 1000000);
                  metrics.recordStreamTtfb(this.name, modelName, accumulatedLatency / 1000);
                  firstChunk = false;
                }
                  
                // Normalize and yield the chunk based on event type
                const normalizedChunk = this._normalizeStreamChunk(eventType, data, modelName, accumulatedLatency);
                if (normalizedChunk) { // Only yield if normalization produced a result
                  yield normalizedChunk;
                }
                 
                // Check for end event (message_stop for completion)
                if (eventType === "message_stop") {
                  metrics.incrementProviderRequestCount(this.name, modelName, "success");
                  streamEnded = true;
                  break; // Exit the inner loop
                }

              } catch (jsonError) {
                logger.error(`Error parsing JSON from Anthropic stream (${eventType}): ${jsonError.message}`, dataStr);
                // Continue processing - don't break the stream for one bad message
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
          
          // If the stream has ended through a message_stop event, exit the outer loop
          if (streamEnded) {
            break;
          }
        }
        
        // Process any remaining data in the buffer after stream ends
        if (buffer.length > 0 && !streamEnded) {
          // Try to extract event/data from incomplete message
          const eventMatch = buffer.match(/event:\s*(\w+)/);
          const dataMatch = buffer.match(/data:\s*({.*})/);
          
          if (eventMatch && eventMatch[1] && dataMatch && dataMatch[1]) {
            try {
              const eventType = eventMatch[1];
              const data = JSON.parse(dataMatch[1]);
              
              // Process this final event if it's valid
              const normalizedChunk = this._normalizeStreamChunk(eventType, data, modelName, accumulatedLatency);
              if (normalizedChunk) {
                yield normalizedChunk;
              }
              
              // If it was a message_stop, mark as successfully completed
              if (eventType === "message_stop") {
                metrics.incrementProviderRequestCount(this.name, modelName, "success");
                streamEnded = true;
              }
            } catch (e) {
              logger.warn(`Failed to process incomplete buffer data: ${e.message}`);
            }
          }
        }
        
        // If stream finishes without message_stop, record as success but log a warning
        if (!streamEnded) {
          logger.warn(`Anthropic stream for model ${modelName} finished without a message_stop event (processed ${eventCount} events)`);
          metrics.incrementProviderRequestCount(this.name, modelName, "success");
        }

      } finally {
        // Clean up the abort signal listener if it was added
        if (standardOptions.abortSignal instanceof AbortSignal) {
          standardOptions.abortSignal.removeEventListener('abort', cleanupStream);
        }
        
        // Always ensure stream is properly destroyed
        cleanupStream();
      }

    } catch (error) {
      logger.error(`Error in Anthropic stream: ${error.message}`, error.response?.data || error);
      if (modelName) {
        metrics.incrementProviderErrorCount(this.name, modelName, error.response?.status || "network");
      }
      throw this.handleError(error); // Use existing error handling
    }
  }

  /**
   * Normalizes a streaming chunk (event) received from the Anthropic API SSE stream.
   * Handles different Anthropic event types (`message_start`, `content_block_delta`, etc.)
   * @param {string} eventType - The type of the SSE event (e.g., 'content_block_delta').
   * @param {object} data - The parsed JSON data from the event.
   * @param {string} model - The model name used for the request.
   * @param {number} latency - The latency to the first meaningful chunk (milliseconds).
   * @returns {object | null} A standardized chunk object matching the API schema, or null if the event doesn't map to a yieldable chunk.
   */
  _normalizeStreamChunk(eventType, data, model, latency) {
    let content = "";
    let finishReason = null;
    let promptTokens = 0;
    let completionTokens = 0;

    switch (eventType) {
    case "message_start":
      // Initial message, contains usage data but no content to yield yet
      promptTokens = data.message?.usage?.input_tokens || 0;
      return null; // Don't yield for message_start
    case "content_block_start":
      // Start of a content block, no content yet
      return null; // Don't yield for content_block_start
    case "content_block_delta":
      // Text content delta - this is what we want to yield
      if (data.delta?.type === "text_delta") {
        content = data.delta.text || "";
      }
      break;
    case "message_delta":
      // Might contain usage updates or finish reason
      completionTokens = data.usage?.output_tokens || 0;
      finishReason = data.delta?.stop_reason || null;
      // Only yield if there's a finish reason, to indicate completion
      if (!finishReason) return null;
      break;
    case "content_block_stop":
      // End of a content block, nothing to yield here
      return null;
    case "message_stop":
      // Final message, indicates stream end
      finishReason = data.message?.stop_reason || null;
      completionTokens = data.message?.usage?.output_tokens || 0;
      return null; // Don't yield for message_stop
    case "ping":
      // Keep-alive, ignore
      return null;
    case "error":
      console.error("Anthropic stream error event:", data);
      // Could yield an error chunk here if needed
      return null;
    default:
      // Unknown event type, log and ignore
      console.warn(`Unknown Anthropic stream event type: ${eventType}`, data);
      return null;
    }

    // Only yield if there's content to send (or it's a message_delta with finish reason)
    if (content === "" && eventType !== "message_delta") {
      return null;
    }

    return {
      id: `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      model: model,
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: content,
      finishReason: finishReason,
      usage: {
        // Token counts might be incomplete until message_delta or message_stop
        promptTokens: promptTokens,
        completionTokens: completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      latency: latency || 0,
      raw: {
        eventType,
        data
      }
    };
  }
} 