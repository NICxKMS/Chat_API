/**
 * OpenRouter Provider Implementation
 * Provides access to multiple LLM APIs through a single interface
 * Efficiently integrates with OpenRouter's API
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import BaseProvider, {
  ProviderConfig,
  ChatCompletionOptions,
  ProviderResponse,
  RawProviderResponse,
  ProviderModel
} from './BaseProvider';
import { createBreaker } from '../utils/circuitBreaker';
import * as metrics from '../utils/metrics';

interface OpenRouterConfig extends ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  models?: string[];
  defaultModel?: string;
  dynamicModelLoading?: boolean;
}

interface OpenRouterCompletionOptions {
  model: string;
  messages: {
    role: string;
    content: string;
    name?: string;
  }[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
  [key: string]: any;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenRouterProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private client: AxiosInstance;
  private completionBreaker: any; // Using 'any' for circuit breaker since it's a complex type

  constructor(config: OpenRouterConfig) {
    super(config);
    this.name = 'openrouter';
    
    // Configure HTTP client settings
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
    
    // Initialize HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    // Extract API version info
    this.apiVersionInfo = {
      version: 'v1',
      lastUpdated: new Date().toISOString()
    };
    
    // Set up circuit breaker for API calls
    this.completionBreaker = createBreaker(`${this.name}-completion`, 
      ((options: unknown) => this._rawChatCompletion(options as OpenRouterCompletionOptions)) as (...args: unknown[]) => Promise<unknown>,
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
  isValidApiKey(apiKey: string): boolean {
    // Check for the new OpenRouter API key format (sk-or-v1-...)
    if (apiKey.startsWith('sk-or-v1-')) {
      return true;
    }
    
    // Otherwise check if it's a valid JWT (three sections separated by dots)
    const jwtParts = apiKey.split('.');
    return jwtParts.length === 3;
  }

  /**
   * Get available models from OpenRouter
   */
  async getModels(): Promise<ProviderModel[]> {
    try {
      // Start with hardcoded models (if any) for fast initial response
      let models: ProviderModel[] = (this.config.models || []).map(id => ({
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
          const response = await this.client.get('/models');
          
          if (response.data && Array.isArray(response.data.data)) {
            // Process each model from the API
            const dynamicModels: ProviderModel[] = response.data.data.map((model: any) => {
              return {
                id: model.id,
                name: model.name || model.id,
                provider: this.name,
                tokenLimit: model.context_length || 8192,
                features: {
                  streaming: model.features?.includes('streaming') || true,
                  vision: model.features?.includes('vision') || false,
                  json: model.features?.includes('json') || false,
                  tools: model.features?.includes('tools') || false,
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
          console.warn(`Failed to dynamically load OpenRouter models: ${(error as Error).message}`);
        }
      }
      
      return models;
    } catch (error) {
      console.error(`OpenRouter getModels error: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Handle API errors with better diagnostics
   */
  private _handleApiError(error: Error | AxiosError, context = 'API call'): void {
    if (axios.isAxiosError(error)) {
      // Extract detailed error information
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const data = error.response?.data;
      
      // Check for authentication errors
      if (status === 401 || status === 403) {
        console.error(`OpenRouter authentication error (${status}): ${statusText}`);
        console.error('Please verify your API key is valid and properly formatted');
        // Log any clerk auth messages if present
        if (error.response?.headers?.['x-clerk-auth-message']) {
          console.error(`Auth details: ${error.response.headers['x-clerk-auth-message']}`);
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
  async chatCompletion(options: ChatCompletionOptions): Promise<ProviderResponse> {
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
        'success'
      );
      
      return response;
    } catch (error) {
      // Use enhanced error handling
      this._handleApiError(error as Error, `ChatCompletion with model ${options.model}`);
      
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
  private async _rawChatCompletion(options: OpenRouterCompletionOptions): Promise<ProviderResponse> {
    // Prepare request body for OpenRouter API (OpenAI-compatible)
    const requestBody: OpenRouterCompletionOptions = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: false
    };
    
    // Call OpenRouter API directly
    const response = await this.client.post<OpenRouterResponse>('/chat/completions', requestBody);
    
    // Extract the content from the response
    const responseData = response.data;
    const content = responseData.choices[0]?.message?.content || '';
    const role = responseData.choices[0]?.message?.role || 'assistant';
    const finishReason = responseData.choices[0]?.finish_reason || '';
    
    // Return normalized response
    return this.normalizeResponse({
      model: options.model,
      id: responseData.id,
      content,
      role,
      finish_reason: finishReason,
      created: responseData.created,
      usage: responseData.usage
    });
  }
  
  /**
   * Fallback function for circuit breaker failures
   */
  private async _completionFallback(options: OpenRouterCompletionOptions, error: Error): Promise<ProviderResponse> {
    console.warn(`Using fallback for OpenRouter completion (${options.model}): ${error.message}`);
    
    let errorMessage = "I'm sorry, I'm currently experiencing connectivity issues with the OpenRouter API. Please try again in a moment.";
    
    // Add more specific error message for auth issues
    if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
      errorMessage = "I'm unable to connect to OpenRouter due to an authentication issue. Please check that your API key is valid and has sufficient permissions.";
    }
    
    // Return a normalized error response
    return this.normalizeResponse({
      model: options.model,
      id: `openrouter-error-${Date.now()}`,
      content: errorMessage,
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

export default OpenRouterProvider; 