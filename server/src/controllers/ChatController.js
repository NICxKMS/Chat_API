/**
 * Chat Controller
 * Handles all chat-related API endpoints with optimized performance
 */
import providerFactory from "../providers/ProviderFactory.js";
import * as cache from "../utils/cache.js";
import * as metrics from "../utils/metrics.js";
import { getCircuitBreakerStates } from "../utils/circuitBreaker.js";

class ChatController {
  constructor() {
    console.log("Initializing ChatController...");
    
    // Log initialization
    console.log("ChatController initialized with bound methods");
  }

  /**
   * Handles standard (non-streaming) chat completion requests.
   * Performs validation, caching, provider selection, and calls the provider's `chatCompletion` method.
   * @param {express.Request} req - The Express request object.
   * @param {express.Response} res - The Express response object.
   * @param {express.NextFunction} next - Express next function.
   */
  async chatCompletion(req, res, next) {
    const startTime = Date.now();
    
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      const { model, messages, temperature = 0.7, max_tokens = 1000 } = req.body;
      
      // Check for required parameters
      if (!model) {
        res.status(400).json({ error: "Missing required parameter: model" });
        return;
      }
      
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "Missing or invalid messages array" });
        return;
      }
      
      // Extract provider name and model name
      let providerName, modelName;
      
      if (model.includes("/")) {
        [providerName, modelName] = model.split("/", 2);
      } else {
        // Use getProvider without arguments to get the default provider
        const defaultProvider = providerFactory.getProvider();
        providerName = defaultProvider.name;
        if (providerName === "gemini") {
          modelName = model;
        } else {
          modelName = model;
        }
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
        if (typeof cache.isEnabled === "function" && cache.isEnabled() && !req.body.nocache) {
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
      
      // // Set a timeout for the request (REMOVED for P1)
      // const timeoutDuration = 
      //   typeof provider.config === 'object' && 
      //   typeof provider.config.timeout === 'number' ? 
      //   provider.config.timeout : 30000;
        
      // const timeout = setTimeout(() => {
      //   res.status(504).json({ 
      //     error: 'Request timeout', 
      //     message: 'The request took too long to complete'
      //   });
      //   // Note: the request will still complete in the background
      // }, timeoutDuration);
      
      // Prepare options for the provider
      const options = {
        model: modelName,
        messages,
        temperature: parseFloat(temperature?.toString() || "0.7"),
        max_tokens: parseInt(max_tokens?.toString() || "1000", 10)
      };
      
      try {
        // Send request to provider
        const response = await provider.chatCompletion(options);
        
        // // Clear timeout (REMOVED for P1)
        // clearTimeout(timeout);
        
        // Store response in cache if caching is enabled
        try {
          if (typeof cache.isEnabled === "function" && cache.isEnabled() && !req.body.nocache) {
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
              // console.log(`Cached response for ${providerName}/${modelName}`);
            } catch (cacheError) {
              console.warn(`Failed to cache response: ${cacheError.message}`);
            }
          }
        } catch (cacheCheckError) {
          console.warn(`Failed to check cache status: ${cacheCheckError.message}`);
        }
        
        // Return the response
        res.json(response);
      } catch (error) {
        // // Clear timeout (REMOVED for P1)
        // clearTimeout(timeout);
        
        console.error(`Provider error in chatCompletion: ${error.message}`, { provider: providerName, model: modelName });

        // Attempt to create a more specific error based on the provider error
        let mappedError = error; // Default to original error
        if (error.message) { // Basic check if error message exists
          if (/authentication|api key|invalid_request_error.*api_key/i.test(error.message)) {
            mappedError = new Error(`Authentication failed with provider ${providerName}. Check your API key.`);
            mappedError.status = 401;
            mappedError.name = "AuthenticationError";
          } else if (/rate limit|quota exceeded/i.test(error.message)) {
            mappedError = new Error(`Rate limit exceeded for provider ${providerName}.`);
            mappedError.status = 429;
            mappedError.name = "RateLimitError";
          } else if (/model not found|deployment does not exist/i.test(error.message)) {
            mappedError = new Error(`Model '${modelName}' not found or unavailable for provider ${providerName}.`);
            mappedError.status = 404;
            mappedError.name = "NotFoundError";
          } else if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
            // General 4xx from provider (axios error example)
            mappedError = new Error(`Provider ${providerName} returned client error ${error.response.status}: ${error.message}`);
            mappedError.status = error.response.status; // Use provider status
            mappedError.name = "ProviderClientError"; // Custom name
          } else {
            // Default to a generic provider error for other cases
            mappedError = new Error(`Provider ${providerName} encountered an error: ${error.message}`);
            mappedError.status = 502; // Bad Gateway is often appropriate
            mappedError.name = "ProviderError";
          }
        }
        
        // Pass the potentially mapped error to the centralized error handler
        next(mappedError); // <-- Use next(err) instead of sending response directly

        // // Ensure response isn't sent if timeout already fired (or if headers sent) (OLD CODE)
        // if (!res.headersSent) {
        //    res.status(500).json({
        //       error: `Provider error: ${error.message}`,
        //       provider: providerName,
        //       model: modelName
        //    });
        // }
      }
    } catch (error) {
      // Catch errors from validation, provider setup, caching etc.
      console.error(`Server error in chatCompletion: ${error.message}`);
      // Pass to the centralized error handler
      next(error); 

      // // OLD CODE
      // console.error(error.stack);
      // if (!res.headersSent) {
      //   res.status(500).json({ 
      //     error: 'Internal server error', 
      //     message: error.message 
      //   });
      // }
    }
  }

  /**
   * Handles streaming chat completion requests using Server-Sent Events (SSE).
   * Sets up SSE headers, calls the provider's `chatCompletionStream` async generator,
   * pipes the resulting chunks to the client, and handles timeouts/disconnects.
   * @param {express.Request} req - The Express request object.
   * @param {express.Response} res - The Express response object.
   */
  async chatCompletionStream(req, res) {
    let providerName, modelName;
    let streamClosed = false; // Flag to prevent writing after close/error
    let lastActivityTime = Date.now();
    let heartbeatInterval = null;
    let timeoutCheckInterval = null;
    const HEARTBEAT_INTERVAL_MS = 20000; // Send heartbeat comment every 20s
    const TIMEOUT_DURATION_MS = 60000; // Close connection after 60s of inactivity
    let streamStartTime = null; // For duration metric
    let ttfbRecorded = false; // Ensure TTFB is recorded only once

    /**
     * Safely ends the response stream, cleans up intervals, and records metrics.
     * @param {string} message - Log message indicating the reason for ending.
     * @param {string|null} [errorType=null] - The type of error for metrics (e.g., 'timeout').
     */
    const safelyEndResponse = (message, errorType = null) => {
      if (!streamClosed) {
        console.log(message); // Log the reason for closing
        streamClosed = true;
        // Clear timers
        if (heartbeatInterval) {clearInterval(heartbeatInterval);}
        if (timeoutCheckInterval) {clearInterval(timeoutCheckInterval);}
        
        // Record total stream duration metric
        if (streamStartTime && providerName && modelName) {
          const durationSeconds = (Date.now() - streamStartTime) / 1000;
          metrics.recordStreamDuration(providerName, modelName, durationSeconds);
        }
        
        // Record error if applicable
        if (errorType && providerName && modelName) {
          metrics.incrementStreamErrorCount(providerName, modelName, errorType);
        }

        if (!res.writableEnded) {
          res.end();
        }
      }
    };

    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      const { model, messages, temperature = 0.7, max_tokens = 1000 } = req.body;
      
      // Basic validation
      if (!model) {
        return res.status(400).json({ error: "Missing required parameter: model" });
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Missing or invalid messages array" });
      }

      // Extract provider name and model name (similar to non-streaming)
      if (model.includes("/")) {
        [providerName, modelName] = model.split("/", 2);
      } else {
        const defaultProvider = providerFactory.getProvider();
        providerName = defaultProvider.name;
        modelName = model;
      }

      // Get the provider
      const provider = providerFactory.getProvider(providerName);
      if (!provider) {
        return res.status(404).json({ error: `Provider '${providerName}' not found or not configured` });
      }

      console.log(`Processing STREAMING chat request for ${providerName}/${modelName}`);
      streamStartTime = Date.now(); // Start timer *before* flushing headers for accurate TTFB
      
      // --- Streaming Specific Logic --- 

      // Set headers for Server-Sent Events (SSE)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders(); // Send headers immediately
      lastActivityTime = Date.now(); // Reset activity time after headers

      // Setup Heartbeat: Send SSE comments periodically to keep the connection alive
      heartbeatInterval = setInterval(() => {
        if (!streamClosed && res.writable) { 
          try {
            res.write(":heartbeat\n\n"); // SSE comment format
            // console.log('Sent heartbeat'); 
          } catch (err) {
            safelyEndResponse(`Error sending heartbeat: ${err.message}`);
          }
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Setup Inactivity Timeout Check: Monitor time since last chunk/activity
      timeoutCheckInterval = setInterval(() => {
        if (Date.now() - lastActivityTime > TIMEOUT_DURATION_MS) {
          safelyEndResponse(`Stream timed out due to inactivity for ${providerName}/${modelName}`, "timeout");
        }
      }, TIMEOUT_DURATION_MS / 2); // Check more frequently than the timeout itself

      // Handle client disconnect
      req.on("close", () => {
        safelyEndResponse(`Client disconnected stream for ${providerName}/${modelName}`, "client_disconnect");
      });

      // Prepare options for the provider stream method
      const options = {
        model: modelName,
        messages,
        temperature: parseFloat(temperature?.toString() || "0.7"),
        max_tokens: parseInt(max_tokens?.toString() || "1000", 10),
        // Add any other stream-specific options from req.body if needed
      };

      // Call the provider's streaming method
      const stream = provider.chatCompletionStream(options);
      
      // Iterate through the provider's async generator stream
      for await (const chunk of stream) {
        if (streamClosed) {break;} // Stop if the stream was closed due to error/timeout/disconnect
        lastActivityTime = Date.now(); // Reset inactivity timer on receiving data
        
        // Record Time To First Byte (TTFB) metric on the *first* chunk received
        if (!ttfbRecorded) {
          const ttfbSeconds = (Date.now() - streamStartTime) / 1000;
          metrics.recordStreamTtfb(providerName, modelName, ttfbSeconds);
          ttfbRecorded = true;
        }

        // Increment chunk counter
        metrics.incrementStreamChunkCount(providerName, modelName);

        // Format the chunk as a valid SSE data message
        const sseFormattedChunk = `data: ${JSON.stringify(chunk)}\n\n`;
        
        // Write chunk safely to the response stream
        if (!streamClosed && res.writable) {
          try {
            res.write(sseFormattedChunk);
          } catch (writeError) {
            console.error(`Error writing chunk to response: ${writeError.message}`);
            safelyEndResponse(`Error writing chunk to response: ${writeError.message}`, "write_error");
            break; // Stop processing on write error
          }
        }
      }
      
      // If the loop completes without errors, end the stream normally
      safelyEndResponse(`Stream finished normally for ${providerName}/${modelName}`);
      
    } catch (error) {
      console.error(`Stream error: ${error.message}`, error.stack);
      const errorType = "provider_error"; // Default error type
      
      // Ensure error is sent only if headers haven't been sent
      if (!res.headersSent && !streamClosed) {
        streamClosed = true; // Mark as closed
        if (heartbeatInterval) {clearInterval(heartbeatInterval);}
        if (timeoutCheckInterval) {clearInterval(timeoutCheckInterval);}
        try {
          res.status(500).json({ 
            error: "Stream processing error", 
            message: error.message 
          });
        } catch (err) {
          console.error("Failed to send JSON error response:", err);
        }
        // Record error metric even if we couldn't send response
        if (providerName && modelName) {
          metrics.incrementStreamErrorCount(providerName, modelName, errorType);
        }
      } else if (!streamClosed && res.writable) {
        // If headers ARE sent, try to send a structured error event over the stream
        // Use a distinct SSE event type for errors
        const errorPayload = {
          // Use properties from the error if available, otherwise provide defaults
          code: error.code || error.name || "ProviderStreamError",
          message: error.message || "An error occurred during streaming.",
          status: error.status || 500, // Best guess if status not available
          provider: providerName,
          model: modelName
        };
        try {
          // Format as SSE error event
          const sseErrorEvent = `event: error\ndata: ${JSON.stringify(errorPayload)}\n\n`;
          res.write(sseErrorEvent);
          console.log(`Sent SSE error event for ${providerName}/${modelName}`);
        } catch (writeError) {
          console.error("Failed to write SSE error event to stream:", writeError);
          // If writing the error fails, we can't do much more
        }
        // End the stream after attempting to send the error event
        safelyEndResponse(`Stream ended due to error: ${error.message}`, errorType);
      } else {
        // If stream is already closed or not writable, just log and record metric
        console.log("Stream already closed or not writable when error occurred.");
        if (providerName && modelName) {
          metrics.incrementStreamErrorCount(providerName, modelName, errorType);
        }
        if (heartbeatInterval) {clearInterval(heartbeatInterval);}
        if (timeoutCheckInterval) {clearInterval(timeoutCheckInterval);}
      }
    }
  }

  /**
   * Gets combined capabilities information from providers, cache, and system.
   * @param {express.Request} req - The Express request object.
   * @param {express.Response} res - The Express response object.
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
        if (typeof cache.getStats === "function") {
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
        error: "Failed to get chat capabilities", 
        message: error.message 
      });
    }
  }
}

// Create singleton instance
const controller = new ChatController();

// Export instance
export default controller;