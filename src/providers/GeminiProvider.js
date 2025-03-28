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
    const model = this.genAI.getGenerativeModel({ 
      model: options.model || this.config.defaultModel 
    });
    
    // Convert messages from OpenAI format to Gemini format using the chat history approach
    const history = [];
    let systemPrompt = '';
    let messages = [...options.messages]; // Create a copy to avoid mutating the original
    
    // Extract system message if present
    const firstMsg = messages[0];
    if (firstMsg && firstMsg.role === 'system') {
      systemPrompt = firstMsg.content;
      messages = messages.slice(1);  // Remove system message from regular messages
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
    let prompt = lastMsg.content;
    
    // Prepend system prompt if available
    if (systemPrompt) {
      prompt = `${systemPrompt}\n\n${prompt}`;
    }
    
    // Start a chat session
    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.max_tokens,
        topK: options.top_k || 40,
        topP: options.top_p || 0.95
      }
    });
    
    // Get the response
    const result = await chat.sendMessage(prompt);
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
  }
  
  /**
   * Raw streaming implementation (used by circuit breaker)
   */
  async _rawStreamChatCompletion(options, onChunk) {
    // Get a GenerativeModel instance for this model
    const model = this.genAI.getGenerativeModel({ 
      model: options.model || this.config.defaultModel 
    });
    
    // Convert messages from OpenAI format to Gemini format using the chat history approach
    const history = [];
    let systemPrompt = '';
    let messages = [...options.messages]; // Create a copy to avoid mutating the original
    
    // Extract system message if present
    const firstMsg = messages[0];
    if (firstMsg && firstMsg.role === 'system') {
      systemPrompt = firstMsg.content;
      messages = messages.slice(1);  // Remove system message from regular messages
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
    let prompt = lastMsg.content;
    
    // Prepend system prompt if available
    if (systemPrompt) {
      prompt = `${systemPrompt}\n\n${prompt}`;
    }
    
    try {
      // Start a chat session
      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.max_tokens,
          topK: options.top_k || 40,
          topP: options.top_p || 0.95
        }
      });
      
      // THIS IS A COMPLETE REWRITE OF THE STREAMING APPROACH
      // Instead of trying to use the native streaming, we'll implement a proxy stream
      // that captures full responses and delivers them safely in chunks
      
      // Phase 1: Execute the full chat completion without streaming
      console.log("Gemini streaming: Using proxy stream method to prevent token dropping");
      const fullResponse = await chat.sendMessage(prompt);
      const fullText = fullResponse.response?.text() || '';
      
      if (!fullText) {
        throw new Error("Gemini returned empty response");
      }
      
      console.log(`Gemini streaming: Captured complete response (${fullText.length} chars), sending as chunks`);
      
      // Phase 2: Deliver the tokens in a controlled way
      // We'll split by characters with slightly randomized chunk sizes for natural delivery
      // This is a simulation of streaming but guarantees no tokens are dropped
      
      let deliveredSoFar = 0;
      const targetChunkSizes = [1, 2, 3]; // Simulated chunk sizes for natural delivery
      
      while (deliveredSoFar < fullText.length) {
        // Choose a random chunk size from our targets but don't exceed remaining text
        const remainingChars = fullText.length - deliveredSoFar;
        const targetSize = Math.min(
          targetChunkSizes[Math.floor(Math.random() * targetChunkSizes.length)], 
          remainingChars
        );
        
        // Get the next chunk of content
        const chunk = fullText.substring(deliveredSoFar, deliveredSoFar + targetSize);
        deliveredSoFar += chunk.length;
        
        // Determine if this is the final chunk
        const isLastChunk = deliveredSoFar >= fullText.length;
        
        // Send this chunk to the client
        if (chunk) {
          onChunk(this.normalizeStreamChunk({
            model: options.model,
            id: `gemini-chunk-${Date.now()}`,
            content: chunk,
            role: 'assistant',
            finish_reason: isLastChunk ? 'stop' : null
          }));
          
          // Add a small delay between chunks for more natural delivery
          // Only add delay if not the last chunk
          if (!isLastChunk) {
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 50)));
          }
        }
      }
      
      // Send final empty chunk if we haven't already
      if (fullText.length > 0) {
        onChunk(this.normalizeStreamChunk({
          model: options.model,
          id: `gemini-chunk-${Date.now()}`,
          content: '',
          role: 'assistant',
          finish_reason: 'stop'
        }));
      }
      
    } catch (error) {
      console.error('Error in Gemini stream processing:', error);
      
      // Send error notification through the stream
      onChunk(this.normalizeStreamChunk({
        model: options.model,
        id: `gemini-error-${Date.now()}`,
        content: `\n\nStreaming error: ${error.message}`,
        role: 'assistant',
        finish_reason: 'error'
      }));
      
      throw error;
    }
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
   * Note: This method is kept for backward compatibility but
   * the chat-based approach is preferred for most use cases
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