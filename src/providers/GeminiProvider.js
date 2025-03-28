/**
 * Gemini Provider Implementation
 * Integrates with Google's Generative AI SDK for Gemini models
 */
const { GoogleGenerativeAI, GenerativeModel } = require('@google/generative-ai');
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
  }

  /**
   * Get available models (prioritizes config-provided models)
   * Uses the v1beta endpoint to list available models
   */
  async getModels() {
    try {
      // Start with hardcoded models for initial response
      let models = this.config.models || [];
      
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
    // Get a GenerativeModel instance for this model
    const model = this.genAI.getGenerativeModel({ model: options.model });
    
    // Convert message format from OpenAI to Gemini
    const geminiMessages = this._convertToGeminiMessages(options.messages);
    
    // Define generation config
    const generationConfig = {
      temperature: options.temperature,
      maxOutputTokens: options.max_tokens,
      topK: options.top_k || 40,
      topP: options.top_p || 0.95
    };
    
    // Call Gemini API directly
    const response = await model.generateContent({
      contents: geminiMessages,
      generationConfig
    });
    
    // Extract response data
    const result = response.response;
    const content = result.text() || '';
    
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
  }
  
  /**
   * Raw streaming implementation (used by circuit breaker)
   */
  async _rawStreamChatCompletion(options, onChunk) {
    // Get a GenerativeModel instance for this model
    const model = this.genAI.getGenerativeModel({ model: options.model });
    
    // Convert message format from OpenAI to Gemini
    const geminiMessages = this._convertToGeminiMessages(options.messages);
    
    // Define generation config
    const generationConfig = {
      temperature: options.temperature,
      maxOutputTokens: options.max_tokens,
      topK: options.top_k || 40,
      topP: options.top_p || 0.95
    };
    
    // Start streaming
    const streamingResponse = await model.generateContentStream({
      contents: geminiMessages,
      generationConfig
    });

    // Track collected text to avoid redundant chunks
    let collectedText = '';
    
    // Process the stream
    for await (const chunk of streamingResponse.stream) {
      const partialText = chunk.text() || '';
      
      // Only send the incremental portion
      if (partialText && partialText.length > 0) {
        const newContent = partialText.substring(collectedText.length);
        collectedText = partialText;
        
        if (newContent.length > 0) {
          onChunk(this.normalizeStreamChunk({
            model: options.model,
            id: `gemini-chunk-${Date.now()}`,
            content: newContent,
            role: 'assistant',
            finish_reason: null
          }));
        }
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
  
  /**
   * Convert messages from OpenAI format to Gemini format
   */
  _convertToGeminiMessages(messages) {
    // For Gemini, we need to convert the message format
    const roles = {
      system: 'system',
      user: 'user',
      assistant: 'model'
    };
    
    // Build the chat object
    const formattedMessages = [];
    
    for (const msg of messages) {
      // Skip invalid messages
      if (!msg.role || !msg.content) continue;
      
      // Map the role or use default
      const role = roles[msg.role] || 'user';
      
      // Add to formatted messages
      if (role === 'system') {
        // System messages need special handling in Gemini
        // Add as user message with a prefix
        formattedMessages.push({
          role: 'user',
          parts: [{text: `System instruction: ${msg.content}`}]
        });
      } else {
        formattedMessages.push({
          role,
          parts: [{text: msg.content}]
        });
      }
    }
    
    return formattedMessages;
  }
}

module.exports = GeminiProvider; 