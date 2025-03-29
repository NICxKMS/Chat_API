/**
 * Centralized configuration for the Chat API
 * This file manages all provider configurations and model lists
 */

module.exports = {
  // Default provider to use when none is specified
  defaultProvider: process.env.DEFAULT_PROVIDER || 'openai',
  
  // Provider configurations
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      models: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-3.5-turbo'
      ],
      defaultModel: 'gpt-4o-mini',
      // Enable dynamic model loading from provider
      dynamicModelLoading: process.env.DYNAMIC_MODEL_LOADING === 'true' || true,
      // Timeout for API requests in milliseconds
      timeout: parseInt(process.env.RESPONSE_TIMEOUT || '30000', 10),
      // Connection pooling configuration
      maxConnections: 100,
      maxRetries: 3,
      retryDelay: 1000 // ms
    },
    
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      models: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-2.1'
      ],
      defaultModel: 'claude-3-haiku-20240307',
      dynamicModelLoading: process.env.DYNAMIC_MODEL_LOADING === 'true' || true,
      timeout: parseInt(process.env.RESPONSE_TIMEOUT || '30000', 10),
      maxConnections: 100,
      maxRetries: 3,
      retryDelay: 1000
    },
    
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY,
      models: [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro'
      ],
      defaultModel: 'gemini-1.5-flash',
      // Explicitly enable dynamic model loading
      dynamicModelLoading: true,
      apiVersion: process.env.GEMINI_API_VERSION || 'v1beta',
      timeout: parseInt(process.env.RESPONSE_TIMEOUT || '30000', 10),
      maxConnections: 100,
      maxRetries: 3,
      retryDelay: 1000
    },
    
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      referer: process.env.OPENROUTER_HTTP_REFERER || 'https://localhost:3000',
      title: process.env.OPENROUTER_TITLE || 'Centralized Chat API',
      organization: process.env.OPENROUTER_ORGANIZATION || '',
      models: [], // Will be populated dynamically
      defaultModel: 'openai/gpt-3.5-turbo',
      dynamicModelLoading: true, // OpenRouter has many models, always load dynamically
      timeout: parseInt(process.env.RESPONSE_TIMEOUT || '30000', 10),
      maxConnections: 50,
      maxRetries: 3,
      retryDelay: 1000
    }
  },
  
  // Cache configuration
  cache: {
    enabled: true,
    // Memory cache TTL in seconds
    memoryCacheTTL: parseInt(process.env.MEMORY_CACHE_TTL || '300', 10),
    // Redis cache configuration
    redis: {
      enabled: process.env.USE_REDIS_CACHE === 'true',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: parseInt(process.env.REDIS_CACHE_TTL || '1800', 10)
    }
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.REQUEST_RATE_LIMIT || '100', 10)
  },
  
  // Concurrent request limiting
  concurrentLimit: parseInt(process.env.CONCURRENT_REQUEST_LIMIT || '20', 10),
  
  // API endpoints configuration
  api: {
    status: '/status',
    models: '/models',
    chat: '/chat',
    providers: '/providers',
    images: '/images'
  },

  // API route configuration
  routes: {
    status: '/status',
    models: '/models',
    modelsList: '/models/list',
    modelsCategories: '/models/categories',
    providers: '/providers',
    chat: '/chat/completions',
    images: '/images/generate'
  },

  // API path mappings - useful for future versioning
  apiPaths: {
    models: '/models',
    chat: '/chat/completions',
    capabilities: '/chat/capabilities'
  }
};