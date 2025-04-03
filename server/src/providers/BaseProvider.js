/**
 * BaseProvider abstract class
 * Defines the interface that all AI provider implementations must follow
 */

class BaseProvider {
  /**
   * Create a new provider
   */
  constructor(config) {
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
  async getModels() {
    throw new Error('Method getModels() must be implemented by derived classes');
  }

  /**
   * Get info about the provider
   */
  getInfo() {
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
  async chatCompletion(options) {
    throw new Error('Method chatCompletion() must be implemented by derived classes');
  }

  /**
   * Normalize a provider response to a standard format
   */
  normalizeResponse(response) {
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
  standardizeOptions(options) {
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
  validateOptions(options) {
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