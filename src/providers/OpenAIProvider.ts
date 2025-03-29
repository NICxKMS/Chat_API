/**
 * OpenAI Provider Implementation
 * Efficiently integrates with OpenAI's API using their official SDK
 */
import { OpenAI } from 'openai';
import BaseProvider, { 
  ProviderConfig, 
  ChatCompletionOptions, 
  ProviderResponse,
  RawProviderResponse,
  ProviderModel
} from './BaseProvider';
import { createBreaker } from '../utils/circuitBreaker';
import * as metrics from '../utils/metrics';

interface OpenAIConfig extends ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  models?: string[];
  defaultModel?: string;
  dynamicModelLoading?: boolean;
}

interface OpenAICompletionOptions {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    name?: string;
  }>;
  temperature: number;
  max_tokens: number;
  stream: boolean;
  [key: string]: any;
}

class OpenAIProvider extends BaseProvider {
  private client: OpenAI;
  private completionBreaker: any; // Using 'any' for circuit breaker since it's a complex type
  private cachedModels: ProviderModel[] = [];

  constructor(config: OpenAIConfig) {
    super(config);
    this.name = 'openai';
    
    // Initialize OpenAI SDK with custom configuration
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries || 3
    });
    
    // Extract API version info
    this.apiVersionInfo = {
      version: 'v1',
      lastUpdated: new Date().toISOString()
    };
    
    // Set up circuit breaker for API calls
    this.completionBreaker = createBreaker(`${this.name}-completion`, 
      ((options: unknown) => this._rawChatCompletion(options as OpenAICompletionOptions)) as (...args: unknown[]) => Promise<unknown>,
      {
        failureThreshold: 3,
        resetTimeout: 30000
      }
    );
  }

  /**
   * Get available models from OpenAI
   */
  async getModels(): Promise<ProviderModel[]> {
    try {
      // Check if we have a cached model list first
      if (this.cachedModels.length > 0) {
        return this.cachedModels;
      }
      
      // Call the OpenAI API to get available models
      const response = await this.client.models.list();
      
      // Filter models (optionally)
      let filteredModels = response.data
        .filter(model => model.id.startsWith('gpt-'))
        .map(model => ({
          id: model.id,
          name: model.id,
          provider: this.name,
          tokenLimit: this._getTokenLimit(model.id),
          features: this._getModelFeatures(model.id)
        }));
      
      // If specific models were configured, filter to only those
      if (this.config.models && this.config.models.length > 0) {
        filteredModels = filteredModels.filter(model => 
          this.config.models?.includes(model.id)
        );
      }
      
      // Cache the models
      this.cachedModels = filteredModels;
      
      return filteredModels;
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      
      // Return empty array or use fallback models from config
      return this.config.models?.map(id => ({
        id,
        name: id,
        provider: this.name,
        tokenLimit: this._getTokenLimit(id),
        features: this._getModelFeatures(id)
      })) || [];
    }
  }

  /**
   * Get token limit for a model
   */
  private _getTokenLimit(modelId: string): number {
    const tokenLimits: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384
    };
    
    // Match model to its base version (without date suffix)
    const baseModel = Object.keys(tokenLimits).find(base => 
      modelId.startsWith(base)
    );
    
    return baseModel ? tokenLimits[baseModel] : 4096; // Default to 4K
  }
  
  /**
   * Get features supported by a model
   */
  private _getModelFeatures(modelId: string): Record<string, boolean> {
    // Default features
    const features = {
      vision: false,
      streaming: true,
      functionCalling: false,
      tools: false,
      json: false,
      system: true
    };
    
    // GPT-4 Vision models
    if (modelId.includes('vision') || modelId.includes('gpt-4-turbo') || modelId.includes('gpt-4o')) {
      features.vision = true;
    }
    
    // Tool/function calling models
    if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5-turbo')) {
      features.functionCalling = true;
      features.tools = true;
    }
    
    // JSON mode support
    if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5-turbo')) {
      features.json = true;
    }
    
    return features;
  }

  /**
   * Send a chat completion request to OpenAI
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
      
      // Use circuit breaker for API calls
      const response = await this.completionBreaker.fire(apiOptions);
      
      // Record successful API call
      metrics.incrementProviderRequestCount(
        this.name,
        modelName,
        'success'
      );
      
      return response;
    } catch (error) {
      console.error(`OpenAI chatCompletion error: ${(error as Error).message}`);
      
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
  private async _rawChatCompletion(options: OpenAICompletionOptions): Promise<ProviderResponse> {
    try {
      // Start timer for latency tracking
      const startTime = Date.now();

      // Make API request - use type assertion to satisfy TypeScript
      const response = await this.client.chat.completions.create({
        model: options.model,
        messages: options.messages as any, // Type assertion to avoid message format issues
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
        stop: options.stop,
        stream: false,
        n: 1
      });
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Normalize response
      return this._normalizeResponse(response, options.model, latency);
    } catch (error) {
      console.error('OpenAI API error:', error);

      // Return error response
      const errorMessage = error instanceof Error ? error.message : 'Unknown OpenAI API error';
      
      return {
        id: `openai-error-${Date.now()}`,
        model: options.model,
        provider: this.name,
        createdAt: new Date().toISOString(),
        content: `Error: ${errorMessage}`,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        },
        latency: 0,
        finishReason: 'error',
        errorDetails: {
          message: errorMessage,
          type: 'provider_error',
          param: null,
          code: error instanceof Error && 'status' in error ? (error as any).status : '500'
        }
      };
    }
  }
  
  /**
   * Normalize the OpenAI response to our standard format
   */
  private _normalizeResponse(response: any, model: string, latency: number): ProviderResponse {
    try {
      // Convert from OpenAI format to our standard format
      return {
        id: response.id || `openai-${Date.now()}`,
        model: model,
        provider: this.name,
        createdAt: new Date(response.created * 1000).toISOString(),
        content: response.choices[0].message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        latency,
        finishReason: response.choices[0].finish_reason || 'unknown',
        raw: response
      };
    } catch (error) {
      console.error('Error normalizing OpenAI response:', error);
      
      // Fallback response if normalization fails
      return {
        id: `openai-error-${Date.now()}`,
        model: model,
        provider: this.name,
        createdAt: new Date().toISOString(),
        content: 'Error processing response from OpenAI',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        },
        latency: 0,
        finishReason: 'error',
        errorDetails: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'provider_error',
          param: null,
          code: '500'
        }
      };
    }
  }
}

export default OpenAIProvider; 