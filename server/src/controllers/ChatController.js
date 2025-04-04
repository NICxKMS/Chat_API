/**
 * Chat Controller
 * Handles all chat-related API endpoints with optimized performance
 */
import providerFactory from "../providers/ProviderFactory.js";
import * as cache from "../utils/cache.js";
import * as metrics from "../utils/metrics.js";
import { getCircuitBreakerStates } from "../utils/circuitBreaker.js";
import logger from "../utils/logger.js";

class ChatController {
  constructor() {
    // Bind methods (consider if still necessary with Fastify style)
    this.chatCompletion = this.chatCompletion.bind(this);
    this.chatCompletionStream = this.chatCompletionStream.bind(this);
    this.getChatCapabilities = this.getChatCapabilities.bind(this);
    console.log("ChatController initialized");
  }

  /**
   * Handles standard (non-streaming) chat completion requests.
   * Performs validation, caching, provider selection, and calls the provider's `chatCompletion` method.
   * @param {FastifyRequest} request - Fastify request object.
   * @param {FastifyReply} reply - Fastify reply object.
   */
  async chatCompletion(request, reply) {
    const startTime = Date.now();
    let providerName, modelName; // Declare here for potential use in error logging
    
    try {
      metrics.incrementRequestCount();
      
      // Use request.body
      const { model, messages, temperature = 0.7, max_tokens = 1000, nocache } = request.body;
      
      if (!model) {
        return reply.status(400).send({ error: "Missing required parameter: model" });
      }
      
      if (!Array.isArray(messages) || messages.length === 0) {
        return reply.status(400).send({ error: "Missing or invalid messages array" });
      }
      
      // Extract provider name and model name (logic unchanged)
      if (model.includes("/")) {
        [providerName, modelName] = model.split("/", 2);
      } else {
        const defaultProvider = providerFactory.getProvider();
        providerName = defaultProvider.name;
        modelName = model;
      }
      
      const provider = providerFactory.getProvider(providerName);
      
      if (!provider) {
        return reply.status(404).send({ 
          error: `Provider '${providerName}' not found or not configured`
        });
      }
      
      logger.info(`Processing chat request for ${providerName}/${modelName}`);
      
      // Cache check logic 
      try {
        if (typeof cache.isEnabled === "function" && cache.isEnabled() && !nocache) {
          try {
            const cacheKeyData = { provider: providerName, model: modelName, messages, temperature, max_tokens };
            const cacheKey = cache.generateKey(cacheKeyData);
            const cachedResponse = await cache.get(cacheKey);
            if (cachedResponse) {
              logger.info(`Cache hit for ${providerName}/${modelName}`);
              cachedResponse.cached = true;
              return reply.send(cachedResponse); // Use reply.send
            }
          } catch (cacheError) {
            logger.warn(`Cache error: ${cacheError.message}. Continuing without cache.`);
          }
        }
      } catch (cacheCheckError) {
        logger.warn(`Failed to check cache status: ${cacheCheckError.message}. Continuing without cache.`);
      }
      
      // Prepare options (unchanged, uses parseFloat/parseInt)
      const options = {
        model: modelName,
        messages,
        temperature: parseFloat(temperature?.toString() || "0.7"),
        max_tokens: parseInt(max_tokens?.toString() || "1000", 10)
      };
      
      try {
        // Send request to provider (unchanged)
        const response = await provider.chatCompletion(options);
        
        // Cache set logic 
        try {
          if (typeof cache.isEnabled === "function" && cache.isEnabled() && !nocache) {
            try {
              const cacheKeyData = { provider: providerName, model: modelName, messages, temperature, max_tokens };
              const cacheKey = cache.generateKey(cacheKeyData);
              await cache.set(cacheKey, response);
            } catch (cacheError) {
              logger.warn(`Failed to cache response: ${cacheError.message}`);
            }
          }
        } catch (cacheCheckError) {
          logger.warn(`Failed to check cache status: ${cacheCheckError.message}`);
        }
        
        // Return the response using reply.send
        return reply.send(response); // Explicit return

      } catch (providerError) {
        logger.error(`Provider error in chatCompletion: ${providerError.message}`, { provider: providerName, model: modelName, stack: providerError.stack });

        // TODO: Review error handling strategy.
        // Consider throwing specific custom error types from providers/services
        // and centralizing status code mapping and response formatting solely
        // within the fastifyErrorHandler.
        let mappedError = providerError; 
        if (providerError.message) { 
          if (/authentication|api key|invalid_request_error.*api_key/i.test(providerError.message)) {
            mappedError = new Error(`Authentication failed with provider ${providerName}. Check your API key.`);
            mappedError.status = 401;
            mappedError.name = "AuthenticationError";
          } else if (/rate limit|quota exceeded/i.test(providerError.message)) {
            mappedError = new Error(`Rate limit exceeded for provider ${providerName}.`);
            mappedError.status = 429;
            mappedError.name = "RateLimitError";
          } else if (/model not found|deployment does not exist/i.test(providerError.message)) {
            mappedError = new Error(`Model '${modelName}' not found or unavailable for provider ${providerName}.`);
            mappedError.status = 404;
            mappedError.name = "NotFoundError";
          } else if (providerError.response?.status && providerError.response.status >= 400 && providerError.response.status < 500) {
            mappedError = new Error(`Provider ${providerName} returned client error ${providerError.response.status}: ${providerError.message}`);
            mappedError.status = providerError.response.status;
            mappedError.name = "ProviderClientError";
          } else {
            mappedError = new Error(`Provider ${providerName} encountered an error: ${providerError.message}`);
            mappedError.status = 502;
            mappedError.name = "ProviderError";
          }
        }
        
        // Throw error instead of calling next()
        throw mappedError; 

      }
    } catch (error) {
      // Catch errors from validation, provider setup, caching, or thrown provider errors
      logger.error(`Server error in chatCompletion handler: ${error.message}`, { provider: providerName, model: modelName, stack: error.stack });
      // Throw error to be handled by Fastify's central error handler
      throw error; 
    }
  }

  /**
   * Handles streaming chat completion requests using Server-Sent Events (SSE).
   * Sets up SSE headers, calls the provider's `chatCompletionStream` async generator,
   * pipes the resulting chunks to the client, and handles timeouts/disconnects.
   * Uses reply.raw for direct stream manipulation.
   * @param {FastifyRequest} request - Fastify request object.
   * @param {FastifyReply} reply - Fastify reply object.
   */
  async chatCompletionStream(request, reply) {
    let providerName, modelName;
    let streamClosed = false; 
    let lastActivityTime = Date.now();
    let heartbeatInterval = null;
    let timeoutCheckInterval = null;
    const HEARTBEAT_INTERVAL_MS = 20000;
    const TIMEOUT_DURATION_MS = 60000;
    let streamStartTime = null;
    let ttfbRecorded = false;

    // Use reply.raw for direct access to the underlying Node response object
    const response = reply.raw;

    /**
     * Safely ends the response stream, cleans up intervals, and records metrics.
     * Uses the Node.js response object (response = reply.raw).
     */
    const safelyEndResponse = (message, errorType = null) => {
      if (!streamClosed) {
        logger.info(message); // Use logger
        streamClosed = true;
        if (heartbeatInterval) { clearInterval(heartbeatInterval); }
        if (timeoutCheckInterval) { clearInterval(timeoutCheckInterval); }
        
        if (streamStartTime && providerName && modelName) {
          const durationSeconds = (Date.now() - streamStartTime) / 1000;
          metrics.recordStreamDuration(providerName, modelName, durationSeconds);
        }
        if (errorType && providerName && modelName) {
          metrics.incrementStreamErrorCount(providerName, modelName, errorType);
        }

        // Check Node.js response object directly
        if (!response.writableEnded) {
          response.end();
        }
      }
    };

    try {
      metrics.incrementRequestCount();
      
      // Use request.body
      const { model, messages, temperature = 0.7, max_tokens = 1000 } = request.body;
      
      if (!model) {
        // Use reply to send error before headers are set
        return reply.status(400).send({ error: "Missing required parameter: model" });
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        return reply.status(400).send({ error: "Missing or invalid messages array" });
      }

      // Extract provider/model name (logic unchanged)
      if (model.includes("/")) {
        [providerName, modelName] = model.split("/", 2);
      } else {
        const defaultProvider = providerFactory.getProvider();
        providerName = defaultProvider.name;
        modelName = model;
      }

      const provider = providerFactory.getProvider(providerName);
      if (!provider) {
        return reply.status(404).send({ error: `Provider '${providerName}' not found or not configured` });
      }

      logger.info(`Processing STREAMING chat request for ${providerName}/${modelName}`);
      streamStartTime = Date.now();
      
      // --- Streaming Specific Logic --- 

      // Set headers using Node.js response object (reply.raw)
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");
      // Explicitly set Transfer-Encoding for streaming 
      response.setHeader("Transfer-Encoding", "chunked"); 
      // Optionally set X-Accel-Buffering for Nginx 
      // response.setHeader("X-Accel-Buffering", "no");
      
      response.flushHeaders(); // Send headers immediately using Node.js response
      lastActivityTime = Date.now();

      // Setup Heartbeat using reply.raw
      heartbeatInterval = setInterval(() => {
        if (!streamClosed && response.writable) { 
          try {
            response.write(":heartbeat\n\n"); 
          } catch (err) {
            safelyEndResponse(`Error sending heartbeat: ${err.message}`);
          }
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Setup Inactivity Timeout Check (logic unchanged)
      timeoutCheckInterval = setInterval(() => {
        if (Date.now() - lastActivityTime > TIMEOUT_DURATION_MS) {
          safelyEndResponse(`Stream timed out due to inactivity for ${providerName}/${modelName}`, "timeout");
        }
      }, TIMEOUT_DURATION_MS / 2);

      // Handle client disconnect using Node.js request object (request.raw)
      request.raw.on("close", () => {
        safelyEndResponse(`Client disconnected stream for ${providerName}/${modelName}`, "client_disconnect");
      });

      // Prepare options (unchanged)
      const options = {
        model: modelName,
        messages,
        temperature: parseFloat(temperature?.toString() || "0.7"),
        max_tokens: parseInt(max_tokens?.toString() || "1000", 10),
      };

      // Call provider stream (unchanged)
      const stream = provider.chatCompletionStream(options);
      
      // Iterate through stream
      for await (const chunk of stream) {
        if (streamClosed) { break; }
        lastActivityTime = Date.now(); 
        
        if (!ttfbRecorded) {
          const ttfbSeconds = (Date.now() - streamStartTime) / 1000;
          metrics.recordStreamTtfb(providerName, modelName, ttfbSeconds);
          ttfbRecorded = true;
        }
        metrics.incrementStreamChunkCount(providerName, modelName);

        const sseFormattedChunk = `data: ${JSON.stringify(chunk)}\n\n`;
        
        // Write chunk safely using reply.raw
        if (!streamClosed && response.writable) {
          try {
            response.write(sseFormattedChunk);
          } catch (writeError) {
            logger.error(`Error writing chunk to response: ${writeError.message}`);
            safelyEndResponse(`Error writing chunk to response: ${writeError.message}`, "write_error");
            break;
          }
        }
      }
      
      // If loop completes normally, end the stream
      safelyEndResponse(`Stream finished normally for ${providerName}/${modelName}`);
      
    } catch (error) {
      // Handle errors. Note: Headers might have already been sent.
      logger.error(`Stream error: ${error.message}`, { provider: providerName, model: modelName, stack: error.stack });
      const errorType = "provider_error";
      
      // Check if headers have been sent using reply.sent (Fastify property)
      if (!reply.sent && !streamClosed) {
          // Headers not sent, we can use reply to send a JSON error
          streamClosed = true; 
          if (heartbeatInterval) { clearInterval(heartbeatInterval); }
          if (timeoutCheckInterval) { clearInterval(timeoutCheckInterval); }
          try {
              // Determine appropriate status code from error if possible
              const statusCode = error.status || 500;
              reply.status(statusCode).send({ 
                  error: "Stream processing error", 
                  message: error.message 
              });
          } catch (err) {
              logger.error("Failed to send JSON error response:", err);
          }
          // Record error metric
          if (providerName && modelName) {
              metrics.incrementStreamErrorCount(providerName, modelName, errorType);
          }
      } else if (!streamClosed && response.writable) {
        // Headers ARE sent, try to send a structured error event over the stream using reply.raw
        const errorPayload = {
          code: error.code || error.name || "ProviderStreamError",
          message: error.message || "An error occurred during streaming.",
          status: error.status || 500,
          provider: providerName,
          model: modelName
        };
        try {
          const sseErrorEvent = `event: error\ndata: ${JSON.stringify(errorPayload)}\n\n`;
          response.write(sseErrorEvent);
          logger.info(`Sent SSE error event for ${providerName}/${modelName}`);
        } catch (writeError) {
          logger.error("Failed to write SSE error event to stream:", writeError);
        }
        // End the stream after attempting to send the error event
        safelyEndResponse(`Stream ended due to error: ${error.message}`, errorType);
      } else {
        // Stream already closed or not writable
        logger.warn("Stream already closed or not writable when error occurred.");
        if (providerName && modelName) {
          metrics.incrementStreamErrorCount(providerName, modelName, errorType);
        }
        if (heartbeatInterval) { clearInterval(heartbeatInterval); }
        if (timeoutCheckInterval) { clearInterval(timeoutCheckInterval); }
      }
    }
  }

  /**
   * Gets combined capabilities information from providers, cache, and system.
   * @param {FastifyRequest} request - Fastify request object.
   * @param {FastifyReply} reply - Fastify reply object.
   */
  async getChatCapabilities(request, reply) {
    try {
      metrics.incrementRequestCount();
      
      const providersInfo = await providerFactory.getProvidersInfo();
      const circuitBreakerStates = getCircuitBreakerStates();
      
      let cacheStats = { enabled: false };
      try {
        if (typeof cache.getStats === "function") {
          const stats = cache.getStats();
          cacheStats = { ...stats, enabled: true };
        }
      } catch (cacheError) {
        logger.warn(`Failed to get cache stats: ${cacheError.message}`);
        cacheStats = { enabled: false, error: cacheError.message };
      }
      
      // Return combined capabilities using reply.send
      return reply.send({
        providers: providersInfo,
        defaultProvider: providerFactory.getProvider().name,
        circuitBreakers: circuitBreakerStates,
        cacheStats: cacheStats,
        systemStatus: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      }); // Explicit return
    } catch (error) {
      logger.error(`Error getting chat capabilities: ${error.message}`, { stack: error.stack });
      // Throw error for Fastify's handler
      throw error; 
    }
  }
}

// Create singleton instance
const controller = new ChatController();

// Export instance
export default controller;