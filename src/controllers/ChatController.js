/**
 * Chat Controller
 * Handles all chat-related API endpoints with optimized performance
 */
import providerFactory from '../providers/ProviderFactory.js';
import * as cache from '../utils/cache.js';
import * as metrics from '../utils/metrics.js';
import { getCircuitBreakerStates } from '../utils/circuitBreaker.js';

class ChatController {
  constructor() {
    console.log('Initializing ChatController...');
    
    // Log initialization
    console.log('ChatController initialized with bound methods');
  }

  /**
   * Handle chat completion requests (non-streaming only)
   */
  async chatCompletion(req, res) {
    const startTime = Date.now();
    
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      const { model, messages, temperature = 0.7, max_tokens = 1000 } = req.body;
      
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
      let providerName, modelName;
      
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
            const cacheKeyData = {
              provider: providerName,
              model: modelName,
              messages: messages,
              temperature,
              max_tokens
            };
            
            const cacheKey = cache.generateKey(cacheKeyData);
            
            const cachedResponse = await cache.get(cacheKey);
            
            if (cachedResponse) {
              console.log(`Cache hit for ${providerName}/${modelName}`);
              // Add cache indicator
              cachedResponse.cached = true;
              res.json(cachedResponse);
              return;
            }
          } catch (cacheError) {
            console.warn(`Cache error: ${cacheError.message}. Continuing without cache.`);
          }
        }
      } catch (cacheCheckError) {
        console.warn(`Failed to check cache status: ${cacheCheckError.message}. Continuing without cache.`);
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
              const cacheKeyData = {
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
              console.warn(`Failed to cache response: ${cacheError.message}`);
            }
          }
        } catch (cacheCheckError) {
          console.warn(`Failed to check cache status: ${cacheCheckError.message}`);
        }
        
        // Return the response
        console.log(`Request completed in ${Date.now() - startTime}ms`);
        res.json(response);
      } catch (error) {
        // Clear timeout
        clearTimeout(timeout);
        
        console.error(`Provider error: ${error.message}`);
        res.status(500).json({
          error: `Provider error: ${error.message}`,
          provider: providerName,
          model: modelName
        });
      }
    } catch (error) {
      console.error(`Server error: ${error.message}`);
      console.error(error.stack);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error', 
          message: error.message 
        });
      }
    }
  }

  /**
   * Get chat capabilities and system status
   */
  async getChatCapabilities(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Get provider information
      const providersInfo = await providerFactory.getProvidersInfo();
      
      // Get circuit breaker states
      const circuitBreakerStates = getCircuitBreakerStates();
      
      // Get cache statistics with safety check
      let cacheStats = { enabled: false };
      try {
        if (typeof cache.getStats === 'function') {
          const stats = cache.getStats();
          cacheStats = { 
            ...stats,
            enabled: true
          };
        }
      } catch (cacheError) {
        console.warn(`Failed to get cache stats: ${cacheError.message}`);
        cacheStats = { 
          enabled: false,
          error: cacheError.message
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
      console.error(`Error getting chat capabilities: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get chat capabilities', 
        message: error.message 
      });
    }
  }
}

// Create singleton instance
const controller = new ChatController();

// Export instance
export default controller;