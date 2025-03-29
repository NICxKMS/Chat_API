/**
 * Gemini Provider Implementation
 * Integrates with Google's Generative AI SDK for Gemini models
 */
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import axios from 'axios';
import BaseProvider, {
  ProviderConfig,
  ChatCompletionOptions,
  ProviderResponse,
  ChatMessage,
  ProviderModel,
  ProviderModelFeatures
} from './BaseProvider';
import { createBreaker } from '../utils/circuitBreaker';
import * as metrics from '../utils/metrics';

interface GeminiConfig extends ProviderConfig {
  apiKey: string;
  apiVersion?: string;
  timeout?: number;
  maxRetries?: number;
  models?: string[];
  defaultModel?: string;
  dynamicModelLoading?: boolean;
}

interface GeminiModelOptions {
  model: string;
  [key: string]: any;
}

interface GeminiChatHistory {
  role: string;
  parts: Array<{text: string}>;
}

interface GeminiGetModelsOptions {
  includeExperimental?: boolean;
  includeInternal?: boolean;
  [key: string]: any;
}

interface GeminiProviderInfoOptions {
  includeInternal?: boolean;
  [key: string]: any;
}

class GeminiProvider extends BaseProvider {
  private genAI: GoogleGenerativeAI;
  private completionBreaker: any; // Using 'any' for circuit breaker since it's a complex type
  private hasValidApiKey: boolean;
  private apiVersion: string;
  private availableModels: string[];

  constructor(config: GeminiConfig) {
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
    
    // Store API version from config or environment
    this.apiVersion = config.apiVersion || process.env.GEMINI_API_VERSION || 'v1';
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
      ((options: unknown) => this._rawChatCompletion(options as ChatCompletionOptions)) as (...args: unknown[]) => Promise<unknown>,
      {
        failureThreshold: 3,
        resetTimeout: 30000
      }
    );
    
    // Initialize with config models
    this.availableModels = this.config.models || [];
    
    // Log initialization
    console.log(`GeminiProvider initialized successfully${!this.hasValidApiKey ? ' (with limited functionality - no API key)' : ''}`);
  }

  /**
   * Get available models from Google Generative AI
   */
  async getModels(options: GeminiGetModelsOptions = {}): Promise<ProviderModel[]> {
    try {
      // Start with hardcoded models for fast initial response
      let modelIds = this.config.models || [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro'
      ];
      
      // Dynamically fetch models if enabled
      if ((this.config as GeminiConfig).dynamicModelLoading) {
        try {
          // Use Axios to directly call the models endpoint
          // The SDK doesn't expose a models listing method yet
          const apiKey = (this.config as GeminiConfig).apiKey;
          const baseUrl = `https://generativelanguage.googleapis.com/${this.apiVersion}`;
          
          const response = await axios.get(`${baseUrl}/models`, {
            headers: {
              'Content-Type': 'application/json'
            },
            params: {
              key: apiKey
            }
          });
          
          // Extract model IDs from response
          if (response.data && response.data.models) {
            const dynamicModels = response.data.models
              .filter((model: any) => model.name.startsWith('models/gemini'))
              .map((model: any) => model.name.replace('models/', ''));
              
            console.log(`Found ${dynamicModels.length} Gemini models from API:`, dynamicModels);
            
            // Add new models to our list
            dynamicModels.forEach((model: string) => {
              if (!modelIds.includes(model)) {
                modelIds.push(model);
              }
            });
          }
        } catch (error) {
          console.warn(`Failed to dynamically load Gemini models: ${(error as Error).message}`);
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
      console.error(`Gemini getModels error: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * Format the model name for display
   */
  private formatModelName(modelId: string): string {
    return modelId
      .replace('gemini-', 'Gemini ')
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  
  /**
   * Get token limit for a model
   */
  private getTokenLimit(modelId: string): number {
    const limits: Record<string, number> = {
      'gemini-1.5-pro': 1000000,  // 1M tokens
      'gemini-1.5-flash': 1000000, // 1M tokens
      'gemini-1.0-pro': 32768     // 32K tokens
    };
    
    return limits[modelId] || 32768; // default to 32K
  }
  
  /**
   * Get features supported by a model
   */
  private getModelFeatures(modelId: string): ProviderModelFeatures {
    // Base features all models support
    const features: ProviderModelFeatures = {
      vision: true,
      streaming: true,
      tools: false,
      functionCalling: false,
      json: false,
      system: true
    };
    
    // Gemini 1.5 specific features
    if (modelId.includes('gemini-1.5')) {
      features.tools = true;
      features.functionCalling = true;
      features.json = true;
    }
    
    return features;
  }

  /**
   * Get info about this provider and its models
   */
  async getProvidersInfo(options: GeminiProviderInfoOptions = {}): Promise<{
    name: string;
    models: ProviderModel[];
    defaultModel: string;
    features?: Record<string, any>;
    apiVersion?: string;
  }> {
    try {
      // First get all available models
      await this.fetchAvailableModels(options.includeInternal);
      
      // Convert to ProviderModel objects
      const models = await this.getModels();
      
      // Determine default model
      const defaultModel = this.config.defaultModel || (models.length > 0 ? models[0].id : 'gemini-1.5-flash');
      
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
      console.error(`Error in getProvidersInfo: ${(error as Error).message}`);
      
      // Return at least some default information
      return {
        name: this.name,
        models: [],
        defaultModel: this.config.defaultModel || 'gemini-1.5-flash',
        features: {
          streaming: true,
          vision: true
        },
        apiVersion: this.apiVersionInfo.version
      };
    }
  }

  /**
   * Fetch available models including internal/experimental ones if requested
   */
  async fetchAvailableModels(includeInternal = false): Promise<string[]> {
    try {
      // First, ensure we have the fallback models
      const fallbackModels = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro'
      ];
      
      // Start with configured models from config.js
      if (this.config.models && this.config.models.length > 0) {
        // Keep any existing models we might have already loaded
        const existingModels = new Set(this.availableModels);
        
        // Add config models to the existing set
        this.config.models.forEach(model => existingModels.add(model));
        
        // Ensure fallback models are included
        fallbackModels.forEach(model => existingModels.add(model));
        
        // Convert back to array
        this.availableModels = Array.from(existingModels);
      } else {
        // If no config models, use fallback models, but keep any we've already loaded
        const existingModels = new Set(this.availableModels);
        fallbackModels.forEach(model => existingModels.add(model));
        this.availableModels = Array.from(existingModels);
      }
      
      // Add internal/experimental models if requested
      if (includeInternal) {
        const internalModels = [
          'gemini-1.0-pro-latest',
          'gemini-1.0-pro-vision-latest',
          'gemini-1.5-flash-latest',
          'gemini-1.5-pro-latest',
          'gemini-1.5-pro-vision-latest',
          'gemini-2.0-flash-exp',
          'gemini-2.0-pro-exp'
        ];
        
        // Add to existing set
        const existingModels = new Set(this.availableModels);
        internalModels.forEach(model => existingModels.add(model));
        this.availableModels = Array.from(existingModels);
      }
      
      // Update default model if it doesn't exist in the model list
      if (!this.availableModels.includes(this.config.defaultModel || '')) {
        this.config.defaultModel = this.availableModels[0];
      }
      
      // Dynamically load models if enabled
      if ((this.config as GeminiConfig).dynamicModelLoading) {
        try {
          // Use Axios to directly call the models endpoint
          const apiKey = (this.config as GeminiConfig).apiKey;
          const baseUrl = `https://generativelanguage.googleapis.com/${this.apiVersion}`;
          
          const response = await axios.get(`${baseUrl}/models`, {
            headers: {
              'Content-Type': 'application/json'
            },
            params: {
              key: apiKey
            }
          });
          
          // Extract and filter Gemini models
          if (response.data && response.data.models) {
            const dynamicModels = response.data.models
              .filter((model: any) => model.name.startsWith('models/gemini'))
              .map((model: any) => model.name.replace('models/', ''));
              
            console.log(`Found ${dynamicModels.length} Gemini models from API:`, dynamicModels);
            
            // Create a set to avoid duplicates (preserve existing models)
            const modelSet = new Set(this.availableModels);
            
            // Add all dynamically loaded models to the set
            dynamicModels.forEach((model: string) => modelSet.add(model));
            
            // Convert back to array
            this.availableModels = Array.from(modelSet);
            
            console.log(`Total available Gemini models (after dynamic loading): ${this.availableModels.length}`);
          }
        } catch (error) {
          console.warn(`Failed to dynamically load Gemini models: ${(error as Error).message}`);
          // We continue with the models we already have
        }
      }
      
      return this.availableModels;
    } catch (error) {
      console.error(`Error fetching Gemini models: ${(error as Error).message}`);
      // Return at least fallback models
      return [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro'
      ];
    }
  }

  /**
   * Get provider info with optionally included internal models
   */
  getInfo(): { name: string; models: string[]; defaultModel?: string; apiVersion: string; lastUpdated: string; } {
    return {
      name: this.name,
      models: this.availableModels || [],
      defaultModel: this.config.defaultModel,
      apiVersion: this.apiVersionInfo.version,
      lastUpdated: this.apiVersionInfo.lastUpdated
    };
  }

  /**
   * Send a chat completion request to Gemini
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ProviderResponse> {
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
      const response = await this.completionBreaker.fire(apiOptions);
      
      // Record successful API call
      metrics.incrementProviderRequestCount(
        this.name,
        modelName,
        'success'
      );
      
      return response;
    } catch (error) {
      console.error(`Gemini chatCompletion error: ${(error as Error).message}`);
      
      // Record failed API call
      metrics.incrementProviderRequestCount(
        this.name,
        options.model,
        'error'
      );
      
      throw error;
    }
  }
  
  /**
   * Raw chat completion method (used by circuit breaker)
   */
  private async _rawChatCompletion(options: ChatCompletionOptions): Promise<ProviderResponse> {
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
      if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
        console.error('Gemini API call failed: Invalid API key (401 Unauthorized)');
        return this._completionFallback(options, new Error('Invalid API key'));
      }
      
      console.error(`Gemini raw chat completion error: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * Process messages to prepare for Gemini chat format
   */
  private _processMessages(messages: ChatMessage[]): { 
    history: GeminiChatHistory[]; 
    prompt: string; 
    systemPrompt: string 
  } {
    const history: GeminiChatHistory[] = [];
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
        const userMsg: GeminiChatHistory = { role: 'user', parts: [{ text: msg.content }] };
        history.push(userMsg);
        
        // If there's a next message and it's from assistant, add it
        if (i + 1 < messages.length && messages[i + 1].role === 'assistant') {
          const assistantMsg: GeminiChatHistory = { 
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
  private async _completionFallback(options: ChatCompletionOptions, error: Error): Promise<ProviderResponse> {
    console.warn(`Using fallback for Gemini completion (${options.model}): ${error.message}`);
    
    let fallbackContent = '';
    
    // If API key is missing, give a specific helpful message
    if (!this.hasValidApiKey || 
        error.message.includes('API key') || 
        (axios.isAxiosError(error) && error.response && error.response.status === 401)) {
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
   * @param text - The text to estimate tokens for
   * @returns Estimated token count
   */
  private _estimateTokens(text: string): number {
    if (!text) return 0;
    
    // Very rough estimation: ~1.3 tokens per word
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
}

export default GeminiProvider; 