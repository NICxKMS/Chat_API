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
    
    // Debug API key loading
    const keyDebug = config.apiKey ? 
      `${config.apiKey.substring(0, 5)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 
      'missing';
    console.log(`Gemini provider initializing with API key: ${keyDebug}`);
    console.log(`API key loaded from env GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? 'yes' : 'no'}`);
    
    // Validate API key
    if (!config.apiKey || config.apiKey === 'dummy-key') {
      console.warn('Gemini API key is missing or set to dummy-key. Using fallback mode with limited functionality.');
      this.hasValidApiKey = false;
    } else {
      this.hasValidApiKey = true;
    }
    
    // Store API version from config
    this.apiVersion = config.apiVersion || 'v1';
    console.log(`Using Gemini API version: ${this.apiVersion}`);
    
    // Initialize Google Generative AI SDK
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    
    // Extract API version info
    this.apiVersionInfo = {
      version: this.apiVersion,
      lastUpdated: new Date().toISOString()
    };
    
    // Set up circuit breaker for API calls
    this.completionBreaker = createBreaker(`${this.name}-completion`, this._rawChatCompletion.bind(this), {
      failureThreshold: 3,
      resetTimeout: 30000,
      fallback: this._completionFallback.bind(this)
    });
    
    // Initialize with config models
    this.availableModels = this.config.models || [];
    
    // Log initialization
    console.log(`GeminiProvider initialized successfully${!this.hasValidApiKey ? ' (with limited functionality - no API key)' : ''}`);
  }

  /**
   * Get available models (prioritizes config-provided models)
   * Uses the v1beta endpoint to list available models
   */
  async getModels(options = {}) {
    try {
      // Start with hardcoded models for initial response
      let models = this.availableModels;
      
      // Include experimental models if requested
      if (options?.includeExperimental || options?.includeInternal) {
        await this.fetchAvailableModels(true);
        models = this.availableModels;
      }
      
      // Dynamically fetch models if enabled
      if (this.config.dynamicModelLoading) {
        try {
          // Verify API key is available
          if (!this.config.apiKey || this.config.apiKey === 'dummy-key') {
            console.warn('Skipping dynamic Gemini model loading: API key is missing or invalid');
            return models.sort();
          }
          
          console.debug('Attempting to dynamically load Gemini models');
          
          // Use the more reliable generativelanguage API endpoint
          // Note: Some accounts may only have access to v1beta but not v1
          // Try configured API version first, then try the alternative if that fails
          let modelListUrl = `https://generativelanguage.googleapis.com/${this.apiVersion}/models?key=${this.config.apiKey}`;
          let response;
          
          try {
            console.log(`Fetching Gemini models using ${this.apiVersion} endpoint`);
            response = await axios.get(modelListUrl, {
              timeout: 5000,
              headers: {
                'Content-Type': 'application/json'
              }
            });
          } catch (initialError) {
            // If v1 fails, try v1beta or vice versa
            const fallbackVersion = this.apiVersion === 'v1' ? 'v1beta' : 'v1';
            console.log(`Failed to fetch models with ${this.apiVersion}, trying ${fallbackVersion} endpoint`);
            
            modelListUrl = `https://generativelanguage.googleapis.com/${fallbackVersion}/models?key=${this.config.apiKey}`;
            response = await axios.get(modelListUrl, {
              timeout: 5000,
              headers: {
                'Content-Type': 'application/json'
              }
            });
          }
          
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
            
            console.log(`Successfully loaded ${dynamicModels.length} models from Gemini API`);
            
            // Combine with hardcoded models, removing duplicates
            models = [...new Set([...models, ...dynamicModels])];
            this.availableModels = models; // Update the instance variable
            
            // Record successful API call
            metrics.providerRequestCounter.inc({
              provider: this.name,
              model: 'list',
              status: 'success'
            });
          } else {
            console.warn('Response from Gemini API was empty or improperly formatted');
          }
        } catch (error) {
          // Handle specific error types
          if (error.response) {
            console.error(`Gemini model loading error: ${error.response.status} ${error.response.statusText}`);
            
            if (error.response.status === 401) {
              console.error('Gemini API key is invalid or missing (401 Unauthorized)');
            } else if (error.response.status === 403) {
              console.error('Gemini API key lacks permission to list models (403 Forbidden)');
            } else if (error.response.data && error.response.data.error) {
              console.error(`Gemini API error: ${error.response.data.error.message || JSON.stringify(error.response.data.error)}`);
            }
          } else if (error.request) {
            console.error('No response received from Gemini API:', error.message);
          } else {
            console.warn(`Failed to dynamically load Gemini models: ${error.message}`);
          }
          
          // Record failed API call
          metrics.providerRequestCounter.inc({
            provider: this.name,
            model: 'list',
            status: 'error'
          });
          
          // Use just the default models instead of failing
          console.info('Using default models from configuration instead of dynamic loading');
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
      
      // Use circuit breaker for non-streaming requests
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
   * Raw chat completion method (used by circuit breaker)
   */
  async _rawChatCompletion(options) {
    try {
      // Check if we have a valid API key
      if (!this.hasValidApiKey) {
        return this._completionFallback(options, new Error('Gemini API key is missing or invalid'));
      }
      
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
          prompt_tokens: this._estimateTokens(finalPrompt),
          completion_tokens: this._estimateTokens(content),
          total_tokens: this._estimateTokens(finalPrompt) + this._estimateTokens(content)
        }
      });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.error('Gemini API call failed: Invalid API key (401 Unauthorized)');
        return this._completionFallback(options, new Error('Invalid API key'));
      }
      
      console.error(`Gemini raw chat completion error: ${error.message}`);
      throw error;
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
    
    let fallbackContent = '';
    
    // If API key is missing, give a specific helpful message
    if (!this.hasValidApiKey || error.message.includes('API key') || (error.response && error.response.status === 401)) {
      fallbackContent = "I'm currently unable to process your request because the Gemini API key is missing or invalid. Please check your API key configuration. In the meantime, try using another AI model like OpenAI or Claude.";
    } else {
      // Generic error message
      fallbackContent = "I'm sorry, I'm currently experiencing connectivity issues with the Gemini API. Please try again in a moment or try another model provider.";
    }
    
    // Return a normalized error response
    return this.normalizeResponse({
      model: options.model,
      id: `gemini-error-${Date.now()}`,
      content: fallbackContent,
      role: 'assistant',
      finish_reason: 'error',
      created: Date.now() / 1000,
      usage: {
        prompt_tokens: this._estimateTokens(options.messages.map(m => m.content).join(' ')),
        completion_tokens: this._estimateTokens(fallbackContent),
        total_tokens: this._estimateTokens(options.messages.map(m => m.content).join(' ')) + this._estimateTokens(fallbackContent)
      }
    });
  }

  /**
   * Helper method to estimate token count for a string
   * This is a rough estimation as Gemini doesn't provide token counts
   * 
   * @param {string} text - The text to estimate tokens for
   * @returns {number} - Estimated token count
   */
  _estimateTokens(text) {
    if (!text) return 0;
    
    // Very rough estimation: ~1.3 tokens per word
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
}

module.exports = GeminiProvider; 