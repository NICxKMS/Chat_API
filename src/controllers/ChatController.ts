/**
 * Chat Controller
 * Handles all chat-related API endpoints with optimized performance
 */
import { Request, Response } from 'express';
import providerFactory from '../providers/ProviderFactory';
import * as cache from '../utils/cache';
import * as metrics from '../utils/metrics';
import { getCircuitBreakerStates } from '../utils/circuitBreaker';

// Message structure
interface ChatMessage {
  role: string;
  content: string;
  name?: string;
}

// Chat completion request body
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  nocache?: boolean;
  [key: string]: any;
}

// Cache key data structure
interface CacheKeyData {
  provider: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  [key: string]: any;
}

// Response with cache indicator
interface CachedResponse {
  cached?: boolean;
  [key: string]: any;
}

// Cache stats interface
interface CacheStats {
  enabled: boolean;
  hits?: number;
  misses?: number;
  keys?: number;
  error?: string;
  [key: string]: any;
}

class ChatController {
  constructor() {
    console.log('Initializing ChatController...');
    
    // Log initialization
    console.log('ChatController initialized with bound methods');
  }

  /**
   * Handle chat completion requests (non-streaming only)
   */
  async chatCompletion(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      const { model, messages, temperature = 0.7, max_tokens = 1000 } = req.body as ChatCompletionRequest;
      
      // Check for required parameters
      if (!model) {
        res.status(400).json({ error: 'Missing required parameter: model' });
        return;
      }
      
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Missing or invalid messages array' });
        return;
      }
      
      // Extract provider name and model name
      let providerName: string, modelName: string;
      
      if (model.includes('/')) {
        [providerName, modelName] = model.split('/', 2);
      } else {
        // Use getProvider without arguments to get the default provider
        const defaultProvider = providerFactory.getProvider();
        providerName = defaultProvider.name;
        modelName = model;
      }
      
      // Get the appropriate provider
      const provider = providerFactory.getProvider(providerName);
      
      if (!provider) {
        res.status(404).json({ 
          error: `Provider '${providerName}' not found or not configured`
        });
        return;
      }
      
      console.log(`Processing chat request for ${providerName}/${modelName}`);
      
      // Check cache if enabled
      try {
        if (typeof cache.isEnabled === 'function' && cache.isEnabled() && !req.body.nocache) {
          try {
            const cacheKeyData: CacheKeyData = {
              provider: providerName,
              model: modelName,
              messages: messages,
              temperature,
              max_tokens
            };
            
            const cacheKey = cache.generateKey(cacheKeyData);
            
            const cachedResponse = await cache.get<CachedResponse>(cacheKey);
            
            if (cachedResponse) {
              console.log(`Cache hit for ${providerName}/${modelName}`);
              // Add cache indicator
              cachedResponse.cached = true;
              res.json(cachedResponse);
              return;
            }
          } catch (cacheError) {
            console.warn(`Cache error: ${(cacheError as Error).message}. Continuing without cache.`);
          }
        }
      } catch (cacheCheckError) {
        console.warn(`Failed to check cache status: ${(cacheCheckError as Error).message}. Continuing without cache.`);
      }
      
      // Set a timeout for the request
      const timeoutDuration = 
        typeof provider.config === 'object' && 
        typeof provider.config.timeout === 'number' ? 
        provider.config.timeout : 30000;
        
      const timeout = setTimeout(() => {
        res.status(504).json({ 
          error: 'Request timeout', 
          message: 'The request took too long to complete'
        });
        // Note: the request will still complete in the background
      }, timeoutDuration);
      
      // Prepare options for the provider
      const options = {
        model: modelName,
        messages,
        temperature: parseFloat(temperature?.toString() || '0.7'),
        max_tokens: parseInt(max_tokens?.toString() || '1000', 10)
      };
      
      try {
        // Send request to provider
        const response = await provider.chatCompletion(options);
        
        // Clear timeout
        clearTimeout(timeout);
        
        // Store response in cache if caching is enabled
        try {
          if (typeof cache.isEnabled === 'function' && cache.isEnabled() && !req.body.nocache) {
            try {
              const cacheKeyData: CacheKeyData = {
                provider: providerName,
                model: modelName,
                messages: messages,
                temperature,
                max_tokens
              };
              
              const cacheKey = cache.generateKey(cacheKeyData);
              await cache.set(cacheKey, response);
              console.log(`Cached response for ${providerName}/${modelName}`);
            } catch (cacheError) {
              console.warn(`Failed to cache response: ${(cacheError as Error).message}`);
            }
          }
        } catch (cacheCheckError) {
          console.warn(`Failed to check cache status: ${(cacheCheckError as Error).message}`);
        }
        
        // Return the response
        console.log(`Request completed in ${Date.now() - startTime}ms`);
        res.json(response);
      } catch (error) {
        // Clear timeout
        clearTimeout(timeout);
        
        console.error(`Provider error: ${(error as Error).message}`);
        res.status(500).json({
          error: `Provider error: ${(error as Error).message}`,
          provider: providerName,
          model: modelName
        });
      }
    } catch (error) {
      console.error(`Server error: ${(error as Error).message}`);
      console.error((error as Error).stack);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error', 
          message: (error as Error).message 
        });
      }
    }
  }

  /**
   * Get chat capabilities and system status
   */
  async getChatCapabilities(req: Request, res: Response): Promise<void> {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Get provider information
      const providersInfo = await providerFactory.getProvidersInfo();
      
      // Get circuit breaker states
      const circuitBreakerStates = getCircuitBreakerStates();
      
      // Get cache statistics with safety check
      let cacheStats: CacheStats = { enabled: false };
      try {
        if (typeof cache.getStats === 'function') {
          const stats = cache.getStats();
          cacheStats = { 
            ...stats,
            enabled: true
          };
        }
      } catch (cacheError) {
        console.warn(`Failed to get cache stats: ${(cacheError as Error).message}`);
        cacheStats = { 
          enabled: false,
          error: (cacheError as Error).message
        };
      }
      
      // Return combined capabilities and status
      res.json({
        providers: providersInfo,
        defaultProvider: providerFactory.getProvider().name,
        circuitBreakers: circuitBreakerStates,
        cacheStats: cacheStats,
        systemStatus: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error(`Error getting chat capabilities: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to get chat capabilities', 
        message: (error as Error).message 
      });
    }
  }
}

// Create singleton instance
const controller = new ChatController();

// Export instance
export default controller; 