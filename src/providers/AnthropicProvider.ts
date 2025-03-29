/**
 * Anthropic API Provider
 * Implements the BaseProvider for Anthropic's Claude models
 */
import BaseProvider, { ProviderResponse, ProviderConfig, ProviderModel } from './BaseProvider';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createBreaker } from '../utils/circuitBreaker';
import logger from '../utils/logger';
import { promisify } from 'util';

// Anthropic API interfaces
export interface AnthropicMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface AnthropicCompletionOptions {
  model?: string;
  messages?: AnthropicMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
  stream?: boolean;
  system?: string;
}

export interface AnthropicConfig extends ProviderConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  modelFamily: string;
  maxTokens?: number;
  temperature?: number;
  top_p?: number;
  apiVersion?: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  model: string;
  stop_reason: string | null;
  content: Array<{
    type: string;
    text?: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamChunk {
  type: string;
  content?: Array<{
    type: string;
    text?: string;
  }>;
  delta?: {
    type: string;
    text?: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason?: string;
}

/**
 * Anthropic Provider implementation
 * Handles API requests to Anthropic for Claude models
 */
export class AnthropicProvider extends BaseProvider {
  protected httpClient: AxiosInstance;
  protected apiKey: string;
  protected baseUrl: string;
  protected apiVersion: string;
  protected defaultModel: string;
  protected modelFamily: string;
  protected completionBreaker: any;

  /**
   * Create a new Anthropic provider
   */
  constructor(config: AnthropicConfig) {
    super(config);
    
    this.name = 'anthropic'; // Set the provider name
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.apiVersion = config.apiVersion || '2023-06-01';
    this.defaultModel = config.defaultModel || 'claude-3-opus-20240229';
    this.modelFamily = config.modelFamily || 'claude';
    
    // Validate config
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    // Set up HTTP client
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'anthropic-version': this.apiVersion
      }
    });
    
    // Set up circuit breaker for API requests
    this.completionBreaker = createBreaker(`${this.name}-completion`, 
      (params: any) => this.rawCompletion(params), 
      {
        failureThreshold: 3,
        resetTimeout: 30000,
        errorThreshold: 50
      }
    );
    
    logger.info(`Anthropic provider initialized with model family: ${this.modelFamily}`);
  }
  
  /**
   * Get available models from Anthropic
   */
  async getModels(): Promise<ProviderModel[]> {
    try {
      // Anthropic doesn't have a specific models endpoint, so we hardcode the available models
      // This should be updated as new models are released
      const claudeModels: ProviderModel[] = [
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: true,
            tools: true,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: true,
            tools: true,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: true,
            tools: true,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-2.1',
          name: 'Claude 2.1',
          provider: this.name,
          tokenLimit: 200000,
          features: {
            vision: false,
            tools: false,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-2.0',
          name: 'Claude 2.0',
          provider: this.name,
          tokenLimit: 100000,
          features: {
            vision: false,
            tools: false,
            streaming: true,
            json: true,
            system: true
          }
        },
        {
          id: 'claude-instant-1.2',
          name: 'Claude Instant 1.2',
          provider: this.name,
          tokenLimit: 100000,
          features: {
            vision: false,
            tools: false,
            streaming: true,
            json: true,
            system: true
          }
        }
      ];
      
      return claudeModels;
    } catch (error) {
      logger.error('Error fetching Anthropic models:', error);
      return [];
    }
  }
  
  /**
   * Convert general message format to Anthropic format
   */
  protected createMessages(messages: Array<{ role: string; content: string | Array<any> }>): AnthropicMessage[] {
    try {
      // Convert message format to Anthropic format
      const anthropicMessages: AnthropicMessage[] = [];
      
      for (const message of messages) {
        // Skip system messages as they're handled separately in Anthropic API
        if (message.role === 'system') continue;
        
        // Create Anthropic message
        anthropicMessages.push({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: typeof message.content === 'string' 
            ? message.content 
            : JSON.stringify(message.content)
        });
      }

      return anthropicMessages;
    } catch (error: any) {
      logger.error('Error creating Anthropic messages:', error);
      throw new Error(`Failed to create Anthropic message format: ${error.message || error}`);
    }
  }
  
  /**
   * Send a completion request to Anthropic
   */
  async sendCompletion(messages: Array<{ role: string; content: string | Array<any> }>, options: any = {}): Promise<ProviderResponse> {
    try {
      // Get system message if present
      const systemMessage = messages.find(m => m.role === 'system');
      const systemPrompt = systemMessage ? 
        (typeof systemMessage.content === 'string' ? systemMessage.content : JSON.stringify(systemMessage.content)) 
        : '';
      
      // Convert messages to Anthropic format
      const anthropicMessages = this.createMessages(messages);

      // Prepare request parameters
      const requestParams: AnthropicCompletionOptions = {
        model: options.model || this.defaultModel,
        messages: anthropicMessages,
        max_tokens: options.max_tokens || this.config.maxTokens || 1024,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        top_p: options.top_p ?? this.config.top_p ?? 1,
        stream: options.stream === true,
      };

      // Add system prompt if present
      if (systemPrompt) {
        requestParams.system = systemPrompt;
      }

      // Add stop sequences if specified
      if (options.stop && options.stop.length > 0) {
        requestParams.stop = options.stop;
      }
      
      // Log request (removing sensitive data)
      logger.debug('Anthropic API request:', {
        model: requestParams.model,
        messages: anthropicMessages.length,
        max_tokens: requestParams.max_tokens,
        temperature: requestParams.temperature
      });
      
      return await this.completionBreaker.fire(requestParams);
    } catch (error) {
      // Handle and transform error
      return this.handleError(error);
    }
  }
  
  /**
   * Raw completion method for circuit breaker
   * This makes the actual API call to Anthropic
   */
  protected async rawCompletion(params: AnthropicCompletionOptions): Promise<ProviderResponse> {
    try {
      const startTime = Date.now();
      const response = await this.httpClient.post<AnthropicResponse>('/v1/messages', params);
      const requestDuration = Date.now() - startTime;
      
      // Log response time
      logger.debug(`Anthropic API response time: ${requestDuration}ms`);
      
      // Stream handling
      if (params.stream === true) {
        return this.handleStreamResponse(response, params.model || this.defaultModel);
      }
      
      // Parse and return response
      return this.parseResponse(response.data, params.model || this.defaultModel, requestDuration);
    } catch (error: any) {
      return this.handleError(error);
    }
  }
  
  /**
   * Parse Anthropic response to standard format
   */
  protected parseResponse(data: AnthropicResponse, model: string, latency: number): ProviderResponse {
    try {
      // Get text content
      const content = data.content.find(c => c.type === 'text')?.text || '';
      
      // Build standard response
      const response: ProviderResponse = {
        id: data.id,
        model,
        provider: this.name,
        createdAt: new Date().toISOString(),
        content,
        raw: data,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        },
        latency,
        finishReason: data.stop_reason || 'stop',
      };
      
      return response;
    } catch (error: any) {
      logger.error('Error parsing Anthropic response:', error);
      throw new Error(`Failed to parse Anthropic response: ${error.message || error}`);
    }
  }
  
  /**
   * Handle stream response from Anthropic
   */
  protected async handleStreamResponse(response: AxiosResponse, model: string): Promise<ProviderResponse> {
    // Implement stream handling if needed
    throw new Error('Stream handling not implemented for Anthropic provider');
  }
  
  /**
   * Handle and normalize errors from the Anthropic API
   */
  protected handleError(error: any): ProviderResponse {
    let status = 500;
    let message = 'Unknown error from Anthropic API';
    
    if (error.response) {
      status = error.response.status;
      message = error.response.data.error?.message || 'Error from Anthropic API';
      
      logger.error(`Anthropic API error (${status}): ${message}`, {
        status,
        data: error.response.data
      });
    } else if (error.request) {
      status = 503;
      message = 'No response received from Anthropic API';
      logger.error('No response from Anthropic API:', error.message);
    } else {
      logger.error('Error setting up Anthropic API request:', error.message);
    }
    
    return {
      id: `error-${Date.now()}`,
      model: '',
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: '',
      raw: error.response?.data || error,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      latency: 0,
      finishReason: 'error',
      errorDetails: {
        message,
        type: 'provider_error',
        param: null,
        code: status.toString()
      }
    };
  }

  /**
   * Required implementation of chatCompletion from BaseProvider
   */
  async chatCompletion(options: any): Promise<ProviderResponse> {
    const messages = options.messages || [];
    return this.sendCompletion(messages, options);
  }
} 