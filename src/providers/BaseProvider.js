/**
 * BaseProvider abstract class
 * Defines the interface that all AI provider implementations must follow
 */
class BaseProvider {
  constructor(config) {
    if (this.constructor === BaseProvider) {
      throw new Error('BaseProvider is an abstract class and cannot be instantiated directly');
    }
    
    this.config = config;
    this.name = 'base';
    this.supportsStreaming = false;
    this.apiVersionInfo = {
      version: 'unknown',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get available models from this provider
   * May be implemented to dynamically fetch models from provider API
   * or return a static list from configuration
   * 
   * @returns {Promise<Array<string>>} Array of model names
   */
  async getModels() {
    throw new Error('getModels() method must be implemented by provider classes');
  }

  /**
   * Send a chat completion request to this provider
   * 
   * @param {Object} options Request options
   * @param {string} options.model Model name/identifier
   * @param {Array<Object>} options.messages Array of message objects with role and content
   * @param {number} options.temperature Temperature parameter (0-1)
   * @param {number} options.max_tokens Maximum tokens to generate
   * @returns {Promise<Object>} Normalized response object
   */
  async chatCompletion(options) {
    throw new Error('chatCompletion() method must be implemented by provider classes');
  }

  /**
   * Stream a chat completion response from this provider
   * 
   * @param {Object} options Request options (same as chatCompletion)
   * @param {Function} onChunk Callback function for each chunk of the stream
   * @returns {Promise<void>} Resolves when streaming is complete
   */
  async streamChatCompletion(options, onChunk) {
    throw new Error('streamChatCompletion() method must be implemented by provider classes');
  }

  /**
   * Get capabilities and info about this provider
   * 
   * @returns {Object} Provider information and capabilities
   */
  getInfo() {
    return {
      name: this.name,
      models: this.config.models || [],
      defaultModel: this.config.defaultModel,
      supportsStreaming: this.supportsStreaming,
      apiVersion: this.apiVersionInfo.version,
      lastUpdated: this.apiVersionInfo.lastUpdated
    };
  }

  /**
   * Helper to normalize provider-specific response formats
   * into a standard format
   * 
   * @param {Object} response Provider-specific response
   * @returns {Object} Normalized response
   */
  normalizeResponse(response) {
    // Base implementation, should be overridden by provider classes
    return {
      provider: this.name,
      model: response.model || '',
      content: response.content || '',
      role: response.role || 'assistant',
      tokenUsage: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      },
      finishReason: response.finish_reason || '',
      createdAt: response.created ? new Date(response.created * 1000).toISOString() : new Date().toISOString(),
      id: response.id || `${this.name}-${Date.now()}`
    };
  }

  /**
   * Helper to normalize streaming chunks
   * 
   * @param {Object} chunk Provider-specific chunk format
   * @returns {Object} Normalized chunk format
   */
  normalizeStreamChunk(chunk) {
    // Base implementation, should be overridden by provider classes
    return {
      provider: this.name,
      model: chunk.model || '',
      content: chunk.content || '',
      role: chunk.role || 'assistant',
      finishReason: chunk.finish_reason || null,
      id: chunk.id || `${this.name}-chunk-${Date.now()}`
    };
  }

  /**
   * Helper to standardize options object before sending to provider
   * 
   * @param {Object} options User-provided options
   * @returns {Object} Standardized options
   */
  standardizeOptions(options) {
    const { model, messages, temperature = 0.7, max_tokens = 1000, ...rest } = options;
    
    return {
      model: model || this.config.defaultModel,
      messages: messages || [],
      temperature: parseFloat(temperature),
      max_tokens: parseInt(max_tokens, 10),
      ...rest
    };
  }

  /**
   * Helper to validate options before sending to provider
   * 
   * @param {Object} options User-provided options
   * @throws {Error} If options are invalid
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

module.exports = BaseProvider;