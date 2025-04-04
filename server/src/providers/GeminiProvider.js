/**
 * Gemini Provider Implementation
 * Integrates with Google's Generative AI SDK for Gemini models
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import BaseProvider from "./BaseProvider.js";
import { createBreaker } from "../utils/circuitBreaker.js";
import * as metrics from "../utils/metrics.js";
// Import the specific histogram instance
import { responseTimeHistogram } from "../utils/metrics.js";

class GeminiProvider extends BaseProvider {
  /**
   * Create a new Gemini provider
   */
  constructor(config) {
    super(config);
    this.name = "gemini";
    
    // Debug API key loading
    const keyDebug = config.apiKey ? 
      `${config.apiKey.substring(0, 5)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 
      "missing";
    
    // Validate API key
    if (!config.apiKey) {
      console.warn("Gemini API key is missing or set to dummy-key. Using fallback mode with limited functionality.");
      this.hasValidApiKey = false;
    } else {
      this.hasValidApiKey = true;
    }
    
    // Store API version from config or environment
    this.apiVersion = config.apiVersion || process.env.GEMINI_API_VERSION || "v1beta";
    console.log(`Using Gemini API version: ${this.apiVersion}`);
    
    // Initialize Google Generative AI SDK
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    
    // Extract API version info
    this.apiVersionInfo = {
      version: this.apiVersion,
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
    
    // Initialize with config models
    this.availableModels = this.config.models || [];
    
    // Log initialization
  }

  /**
   * Get available models from Google Generative AI
   */
  async getModels(options = {}) {
    try {
      // Start with hardcoded models for fast initial response
      let modelIds = this.config.models || [
        "gemini-2.0-flash",
        "gemini-2.0-pro",
        "gemini-1.5-pro",
        "gemini-1.0-pro"
      ];
      
      // Dynamically fetch models if enabled
      if (this.config.dynamicModelLoading) {
        try {
          // Use Axios to directly call the models endpoint
          // The SDK doesn't expose a models listing method yet
          const apiKey = this.config.apiKey;
          const baseUrl = `https://generativelanguage.googleapis.com/${this.apiVersion}`;
          
          const response = await axios.get(`${baseUrl}/models`, {
            headers: {
              "Content-Type": "application/json"
            },
            params: {
              key: apiKey
            }
          });
          
          // Extract model IDs from response
          if (response.data && response.data.models) {
            const dynamicModels = response.data.models
              .filter(model => {let firstChar = model.name?.[7];
                return firstChar !== "e" && firstChar !== "t" && firstChar !== "c";})
              .map((model) => model.name.replace("models/", ""));
              
            // Add new models to our list
            dynamicModels.forEach((model) => {
              if (!modelIds.includes(model)) {
                modelIds.push(model);
              }
            });
          }
        } catch (error) {
          console.warn(`Failed to dynamically load Gemini models: ${error.message}`);
        }
      }
      
      // Convert to ProviderModel format
      return modelIds.map(id => ({
        id,
        name: this.formatModelName(id),
        provider: this.name,
        tokenLimit: this.getTokenLimit(id),
        features: this.getModelFeatures(id)
      }));
      
    } catch (error) {
      console.error(`Gemini getModels error: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Format the model name for display
   */
  formatModelName(modelId) {
    return modelId
      .replace("gemini-", "Gemini ")
      .split("-")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  
  /**
   * Get token limit for a model
   */
  getTokenLimit(modelId) {
    const limits = {
      "gemini-1.5-pro": 1000000,  // 1M tokens
      "gemini-1.5-flash": 1000000, // 1M tokens
      "gemini-1.0-pro": 32768     // 32K tokens
    };
    
    return limits[modelId] || 32768; // default to 32K
  }
  
  /**
   * Get features supported by a model
   */
  getModelFeatures(modelId) {
    // Base features all models support
    const features = {
      vision: true,
      streaming: true,
      tools: false,
      functionCalling: false,
      json: false,
      system: true
    };
    
    // Gemini 1.5 specific features
    if (modelId.includes("gemini-1.5")) {
      features.tools = true;
      features.functionCalling = true;
      features.json = true;
    }
    
    return features;
  }

  /**
   * Get info about this provider and its models
   */
  async getProvidersInfo(options = {}) {
    try {
      // First get all available models
      await this.fetchAvailableModels(options.includeInternal);
      
      // Convert to ProviderModel objects
      const models = await this.getModels();
      
      // Determine default model
      const defaultModel = this.config.defaultModel || (models.length > 0 ? models[0].id : "gemini-1.5-flash");
      
      return {
        name: this.name,
        models: models,
        defaultModel: defaultModel,
        features: {
          streaming: true,
          vision: true,
          tools: true
        },
        apiVersion: this.apiVersionInfo.version
      };
    } catch (error) {
      console.error(`Error in getProvidersInfo: ${error.message}`);
      
      // Return at least some default information
      return {
        name: this.name,
        models: [],
        defaultModel: "gemini-1.5-flash",
        features: {
          streaming: true,
          vision: true,
          tools: false
        }
      };
    }
  }

  /**
   * Fetch available models from the API
   */
  async fetchAvailableModels(includeInternal = false) {
    try {
      if (!this.hasValidApiKey) {
        return this.availableModels; // Return cached models if no valid API key
      }

      // Directly use Axios to call the models API
      const apiKey = this.config.apiKey;
      const response = await axios.get(`https://generativelanguage.googleapis.com/${this.apiVersion}/models`, {
        params: { key: apiKey }
      });

      // Process response
      if (response.data && response.data.models) {
        // Filter to just Gemini models
        this.availableModels = response.data.models
          .filter(model => {
            const modelName = model.name.replace("models/", "");
            const isGemini = modelName.startsWith("gemini-");
            const isPublic = !modelName.includes("internal") || includeInternal;
            return isGemini && isPublic;
          })
          .map(model => model.name.replace("models/", ""));
      }

      return this.availableModels;
    } catch (error) {
      console.error(`Error fetching Gemini models: ${error.message}`);
      return this.availableModels; // Return cached models on error
    }
  }

  /**
   * Get basic provider info
   */
  getInfo() {
    return {
      name: this.name,
      models: this.availableModels,
      defaultModel: this.config.defaultModel,
      apiVersion: this.apiVersionInfo.version,
      lastUpdated: this.apiVersionInfo.lastUpdated
    };
  }

  /**
   * Main chat completion method
   */
  async chatCompletion(options) {
    try {
      if (!this.hasValidApiKey) {
        return {
          id: `error-${Date.now()}`,
          model: options.model || this.config.defaultModel || "gemini-1.5-pro",
          provider: this.name,
          createdAt: new Date().toISOString(),
          content: "API key is invalid or missing. Please configure a valid Google API key.",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latency: 0,
          finishReason: "error",
          errorDetails: {
            message: "Missing or invalid API key",
            type: "auth_error",
            param: null,
            code: "401"
          }
        };
      }

      // Start timer for latency measurement
      const startTime = Date.now();

      // Send request with circuit breaker
      const response = await this.completionBreaker.fire(options);
      const latency = Date.now() - startTime;
      // Corrected call to use the imported histogram instance
      responseTimeHistogram.observe(latency / 1000);
      
      // Assuming successful request before this line
      metrics.incrementProviderRequestCount(this.name, options.model, 'success');
      
      const result = await this.genAI.getGenerativeModel({ model: options.model });
      
      return response;
    } catch (error) {
      // Handle errors with fallback mechanism
      console.error(`Gemini chat completion error: ${error.message}`);
      metrics.incrementProviderErrorCount(this.name, options.model || this.config.defaultModel, error.status || 500);
      
      try {
        return await this._completionFallback(options, error);
      } catch (fallbackError) {
        console.error(`Fallback also failed: ${fallbackError.message}`);
        return {
          id: `error-${Date.now()}`,
          model: options.model || this.config.defaultModel || "gemini-1.5-pro",
          provider: this.name,
          createdAt: new Date().toISOString(),
          content: "",
          usage: {
            promptTokens: this._estimateTokens(options.messages.map(m => m.content).join(" ")),
            completionTokens: 40, // Approximate for the fallback message
            totalTokens: this._estimateTokens(options.messages.map(m => m.content).join(" ")) + 40
          },
          latency: 0,
          finishReason: "fallback",
          errorDetails: {
            message: error.message,
            type: "provider_error",
            param: null,
            code: "ECONNRESET"
          }
        };
      }
    }
  }

  /**
   * Raw chat completion implementation
   */
  async _rawChatCompletion(options) {
    try {
      // Get model instance
      const modelId = options.model || this.config.defaultModel || "gemini-1.5-pro";
      const genModel = this.genAI.getGenerativeModel({ model: modelId });
      
      // Process messages
      const { history, prompt, systemPrompt } = this._processMessages(options.messages);

      // Configure generative options
      const generationConfig = {
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        topP: options.top_p !== undefined ? options.top_p : 0.95,
        topK: options.top_k !== undefined ? options.top_k : 40,
        maxOutputTokens: options.max_tokens || 2048,
        stopSequences: options.stop || []
      };
      
      // Build safety settings if provided
      const safetySettings = options.safety_settings || [];
      
      // Run generation
      const startTime = Date.now();
      
      // Create chat session or use directly
      let result;
      if (history.length > 0) {
        // Using chat history mode
        const chat = genModel.startChat({
          generationConfig,
          safetySettings,
          history,
          systemInstruction: systemPrompt || undefined,
        });
        
        result = await chat.sendMessage(prompt);
      } else {
        // Using direct prompt mode
        const promptWithSystem = systemPrompt ? 
          `${systemPrompt}\n\n${prompt}` : 
          prompt;
          
        result = await genModel.generateContent(promptWithSystem, {
          generationConfig,
          safetySettings
        });
      }
      
      const latency = Date.now() - startTime;
      
      // Parse the response
      const response = {
        id: `gemini-${Date.now()}`,
        model: modelId,
        provider: this.name,
        createdAt: new Date().toISOString(),
        content: result.response?.text() || "",
        usage: {
          promptTokens: this._estimateTokens(prompt + (systemPrompt || "")),
          completionTokens: this._estimateTokens(result.response?.text() || ""),
          totalTokens: 0 // Will be calculated below
        },
        latency,
        finishReason: result.response?.promptFeedback?.blockReason || "stop",
        raw: result
      };
      
      // Calculate total tokens
      response.usage.totalTokens = response.usage.promptTokens + response.usage.completionTokens;
      
      return response;
    } catch (error) {
      console.error(`Error in _rawChatCompletion: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process messages into Gemini-compatible format
   */
  _processMessages(messages) {
    let systemPrompt = "";
    let prompt = "";
    const history = [];
    
    // Process all messages
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // Handle system message
      if (message.role === "system") {
        systemPrompt += message.content + "\n";
        continue;
      }
      
      // Convert user/assistant messages to history format
      if (i < messages.length - 1) {
        // Add to history if not the last message
        if (message.role === "user" || message.role === "assistant") {
          history.push({
            role: message.role === "user" ? "user" : "model",
            parts: [{ text: message.content }]
          });
        }
      } else {
        // Last message becomes the prompt
        if (message.role === "user") {
          prompt = message.content;
        }
      }
    }
    
    return { history, prompt, systemPrompt };
  }

  /**
   * Completion fallback mechanism
   */
  async _completionFallback(options, error) {
    console.log(`Using fallback for error: ${error.message}`);
    
    // Create a fallback response
    return {
      id: `fallback-${Date.now()}`,
      model: options.model || this.config.defaultModel || "gemini-1.5-pro",
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: "I apologize, but I'm having trouble processing your request right now. This could be due to high demand or a temporary issue with the service. Please try again in a moment.",
      usage: {
        promptTokens: this._estimateTokens(options.messages.map(m => m.content).join(" ")),
        completionTokens: 40, // Approximate for the fallback message
        totalTokens: this._estimateTokens(options.messages.map(m => m.content).join(" ")) + 40
      },
      latency: 0,
      finishReason: "fallback",
      errorDetails: {
        message: error.message,
        type: "provider_error",
        param: null,
        code: "ECONNRESET"
      }
    };
  }

  /**
   * Estimate token count based on character count
   */
  _estimateTokens(text) {
    if (!text) {return 0;}
    // Simple estimation: ~4 chars per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Send a chat completion request with streaming response using the Google AI SDK.
   * Implements the `chatCompletionStream` method defined in `BaseProvider`.
   * @param {object} options - The request options (model, messages, etc.), standardized.
   * @yields {object} Standardized response chunks compatible with the API format.
   * @throws {Error} If the API key is missing, the API request fails, or the stream encounters an error.
   */
  async *chatCompletionStream(options) {
    const startTime = process.hrtime();
    let modelName;
    try {
      if (!this.hasValidApiKey) {
        throw new Error("Gemini provider requires a valid API key for streaming.");
      }

      // Standardize and validate options
      const standardOptions = this.standardizeOptions(options);
      this.validateOptions(standardOptions);
      
      // Extract model name (remove provider prefix if present)
      modelName = standardOptions.model.includes("/") 
        ? standardOptions.model.split("/")[1] 
        : standardOptions.model;

      // Select the correct generative model
      const generativeModel = this.genAI.getGenerativeModel({ model: modelName });

      // Prepare request body (messages, generationConfig)
      const request = {
        contents: this._processMessages(standardOptions.messages),
        generationConfig: {
          temperature: standardOptions.temperature,
          maxOutputTokens: standardOptions.max_tokens,
          // Add other relevant generation parameters from standardOptions if needed
          stopSequences: standardOptions.stop // Ensure stop sequences are passed
        },
        // Safety settings can be added here if needed
        safetySettings: standardOptions.safety_settings || []
      };

      // Use the stream method from the Google AI SDK
      const result = await generativeModel.generateContentStream(request);

      let firstChunk = true;
      let accumulatedLatency = 0;

      // Iterate through the stream response
      for await (const chunk of result.stream) {
        if (firstChunk) {
          const duration = process.hrtime(startTime);
          accumulatedLatency = (duration[0] * 1000) + (duration[1] / 1000000);
          // Corrected metrics call for stream TTFB
          metrics.recordStreamTtfb(this.name, modelName, accumulatedLatency / 1000);
          firstChunk = false;
        }

        // Normalize the Gemini chunk and yield it
        const normalizedChunk = this._normalizeStreamChunk(chunk, modelName, accumulatedLatency);
        yield normalizedChunk;
      }

      // Record successful stream completion
      metrics.incrementProviderRequestCount(
        this.name,
        modelName,
        'success'
      );

    } catch (error) {
      console.error(`Gemini stream error: ${error.message}`, error); // Log full error
      if (modelName) {
        metrics.incrementProviderErrorCount(this.name, modelName, error.status || 500);
      }
      // Rethrow or yield an error chunk
      throw new Error(`Gemini stream error: ${error.message}`);
    }
  }

  /**
   * Normalize a streaming chunk received from the Gemini API stream.
   * @param {object} chunk - The raw chunk object from the `generateContentStream`.
   * @param {string} model - The model name used for the request.
   * @param {number} latency - The latency to the first chunk (milliseconds).
   * @returns {object} A standardized chunk object matching the API schema.
   */
  _normalizeStreamChunk(chunk, model, latency) {
    let content = "";
    let finishReason = null;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    try {
      // Extract text content
      if (chunk.candidates && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
        content = chunk.candidates[0].content.parts.map(part => part.text || "").join("");
      }
      
      // Extract finish reason
      finishReason = chunk.candidates && chunk.candidates[0].finishReason 
        ? chunk.candidates[0].finishReason : null;

      // Extract token counts (if available)
      const usageMetadata = chunk.usageMetadata;
      if (usageMetadata) {
        promptTokens = usageMetadata.promptTokenCount || 0;
        completionTokens = usageMetadata.candidatesTokenCount || 0;
        totalTokens = usageMetadata.totalTokenCount || 0;
      }

    } catch (e) {
      console.error("Error parsing Gemini stream chunk:", e, chunk);
    }
    
    return {
      id: `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`, // Generate a unique ID
      model: model,
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: content,
      finishReason: finishReason,
      usage: {
        promptTokens: promptTokens,
        completionTokens: completionTokens,
        totalTokens: totalTokens
      },
      latency: latency || 0, // Latency to first chunk
      raw: chunk // Include the raw chunk
    };
  }
}

export default GeminiProvider; 