/**
 * Chat Controller
 * Handles all chat-related API endpoints with optimized performance
 */
const providerFactory = require('../providers/ProviderFactory');
const cache = require('../utils/cache');
const metrics = require('../utils/metrics');
const { getCircuitBreakerStates } = require('../utils/circuitBreaker');

class ChatController {
  /**
   * Handle non-streaming chat completion requests
   */
  async chatCompletion(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      const { model, messages, temperature, max_tokens } = req.body;
      
      if (!model || !messages) {
        return res.status(400).json({ 
          error: 'Missing required parameters', 
          message: 'Model and messages are required'
        });
      }
      
      // Parse provider and model names from the model parameter
      // Format: "provider/model" or just "model" for default provider
      let providerName, modelName;
      
      if (model.includes('/')) {
        [providerName, modelName] = model.split('/', 2);
      } else {
        providerName = providerFactory.getProvider().name;
        modelName = model;
      }
      
      try {
        // Get the provider instance
        const provider = providerFactory.getProvider(providerName);
        
        // Generate cache key for this request
        const cacheKey = cache.generateKey({
          provider: providerName,
          model: modelName,
          messages,
          temperature,
          max_tokens
        });
        
        // Check cache first (for deterministic requests)
        let cacheHit = false;
        if (!req.query.nocache && temperature === 0) {
          const cachedResponse = await cache.get(cacheKey);
          
          if (cachedResponse) {
            cacheHit = true;
            // Return cached response
            return res.json({
              ...cachedResponse,
              cached: true
            });
          }
        }
        
        // Set a timeout to handle long-running requests
        const timeout = setTimeout(() => {
          res.status(504).json({ 
            error: 'Request timeout', 
            message: 'The request took too long to complete'
          });
          // Note: the request will still complete in the background
        }, provider.config.timeout || 30000);
        
        // Format the request options
        const options = {
          model: modelName,
          messages,
          temperature: parseFloat(temperature || 0.7),
          max_tokens: parseInt(max_tokens || 1000, 10)
        };
        
        // Send request to provider
        const response = await provider.chatCompletion(options);
        
        // Clear the timeout
        clearTimeout(timeout);
        
        // Cache response for deterministic requests (temp=0)
        if (!cacheHit && temperature === 0) {
          await cache.set(cacheKey, response);
        }
        
        // Return response
        res.json(response);
        
      } catch (error) {
        console.error(`Chat completion error for ${providerName}/${modelName}: ${error.message}`);
        res.status(500).json({ 
          error: 'Chat completion failed', 
          message: error.message,
          provider: providerName,
          model: modelName
        });
      }
    } catch (error) {
      console.error(`Chat completion error: ${error.message}`);
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message 
      });
    }
  }

  /**
   * Handle streaming chat completion requests
   */
  async streamChatCompletion(req, res) {
    // Get request body from either POST or GET
    const isPost = req.method === 'POST';
    const requestData = isPost ? req.body : req.query;
    
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Extract parameters
      const { model, messages, temperature, max_tokens } = requestData;
      
      if (!model || !messages) {
        return res.status(400).json({ 
          error: 'Missing required parameters', 
          message: 'Model and messages are required'
        });
      }
      
      // Parse messages parameter if it's a string (from GET request)
      let parsedMessages;
      try {
        parsedMessages = Array.isArray(messages) ? messages : JSON.parse(messages);
      } catch (error) {
        console.error('Error parsing messages:', error);
        return res.status(400).json({
          error: 'Invalid messages format',
          message: 'The messages parameter could not be parsed as JSON'
        });
      }
      
      // Parse provider and model names
      let providerName, modelName;
      
      if (model.includes('/')) {
        [providerName, modelName] = model.split('/', 2);
      } else {
        providerName = providerFactory.getProvider().name;
        modelName = model;
      }
      
      try {
        // Get the provider instance
        const provider = providerFactory.getProvider(providerName);
        
        // Check if provider supports streaming
        if (!provider.supportsStreaming) {
          return res.status(400).json({ 
            error: 'Streaming not supported', 
            message: `Provider ${providerName} does not support streaming`
          });
        }
        
        // Setup stream response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for SSE
        res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
        
        // Callback for handling stream chunks
        const onChunk = (chunk) => {
          // Make sure chunk is properly formatted before sending
          if (chunk && typeof chunk === 'object') {
            // Send each chunk as a properly formatted SSE event
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            
            // Force flush to ensure data is sent immediately
            if (res.flush) {
              res.flush();
            }
          }
          
          // If this is the final chunk, end the response
          if (chunk && chunk.finishReason) {
            // Make sure we don't try to end the response if it's already ended
            if (!res.writableEnded) {
              res.end();
            }
          }
        };
        
        // Handle client disconnect
        req.on('close', () => {
          // Could add cleanup logic here if needed
          console.log('Client disconnected from stream');
          
          if (!res.writableEnded) {
            res.end();
          }
        });
        
        // Format the request options
        const options = {
          model: modelName,
          messages: parsedMessages,
          temperature: parseFloat(temperature || 0.7),
          max_tokens: parseInt(max_tokens || 1000, 10)
        };
        
        console.log(`Starting stream for ${providerName}/${modelName}`);
        
        // Start streaming from provider
        await provider.streamChatCompletion(options, onChunk);
        
        // Ensure the response is ended
        if (!res.writableEnded) {
          res.end();
        }
        
      } catch (error) {
        console.error(`Stream chat completion error for ${providerName}/${modelName}: ${error.message}`);
        
        // Only send error if headers haven't been sent
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Stream chat completion failed', 
            message: error.message,
            provider: providerName,
            model: modelName
          });
        } else {
          // If headers are sent, send error as SSE
          const errorData = {
            error: 'Stream chat completion failed',
            message: error.message,
            finishReason: 'error' // Include finish reason so client knows to stop waiting
          };
          
          res.write(`data: ${JSON.stringify(errorData)}\n\n`);
          
          if (!res.writableEnded) {
            res.end();
          }
        }
      }
    } catch (error) {
      console.error(`Stream chat completion error: ${error.message}`);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error', 
          message: error.message 
        });
      } else {
        const errorData = {
          error: 'Internal server error',
          message: error.message,
          finishReason: 'error' // Include finish reason so client knows to stop waiting
        };
        
        res.write(`data: ${JSON.stringify(errorData)}\n\n`);
        
        if (!res.writableEnded) {
          res.end();
        }
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
      
      // Get cache statistics
      const cacheStats = cache.getStats();
      
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

module.exports = new ChatController();