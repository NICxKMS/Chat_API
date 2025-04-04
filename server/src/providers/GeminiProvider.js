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
import logger from "../utils/logger.js";

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
      logger.warn("Gemini API key is missing or set to dummy-key. Using fallback mode with limited functionality.");
      this.hasValidApiKey = false;
    } else {
      this.hasValidApiKey = true;
    }
    
    // Store API version from config or environment
    this.apiVersion = config.apiVersion || process.env.GEMINI_API_VERSION || "v1beta";
    logger.info(`Using Gemini API version: ${this.apiVersion}`);
    
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
          logger.warn(`Failed to dynamically load Gemini models: ${error.message}`);
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
      logger.error(`Gemini getModels error: ${error.message}`);
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
      logger.error(`Error in getProvidersInfo: ${error.message}`);
      
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
      logger.error(`Error fetching Gemini models: ${error.message}`);
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
      logger.error(`Gemini chat completion error: ${error.message}`);
      metrics.incrementProviderErrorCount(this.name, options.model || this.config.defaultModel, error.status || 500);
      
      try {
        return await this._completionFallback(options, error);
      } catch (fallbackError) {
        logger.error(`Fallback also failed: ${fallbackError.message}`);
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
      
      // Process messages using the correct return structure
      const { formattedContents, systemPromptText } = this._processMessages(options.messages);

      // Validate formattedContents before use
      if (!Array.isArray(formattedContents)) {
        logger.error("GeminiProvider._rawChatCompletion: _processMessages did not return a valid formattedContents array.");
        throw new Error("Internal error processing messages for Gemini.");
      }
      
      // Extract history and the final user prompt
      let history = [];
      let finalPromptContent = "";
      if (formattedContents.length > 0) {
          // Ensure the last message is from the user to be the prompt
          if (formattedContents[formattedContents.length - 1].role === 'user') {
              const lastMessage = formattedContents.pop(); // Remove last message to use as prompt
              // Ensure parts exist and extract text
              finalPromptContent = lastMessage.parts?.map(p => p.text).join('\n') || "";
              history = formattedContents; // Remaining messages are history
          } else {
              // If the last message isn't 'user', something is wrong or it's a model-only start (unlikely for chat)
              logger.warn("GeminiProvider._rawChatCompletion: Last message role is not 'user'. Treating all formatted content as history and sending an empty prompt. This might lead to unexpected behavior.");
              history = formattedContents;
              // Sending an empty prompt might not be ideal, consider throwing an error or adjusting based on expected use cases.
          }
      } else {
          // Handle cases with no messages or only a system prompt (which _processMessages extracts)
          // If only a system prompt exists, genModel.generateContent will handle it later.
          // If no messages at all, finalPromptContent remains empty.
      }


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
      // Use history.length check AFTER history has been properly assigned
      if (history.length > 0) {
        // Using chat history mode
        const chat = genModel.startChat({
          generationConfig,
          safetySettings,
          history, // Use the extracted history
          systemInstruction: systemPromptText || undefined, // Use the extracted system prompt
        });
        
        // Send the final user message content
        result = await chat.sendMessage(finalPromptContent);
      } else {
        // Using direct prompt mode (no prior history)
        // Combine system prompt and the single user message if both exist
        const promptForGeneration = systemPromptText ?
          `${systemPromptText}\n\n${finalPromptContent}` :
          finalPromptContent;

        // Ensure we don't send an empty prompt unless intended
        if (!promptForGeneration && !systemPromptText) {
             logger.warn("GeminiProvider._rawChatCompletion: Attempting to generate content with empty prompt and no system instruction.");
             // Decide how to handle: throw error, return empty response, etc.
             // For now, proceed, but the API might reject it.
        }

        result = await genModel.generateContent(
           // Pass the combined or single prompt
           // The SDK might accept structured { role: 'user', parts: [...] } here too,
           // but simple string is usually sufficient for single-turn.
           promptForGeneration,
           { // Pass generationConfig and safetySettings directly
             generationConfig,
             safetySettings
           }
        );
      }
      
      const latency = Date.now() - startTime;
      
      // Parse the response (ensure result.response exists)
      const apiResponse = result?.response; // Safely access response

      const response = {
        id: `gemini-${Date.now()}`,
        model: modelId,
        provider: this.name,
        createdAt: new Date().toISOString(),
        // Safely access text() method
        content: apiResponse?.text ? apiResponse.text() : "",
        usage: {
           // Use finalPromptContent and systemPromptText for estimation
          promptTokens: this._estimateTokens(finalPromptContent + (systemPromptText || "")),
          // Safely estimate completion tokens
          completionTokens: this._estimateTokens(apiResponse?.text ? apiResponse.text() : ""),
          totalTokens: 0 // Will be calculated below
        },
        latency,
         // Safely access promptFeedback and blockReason
        finishReason: apiResponse?.promptFeedback?.blockReason ||
                      (apiResponse?.candidates?.[0]?.finishReason) || // Check candidate finish reason too
                      "stop", // Default to stop if no specific reason found
        raw: result // Keep the raw result structure
      };
      
      // Calculate total tokens
      response.usage.totalTokens = response.usage.promptTokens + response.usage.completionTokens;
      
      return response;
    } catch (error) {
      logger.error(`Error in _rawChatCompletion: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process messages into Gemini-compatible format (history + final prompt)
   * Handles system prompt aggregation and ensures alternating user/model roles in history.
   */
  _processMessages(messages) {
    let systemPromptText = "";
    const formattedContents = []; // Holds the final formatted messages for the 'contents' field
    let lastRole = null; // Track the last role added to formattedContents

    // 1. Input validation: Ensure messages is an array
    if (!Array.isArray(messages)) {
      logger.error("GeminiProvider._processMessages: Input 'messages' is not an array.", messages);
      // Return defaults to prevent downstream errors
      return { formattedContents: [], systemPromptText: "" };
    }

    // 2. Process messages, format for 'contents', extract system prompt, and ensure alternating roles
    for (const message of messages) {
      // Basic validation for message structure
      if (!message || typeof message.content !== 'string' || typeof message.role !== 'string') {
        logger.warn("GeminiProvider._processMessages: Skipping message with invalid format:", message);
        continue; // Skip malformed messages
      }

      const currentRole = message.role.toLowerCase();

      if (currentRole === "system") {
        systemPromptText += (systemPromptText ? "\\n" : "") + message.content;
        continue; // System prompts are handled separately, not added to contents
      }

      let roleForSdk;
      if (currentRole === "user") {
        roleForSdk = "user";
      } else if (currentRole === "assistant" || currentRole === "model") {
        roleForSdk = "model"; // Google uses 'model' for assistant role
      } else {
        logger.warn(`GeminiProvider._processMessages: Ignoring message with unknown role: ${message.role}`);
        continue; // Skip unknown roles
      }

      // Ensure alternating roles (user -> model -> user -> ...)
      if (roleForSdk === lastRole) {
          // Handle consecutive messages: Option 1: Merge with the previous one
          if (formattedContents.length > 0) {
              logger.warn(`GeminiProvider._processMessages: Merging consecutive message content for role '${roleForSdk}'.`);
              const lastMessage = formattedContents[formattedContents.length - 1];
              if (lastMessage.parts && Array.isArray(lastMessage.parts) && lastMessage.parts[0]?.text !== undefined) {
                  lastMessage.parts[0].text += "\\n" + message.content; // Append content
              } else {
                  // If parts structure is unexpected, overwrite (less ideal)
                   lastMessage.parts = [{ text: message.content }];
              }
          } else {
               // If the *first* message somehow violates alternation (shouldn't happen with valid input)
               logger.warn(`GeminiProvider._processMessages: Skipping consecutive message at the beginning for role '${roleForSdk}'.`);
          }
          // Option 2: Skip/prune the message (alternative to merging)
          // logger.warn(`GeminiProvider._processMessages: Pruning consecutive message with role '${roleForSdk}' to enforce alternating history.`);
          // continue;
      } else {
          // Add the message with the correct role
          formattedContents.push({
            role: roleForSdk,
            parts: [{ text: message.content }]
          });
          lastRole = roleForSdk; // Update the last role added
      }
    }

    // 3. Gemini requires the history to start with a 'user' role if it's not empty.
    // (This is often implied, but good to check if strict alternation didn't enforce it)
    // Note: The SDK might handle this, but explicit check can prevent errors.
    if (formattedContents.length > 0 && formattedContents[0].role !== 'user') {
        logger.warn("GeminiProvider._processMessages: History does not start with 'user'. Prepending an empty user message or adjusting might be needed depending on SDK requirements.");
        // Depending on strictness, might need to prepend an empty user message or drop the first model message.
        // For now, log a warning. Let's assume the SDK is flexible or the input guarantees user start.
    }

    // 4. Return the structured data
    return { formattedContents: formattedContents, systemPromptText: systemPromptText };
  }

  /**
   * Completion fallback mechanism
   */
  async _completionFallback(options, error) {
    logger.info(`Using fallback for error: ${error.message}`);
    
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
      this.validateOptions(standardOptions); // Use BaseProvider validation

      // Extract model name (remove provider prefix if present)
      modelName = standardOptions.model.includes("/")
        ? standardOptions.model.split("/")[1]
        : standardOptions.model;

      // Select the correct generative model
      const generativeModel = this.genAI.getGenerativeModel({ model: modelName });

      // Prepare messages and system prompt using the corrected method
      const { formattedContents, systemPromptText } = this._processMessages(standardOptions.messages);

      // Validate that formattedContents is an array before proceeding
      if (!Array.isArray(formattedContents)) {
        throw new Error("_processMessages did not return a valid formattedContents array.");
      }

      // Prepare request body (messages, generationConfig)
      const request = {
        contents: formattedContents,
        generationConfig: {
          temperature: standardOptions.temperature,
          maxOutputTokens: standardOptions.max_tokens,
          stopSequences: standardOptions.stop
        },
        safetySettings: standardOptions.safety_settings || []
      };

      // Add system instruction if a system prompt exists
      if (systemPromptText) {
        request.systemInstruction = {
          parts: [{ text: systemPromptText }]
        };
      }

      // Generate content stream using the Google AI SDK
      const streamResult = await generativeModel.generateContentStream(request);

      let firstChunk = true;
      let accumulatedLatency = 0;

      // Iterate through the stream response chunks
      for await (const chunk of streamResult.stream) {
        if (firstChunk) {
          const duration = process.hrtime(startTime);
          accumulatedLatency = (duration[0] * 1000) + (duration[1] / 1000000);
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
      logger.error(`Gemini stream error: ${error.message}`, error);
      if (modelName) {
        metrics.incrementProviderErrorCount(this.name, modelName, error.status || 500);
      }
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
      // Extract text content from the candidates
      if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
        content = chunk.candidates[0].content.parts
          .filter(part => part.text)
          .map(part => part.text)
          .join("");
      }
      
      // Extract finish reason if available
      finishReason = chunk.candidates?.[0]?.finishReason || null;

      // Extract token counts if available
      const usageMetadata = chunk.usageMetadata;
      if (usageMetadata) {
        promptTokens = usageMetadata.promptTokenCount || 0;
        completionTokens = usageMetadata.candidatesTokenCount || 0;
        totalTokens = usageMetadata.totalTokenCount || 0;
      }
    } catch (e) {
      logger.error("Error parsing Gemini stream chunk:", e, chunk);
    }
    
    return {
      id: `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
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
      latency: latency || 0,
      raw: chunk
    };
  }
}

export default GeminiProvider; 