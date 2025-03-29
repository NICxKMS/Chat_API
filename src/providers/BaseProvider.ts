/**
 * BaseProvider abstract class
 * Defines the interface that all AI provider implementations must follow
 */

// Provider configuration interface
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  models?: string[];
  [key: string]: any;
}

// Provider Model Features
export interface ProviderModelFeatures {
  vision?: boolean;
  streaming?: boolean;
  functionCalling?: boolean;
  tools?: boolean;
  json?: boolean;
  system?: boolean;
}

// Provider Model Interface
export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  tokenLimit: number;
  features?: ProviderModelFeatures;
}

// Error Details Interface
export interface ErrorDetails {
  message: string;
  type: string;
  param: string | null;
  code: string;
}

// Chat message interface
export interface ChatMessage {
  role: string;
  content: string;
  name?: string;
}

// Chat completion options interface
export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}

// Provider response interface
export interface ProviderResponse {
  id: string;
  model: string;
  provider: string;
  createdAt: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  finishReason: string;
  errorDetails?: ErrorDetails;
  raw?: any; // Raw response from the provider
}

// Raw provider response interface
export interface RawProviderResponse {
  model: string;
  id: string;
  content: string;
  role: string;
  finish_reason: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

abstract class BaseProvider {
  public name: string;
  public config: ProviderConfig;
  public apiVersionInfo: {
    version: string;
    lastUpdated: string;
  };

  /**
   * Create a new provider
   */
  constructor(config: ProviderConfig) {
    if (this.constructor === BaseProvider) {
      throw new Error('BaseProvider is an abstract class and cannot be instantiated directly');
    }
    
    this.name = 'base';
    this.config = config;
    this.apiVersionInfo = {
      version: 'v1',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get available models from the provider
   * Should be implemented by each provider
   */
  abstract getModels(): Promise<ProviderModel[]>;

  /**
   * Get info about the provider
   */
  getInfo(): { name: string; models: string[]; defaultModel?: string; apiVersion: string; lastUpdated: string; } {
    return {
      name: this.name,
      models: [], // This will be populated by the child class
      defaultModel: this.config.defaultModel,
      apiVersion: this.apiVersionInfo.version,
      lastUpdated: this.apiVersionInfo.lastUpdated
    };
  }

  /**
   * Send a chat completion request
   * Must be implemented by each provider
   */
  abstract chatCompletion(options: any): Promise<ProviderResponse>;

  /**
   * Normalize a provider response to a standard format
   */
  protected normalizeResponse(response: any): ProviderResponse {
    return {
      id: response.id || `response-${Date.now()}`,
      model: response.model || 'unknown',
      provider: this.name,
      createdAt: response.created 
        ? new Date(response.created * 1000).toISOString() 
        : new Date().toISOString(),
      content: response.content || '',
      usage: {
        promptTokens: response.usage?.prompt_tokens || response.usage?.input_tokens || 0,
        completionTokens: response.usage?.completion_tokens || response.usage?.output_tokens || 0,
        totalTokens: response.usage?.total_tokens || 
          (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      latency: 0, // Should be set by the specific provider
      finishReason: response.finish_reason || response.stop_reason || 'unknown',
      raw: response
    };
  }

  /**
   * Helper to standardize options object before sending to provider
   */
  standardizeOptions(options: ChatCompletionOptions): ChatCompletionOptions {
    const { model, messages, temperature = 0.7, max_tokens = 1000, ...rest } = options;
    
    return {
      model: model || this.config.defaultModel || '',
      messages: messages || [],
      temperature: parseFloat(temperature.toString()),
      max_tokens: parseInt(max_tokens.toString(), 10),
      ...rest
    };
  }

  /**
   * Helper to validate options before sending to provider
   * @throws Error if options are invalid
   */
  validateOptions(options: ChatCompletionOptions): void {
    const { model, messages } = options;
    
    if (!model) {
      throw new Error('Model parameter is required');
    }
    
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }
    
    messages.forEach((message, index) => {
      if (!message.role || !message.content) {
        throw new Error(`Message at index ${index} must have role and content properties`);
      }
    });
  }
}

export default BaseProvider; 