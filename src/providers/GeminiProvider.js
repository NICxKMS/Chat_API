/**
 * Gemini Provider Implementation
 * Integrates with Google's Generative AI SDK for Gemini models
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const { createBreaker } = require('../utils/circuitBreaker');
const metrics = require('../utils/metrics');

class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'gemini';
    this.supportsStreaming = true;
    
    // Initialize Google Generative AI SDK
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    
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
    
    // Initialize with config models
    this.availableModels = this.config.models || [];
  }

  /**
   * Get available models (prioritizes config-provided models)
   * Uses the v1beta endpoint to list available models
   */
  async getModels() {
    try {
      // Start with hardcoded models for initial response
      let models = this.availableModels;
      
      // Dynamically fetch models if enabled
      if (this.config.dynamicModelLoading) {
        try {
          // Fetch models from Gemini API using the v1beta endpoint
          const modelListUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`;
          
          const response = await axios.get(modelListUrl);
          
          if (response.data && response.data.models) {
            // Extract model names from response and format them for our API
            const dynamicModels = response.data.models
              .filter(model => model.name)
              .map(model => {
                // Extract just the model name from the full path
                // Example format: "models/gemini-1.5-pro" -> "gemini-1.5-pro"
                const fullName = model.name;
                return fullName.split('/').pop();
              });
            
            // Combine with hardcoded models, removing duplicates
            models = [...new Set([...models, ...dynamicModels])];
            this.availableModels = models; // Update the instance variable
            
            // Record successful API call
            metrics.providerRequestCounter.inc({
              provider: this.name,
              model: 'list',
              status: 'success'
            });
          }
        } catch (error) {
          console.warn(`Failed to dynamically load Gemini models: ${error.message}`);
          
          // Record failed API call
          metrics.providerRequestCounter.inc({
            provider: this.name,
            model: 'list',
            status: 'error'
          });
        }
      }
      
      // Sort models alphabetically for consistent order
      return models.sort();
      
    } catch (error) {
      console.error(`Gemini getModels error: ${error.message}`);
      return this.config.models || [];
    }
  }
  
  /**
   * Fetch available models including internal/experimental ones if requested
   */
  async fetchAvailableModels(includeInternal = false) {
    try {
      // First, use the models from config.js
      if (this.config.models && this.config.models.length > 0) {
        this.availableModels = [...this.config.models];
      } else {
        // Fallback to common models if no models in config
        this.availableModels = [
          'gemini-pro',
          'gemini-pro-vision',
          'gemini-1.5-pro',
          'gemini-1.5-flash'
        ];
      }
      
      // For internal/experimental models based on includeInternal flag
      if (includeInternal) {
        // Add internal models that may not be in the config
        const internalModels = [
          'gemini-1.0-pro-latest',
          'gemini-1.0-pro-vision-latest',
          'gemini-1.5-flash-latest',
          'gemini-1.5-pro-latest',
          'gemini-1.5-pro-vision-latest',
          'gemini-2-0-flash-experimental',
          'gemini-2-0-pro-experimental',
          'gemini-2-5-pro-experimental',
          'gemini-3-pro-experimental'
        ];
        
        // Add internal models that don't already exist in the list
        for (const model of internalModels) {
          if (!this.availableModels.includes(model)) {
            this.availableModels.push(model);
          }
        }
      }
      
      // Update default model if it doesn't exist in the model list
      if (!this.availableModels.includes(this.config.defaultModel)) {
        this.config.defaultModel = this.availableModels[0];
      }
      
      // Also update from API if dynamic loading is enabled
      if (this.config.dynamicModelLoading) {
        await this.getModels();
      }
      
      return this.availableModels;
    } catch (error) {
      console.error(`Error fetching Gemini models: ${error.message}`);
      // Fall back to config models if API call fails
      return this.config.models || [];
    }
  }

  /**
   * Get provider info with optionally included internal models
   */
  async getInfo(options = {}) {
    await this.fetchAvailableModels(options?.includeInternal);
    
    return {
      name: this.name,
      models: this.availableModels,
      defaultModel: this.config.defaultModel,
      supportsStreaming: this.supportsStreaming,
      apiVersion: this.apiVersionInfo.version,
      lastUpdated: this.apiVersionInfo.lastUpdated
    };
  }

  /**
   * Send a chat completion request to Gemini
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
      console.error(`Gemini chatCompletion error: ${error.message}`);
      
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
   * Stream a chat completion from Gemini
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
      console.error(`Gemini streamChatCompletion error: ${error.message}`);
      
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
    try {
      const geminiModel = this.genAI.getGenerativeModel({ 
        model: options.model
      });

      // Process messages for Gemini format
      const { history, prompt, systemPrompt } = this._processMessages(options.messages);
      
      // Start a chat session
      const chat = geminiModel.startChat({
        history,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.max_tokens,
        }
      });
      
      // Prepend system prompt if available
      let finalPrompt = prompt;
      if (systemPrompt) {
        finalPrompt = `${systemPrompt}\n\n${prompt}`;
      }
      
      // Send the message
      const result = await chat.sendMessage(finalPrompt);
      const content = result.response.text() || '';
      
      // Return normalized response
      return this.normalizeResponse({
        model: options.model,
        id: `gemini-${Date.now()}`,
        content,
        role: 'assistant',
        finish_reason: 'stop',
        created: Date.now() / 1000,
        usage: {
          prompt_tokens: -1, // Gemini doesn't provide token counts
          completion_tokens: -1,
          total_tokens: -1
        }
      });
    } catch (error) {
      console.error(`Gemini API Error: ${error.message}`);
      throw new Error(`Gemini API Error: ${error.message}`);
    }
  }
  
  /**
   * Raw streaming implementation (used by circuit breaker)
   * Fixed to ensure no tokens are dropped during streaming
   */
  async _rawStreamChatCompletion(options, onChunk) {
    try {
      const geminiModel = this.genAI.getGenerativeModel({ 
        model: options.model
      });

      // Process messages for Gemini format
      const { history, prompt, systemPrompt } = this._processMessages(options.messages);
      
      // Start a chat session
      const chat = geminiModel.startChat({
        history,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.max_tokens,
        }
      });
      
      // Prepend system prompt if available
      let finalPrompt = prompt;
      if (systemPrompt) {
        finalPrompt = `${systemPrompt}\n\n${prompt}`;
      }
      
      // Send the message with streaming
      const result = await chat.sendMessageStream(finalPrompt);
      
      // Process the stream chunks directly
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          // Send each non-empty chunk as it arrives
          onChunk(this.normalizeStreamChunk({
            model: options.model,
            id: `gemini-chunk-${Date.now()}`,
            content: chunkText,
            role: 'assistant',
            finish_reason: null
          }));
        }
      }
      
      // Send final chunk with finish reason
      onChunk(this.normalizeStreamChunk({
        model: options.model,
        id: `gemini-chunk-${Date.now()}`,
        content: '',
        role: 'assistant',
        finish_reason: 'stop'
      }));
      
    } catch (error) {
      console.error(`Gemini API Streaming Error: ${error.message}`);
      throw new Error(`Gemini API Streaming Error: ${error.message}`);
    }
  }
  
  /**
   * Process messages to prepare for Gemini chat format
   */
  _processMessages(messages) {
    const history = [];
    let systemPrompt = '';
    let prompt = '';
    
    // Extract system message if present
    if (messages.length > 0 && messages[0].role === 'system') {
      systemPrompt = messages[0].content;
      messages = messages.slice(1); // Remove system message from regular messages
    }
    
    // Build conversation history (excluding the most recent user message)
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        const userMsg = { role: 'user', parts: [{ text: msg.content }] };
        history.push(userMsg);
        
        // If there's a next message and it's from assistant, add it
        if (i + 1 < messages.length && messages[i + 1].role === 'assistant') {
          const assistantMsg = { 
            role: 'model', 
            parts: [{ text: messages[i + 1].content }] 
          };
          history.push(assistantMsg);
          i++; // Skip the assistant message in the next iteration
        }
      }
    }
    
    // Get the most recent user message for the prompt
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      prompt = lastMsg.content;
    }
    
    return { history, prompt, systemPrompt };
  }
  
  /**
   * Fallback function for circuit breaker failures
   */
  async _completionFallback(options, error) {
    console.warn(`Using fallback for Gemini completion (${options.model}): ${error.message}`);
    
    // Return a normalized error response
    return this.normalizeResponse({
      model: options.model,
      id: `gemini-error-${Date.now()}`,
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

module.exports = GeminiProvider; 