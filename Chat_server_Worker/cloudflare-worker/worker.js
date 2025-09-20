import { loadConfig } from "../shared/config.js";
import { createProviderFactory } from "../shared/providers/factory.js";
import { createChatController } from "../shared/controllers/chat.js";
import { createModelController } from "../shared/controllers/models.js";

// Hoisted encoder and lazy-initialized singletons to reduce per-request overhead
const encoder = new TextEncoder();
let _initialized = false;
let _config = null;
let _factory = null;
let _chat = null;
let _models = null;

// WebSocket connection management
const connections = new Map();
const MESSAGE_CHUNK_SIZE = 800 * 1024; // 800KB chunks to stay under 1MB limit

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 45000; // 45 seconds (longer than client's 30s)
const CONNECTION_TIMEOUT = 120000; // 2 minutes of inactivity

// Message serialization cache for performance
const serializationCache = new Map();
const CACHE_SIZE_LIMIT = 100;

// Performance metrics
const performanceMetrics = {
  messagesPerSecond: 0,
  cacheHitRate: 0,
  averageMessageSize: 0,
  totalMessages: 0,
  cacheHits: 0,
  averageLatency: 0,
  connectionReuse: 0
};

// Connection pool for HTTP/2 reuse
const connectionPools = new Map();

// WebSocket-specific optimizations
class WebSocketOptimizer {
  constructor() {
    this.messageQueue = new Map(); // Per-connection message queues
    this.batchTimers = new Map(); // Batching timers
    this.compressionCache = new Map(); // Message compression cache
  }

  // Optimize WebSocket message sending with batching
  optimizedSend(webSocket, message, connectionId) {
    // Add to queue for potential batching
    if (!this.messageQueue.has(connectionId)) {
      this.messageQueue.set(connectionId, []);
    }
    
    const queue = this.messageQueue.get(connectionId);
    queue.push(message);
    
    // For critical messages, send immediately
    if (this.isCriticalMessage(message)) {
      this.flushQueue(webSocket, connectionId);
      return;
    }
    
    // Batch non-critical messages for efficiency
    if (!this.batchTimers.has(connectionId)) {
      this.batchTimers.set(connectionId, setTimeout(() => {
        this.flushQueue(webSocket, connectionId);
      }, 5)); // 5ms batching window
    }
  }
  
  isCriticalMessage(message) {
    // Critical messages that need immediate sending
    const criticalTypes = ['stream_chunk', 'stream_start', 'stream_complete', 'stream_error', 'auth'];
    return criticalTypes.includes(message.type);
  }
  
  flushQueue(webSocket, connectionId) {
    const queue = this.messageQueue.get(connectionId);
    if (!queue || queue.length === 0) return;
    
    // Clear timer
    if (this.batchTimers.has(connectionId)) {
      clearTimeout(this.batchTimers.get(connectionId));
      this.batchTimers.delete(connectionId);
    }
    
    // Send all queued messages
    for (const message of queue) {
      try {
        const serialized = getSerializedMessage(message);
        webSocket.send(serialized);
      } catch (error) {
        console.error('Failed to send queued message:', error);
      }
    }
    
    // Clear queue
    this.messageQueue.set(connectionId, []);
  }
  
  // Cleanup when connection closes
  cleanup(connectionId) {
    if (this.batchTimers.has(connectionId)) {
      clearTimeout(this.batchTimers.get(connectionId));
      this.batchTimers.delete(connectionId);
    }
    this.messageQueue.delete(connectionId);
  }
}

const wsOptimizer = new WebSocketOptimizer();

// Optimized streaming pipeline for minimal latency
class StreamingPipeline {
  constructor(webSocket, requestId) {
    this.webSocket = webSocket;
    this.requestId = requestId;
    this.buffer = '';
    this.chunkCount = 0;
    this.startTime = Date.now();
    this.firstChunkTime = null;
  }
  
  async processStream(apiResponse, provider) {
    const reader = apiResponse.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Record first chunk time for latency metrics
        if (!this.firstChunkTime) {
          this.firstChunkTime = Date.now();
          const latency = this.firstChunkTime - this.startTime;
          performanceMetrics.averageLatency = (performanceMetrics.averageLatency + latency) / 2;
        }
        
        // Immediate processing without buffering
        const chunk = decoder.decode(value, { stream: true });
        this.processChunk(chunk, provider);
        this.chunkCount++;
      }
      
      // Send completion message
      sendMessage(this.webSocket, {
        type: 'stream_complete',
        requestId: this.requestId,
        totalChunks: this.chunkCount,
        totalTime: Date.now() - this.startTime
      });
      
    } finally {
      reader.releaseLock();
    }
  }
  
  processChunk(chunk, provider) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line
    
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        this.sendChunk(line.slice(6), provider);
      }
    }
  }
  
  sendChunk(data, provider) {
    try {
      const parsed = JSON.parse(data);
      
      // Fast extraction based on provider
      let content = '';
      switch (provider) {
        case 'openai':
          content = parsed.choices?.[0]?.delta?.content || '';
          break;
        case 'anthropic':
          content = parsed.delta?.text || '';
          break;
        case 'gemini':
          content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;
        default:
          content = parsed.content || '';
      }
      
      if (content) {
        // Minimal processing for maximum speed
        const normalizedChunk = {
          type: 'stream_chunk',
          requestId: this.requestId,
          model: parsed.model || 'unknown',
          provider: provider,
          createdAt: new Date().toISOString(),
          content: content,
          usage: null, // Will be normalized later if needed
          latency: 0,
          finishReason: null,
          raw: parsed
        };
        
        // Apply usage normalization if available
        if (parsed.usage || (parsed.usageMetadata)) {
          normalizedChunk.usage = this.extractUsage(parsed);
        }
        
        sendMessage(this.webSocket, normalizedChunk);
      }
      
    } catch (e) {
      // Skip invalid chunks silently for performance
    }
  }
  
  extractUsage(parsed) {
    // Fast usage extraction
    if (parsed.usageMetadata) {
      return {
        promptTokens: parsed.usageMetadata.promptTokenCount || 0,
        completionTokens: parsed.usageMetadata.candidatesTokenCount || 0,
        totalTokens: parsed.usageMetadata.totalTokenCount || 0
      };
    }
    
    if (parsed.usage) {
      return {
        promptTokens: parsed.usage.prompt_tokens || 0,
        completionTokens: parsed.usage.completion_tokens || 0,
        totalTokens: parsed.usage.total_tokens || 0
      };
    }
    
    return null;
  }
}

function init(env) {
  if (_initialized) return;
  _config = loadConfig(env);
  _factory = createProviderFactory(_config);
  _chat = createChatController(_factory, undefined, env);
  _models = createModelController(_factory, undefined, env);
  _initialized = true;
}

// Optimized serialization with caching
function getSerializedMessage(message) {
  const key = JSON.stringify(message);
  performanceMetrics.totalMessages++;
  
  if (serializationCache.has(key)) {
    performanceMetrics.cacheHits++;
    performanceMetrics.cacheHitRate = (performanceMetrics.cacheHits / performanceMetrics.totalMessages) * 100;
    return serializationCache.get(key);
  }
  
  const serialized = key; // Already stringified for key generation
  
  // Manage cache size
  if (serializationCache.size >= CACHE_SIZE_LIMIT) {
    const firstKey = serializationCache.keys().next().value;
    serializationCache.delete(firstKey);
  }
  
  serializationCache.set(key, serialized);
  performanceMetrics.averageMessageSize = (performanceMetrics.averageMessageSize + serialized.length) / 2;
  
  return serialized;
}

// Compression-first message splitting utilities
class CompressionChunker {
  constructor(algorithm = 'gzip') {
    this.algorithm = algorithm;
  }
  
  async compressData(text) {
    if (typeof CompressionStream === 'undefined') {
      // Fallback: return uncompressed data
      return { data: encoder.encode(text), compressed: false };
    }

    try {
      const stream = new CompressionStream(this.algorithm);
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      // Start compression
      writer.write(encoder.encode(text));
      writer.close();
      
      // Read compressed result
      const chunks = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      // Combine chunks into single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      return { data: result.buffer, compressed: true };
    } catch (error) {
      console.warn('Compression failed, using uncompressed:', error);
      return { data: encoder.encode(text), compressed: false };
    }
  }
  
  async decompressData(compressedData) {
    if (typeof DecompressionStream === 'undefined') {
      // Fallback: assume data is uncompressed
      return compressedData;
    }

    try {
      const stream = new DecompressionStream(this.algorithm);
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      // Start decompression
      writer.write(compressedData);
      writer.close();
      
      // Read decompressed result
      const chunks = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      // Combine chunks into single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      return result.buffer;
    } catch (error) {
      console.error('Decompression failed:', error);
      throw error;
    }
  }
  
  
  async splitMessage(message, messageId) {
    // Step 1: Serialize
    const messageStr = JSON.stringify(message);
    const originalSize = encoder.encode(messageStr).byteLength;
    
    // Step 2: Compress if beneficial (>1KB)
    const shouldCompress = originalSize > 1024;
    let compressed, compressedSize;
    
    if (shouldCompress) {
      const compressionResult = await this.compressData(messageStr);
      compressed = compressionResult.data;
      compressedSize = compressed.byteLength;
      
      console.log(`Compression: ${originalSize} → ${compressedSize} bytes (${((1 - compressedSize/originalSize) * 100).toFixed(1)}% reduction)`);
    } else {
      // No compression, calculate size but don't encode yet
      compressedSize = originalSize;
    }
    
    // Step 3: Check if chunking needed after compression
    if (compressedSize <= MESSAGE_CHUNK_SIZE) {
      if (shouldCompress) {
        // Return compressed binary directly
        return [compressed];
      } else {
        // Return original message
        return [message];
      }
    }
    
    // Step 4: Binary chunking of compressed data
    console.log(`Splitting compressed message: ${compressedSize} bytes into binary chunks`);
        // Binary chunking needed
        
    const chunks = [];
    const totalChunks = Math.ceil(compressedSize / MESSAGE_CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * MESSAGE_CHUNK_SIZE;
      const end = Math.min(start + MESSAGE_CHUNK_SIZE, compressedSize);
      const chunkData = compressed.slice(start, end);
      
      // Add binary chunk directly
      chunks.push(chunkData);
    }
    
    // Add final marker
    chunks.push({
      type: 'compressed_done',
      id: messageId,
      compression: this.algorithm
    });
    
    return chunks;
  }
}

// Global compression chunker instance
const compressionChunker = new CompressionChunker('gzip');


// Global decompression function
async function decompressData(compressedData) {
  return await compressionChunker.decompressData(compressedData);
}

function sendMessage(webSocket, message, connectionId = null) {
  // Use WebSocket optimizer for batching and efficiency
  if (connectionId && wsOptimizer) {
    wsOptimizer.optimizedSend(webSocket, message, connectionId);
    return;
  }
  
  // Fallback to direct sending
  try {
    const messageStr = getSerializedMessage(message);
    const messageBytes = encoder.encode(messageStr);
    
    // Check if message is too large and needs splitting
    if (messageBytes.length > MESSAGE_CHUNK_SIZE) {
      console.log(`Message too large (${messageBytes.length} bytes), splitting...`);
      const messageId = crypto.randomUUID();
      sendLargeMessage(webSocket, message, messageId);
      return;
    }
    
    webSocket.send(messageStr);
  } catch (error) {
    console.error('Failed to send WebSocket message:', error);
    
    // If send failed due to size, try splitting
    if (error.message && error.message.includes('too large')) {
      console.log('Message too large error, attempting to split...');
      const messageId = crypto.randomUUID();
      sendLargeMessage(webSocket, message, messageId);
    }
  }
}

async function sendLargeMessage(webSocket, message, messageId) {
  const chunks = await splitMessage(message, messageId);
  
  // If only 1 chunk returned, send directly
  if (chunks.length === 1) {
    try {
      const chunk = chunks[0];
      if (chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk)) {
        // Send binary data directly
        webSocket.send(chunk);
      } else {
        // Send JSON message
        webSocket.send(JSON.stringify(chunk));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
    return;
  }
  
  // Actually splitting into multiple chunks
  console.log(`Sending ${chunks.length - 1} chunks for large message ${messageId}`);
  
  for (const chunk of chunks) {
    try {
      if (chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk)) {
        // Send binary chunk directly
        webSocket.send(chunk);
        } else {
          // Send as JSON
          webSocket.send(JSON.stringify(chunk));
        }
    } catch (error) {
      console.error('Failed to send chunk:', error);
    }
  }
}

// Handle incoming chunked messages from client
function handleIncomingChunk(message, connection) {
  const { type, id } = message;
  
  // Handle chunking protocol messages
  if (type === 'complete') {
    // Single message, no chunking
    return message.data;
  }
  
  if (type === 'chunk') {
    const { chunkIndex, totalChunks, data } = message;
    
    if (!connection.messageChunks.has(id)) {
      connection.messageChunks.set(id, {
        chunks: new Array(totalChunks),
        receivedCount: 0,
        totalChunks
      });
    }
    
    const messageData = connection.messageChunks.get(id);
    messageData.chunks[chunkIndex] = data;
    messageData.receivedCount++;
    
    console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} for message ${id}`);
    
    // Check if all chunks received
    if (messageData.receivedCount === messageData.totalChunks) {
      const completeMessage = JSON.parse(messageData.chunks.join(''));
      connection.messageChunks.delete(id);
      console.log(`Reassembled complete message ${id}`);
      return completeMessage;
    }
    
    return null; // Still waiting for more chunks
  }
  
  if (type === 'done') {
    // Final chunk marker - cleanup if needed
    connection.messageChunks.delete(id);
    return null;
  }
  
  // Regular message that's not part of chunking protocol
  return message;
}

// Connection cleanup function
function cleanupConnection(connectionId) {
  const connection = connections.get(connectionId);
  if (connection) {
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
    }
    if (connection.timeoutHandle) {
      clearTimeout(connection.timeoutHandle);
    }
    if (connection.messageChunks) {
      connection.messageChunks.clear();
    }
    
    // Cleanup WebSocket optimizer resources
    wsOptimizer.cleanup(connectionId);
    
    connections.delete(connectionId);
    console.log(`Connection ${connectionId} cleaned up`);
  }
}

// WebSocket connection handler
function handleWebSocket(webSocket, request, env) {
  const connectionId = crypto.randomUUID();
  const connection = {
    id: connectionId,
    webSocket: webSocket,
    authenticated: false,
    lastActivity: Date.now(),
    heartbeatInterval: null,
    timeoutHandle: null,
    messageChunks: new Map(), // For reassembling chunked messages from client
    binaryChunks: [] // For reassembling binary compressed chunks
  };
  
  connections.set(connectionId, connection);
  console.log(`WebSocket connection established: ${connectionId}`);
  
  webSocket.accept();
  
  // Send connection confirmation
  sendMessage(webSocket, {
    type: 'connection',
    connectionId: connectionId,
    status: 'connected'
  }, connectionId);

  // Set up heartbeat monitoring
  const updateActivity = () => {
    connection.lastActivity = Date.now();
    
    // Reset timeout
    if (connection.timeoutHandle) {
      clearTimeout(connection.timeoutHandle);
    }
    
    connection.timeoutHandle = setTimeout(() => {
      console.log(`Connection ${connectionId} timed out due to inactivity`);
      try {
        webSocket.close(1000, 'Inactivity timeout');
      } catch (error) {
        console.error('Error closing inactive connection:', error);
      }
      cleanupConnection(connectionId);
    }, CONNECTION_TIMEOUT);
  };

  // Initial activity update
  updateActivity();
  
  webSocket.addEventListener('message', async (event) => {
    try {
      updateActivity(); // Update activity timestamp and reset timeout
      
          // Handle binary data (compressed chunks)
      if (event.data instanceof ArrayBuffer) {
        // Store binary chunk for reassembly
        console.log('Received binary chunk from client:', event.data.byteLength, 'bytes');
        
        // Store the binary chunk (we'll reassemble when we get the done message)
        if (!connection.binaryChunks) {
          connection.binaryChunks = [];
        }
        connection.binaryChunks.push(event.data);
        return;
      }
      
      // Handle JSON messages
      let rawData;
      try {
        rawData = JSON.parse(event.data);
      } catch (parseError) {
        console.error('Failed to parse JSON message:', parseError);
        sendMessage(webSocket, {
          type: 'error',
          error: {
            message: 'Invalid JSON format',
            code: 400,
            type: 'ValidationError'
          }
        }, connection.id);
        return;
      }
      
      // Handle chunked messages
      const data = handleIncomingChunk(rawData, connection);
      if (!data) {
        // Still waiting for more chunks or cleanup message
        return;
      }
      
      await handleWebSocketMessage(webSocket, data, connection, env);
    } catch (error) {
      console.error('WebSocket message handling error:', error);
      sendMessage(webSocket, {
        type: 'error',
        error: {
          message: 'Message processing error',
          code: 500,
          type: 'ProcessingError'
        }
      }, connection.id);
    }
  });
  
  webSocket.addEventListener('close', () => {
    console.log(`WebSocket connection closed: ${connectionId}`);
    cleanupConnection(connectionId);
  });
  
  webSocket.addEventListener('error', (error) => {
    console.error(`WebSocket error for connection ${connectionId}:`, error);
    cleanupConnection(connectionId);
  });
}

async function handleWebSocketMessage(webSocket, message, connection, env) {
  init(env);
  
  switch (message.type) {
    case 'auth':
      // Handle authentication
      if (message.token) {
        // TODO: Validate Firebase token
        connection.authenticated = true;
        sendMessage(webSocket, {
          type: 'auth',
          status: 'authenticated'
        });
      } else {
        sendMessage(webSocket, {
          type: 'auth',
          status: 'failed',
          error: 'No token provided'
        });
      }
      break;
      
    case 'chat':
      await handleChatMessage(webSocket, message, connection, env);
      break;
      
    case 'stop':
      handleStopMessage(message, connection);
      break;
      
    case 'ping':
      // Respond to heartbeat ping with pong
      sendMessage(webSocket, { type: 'pong' });
      console.log(`Heartbeat ping received from connection ${connection.id}`);
      break;
      
    case 'compressed_done':
      // Handle completion of compressed message chunks
      console.log(`Compressed message completed: ${message.id}`);
      
      // Reassemble binary chunks
      if (connection.binaryChunks && connection.binaryChunks.length > 0) {
        try {
          // Combine all binary chunks
          const totalSize = connection.binaryChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
          const combined = new Uint8Array(totalSize);
          let offset = 0;
          
          for (const chunk of connection.binaryChunks) {
            combined.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }
          
          console.log(`Reassembled ${connection.binaryChunks.length} chunks into ${totalSize} bytes`);
          
          // Decompress the reassembled data
          if (message.compression === 'gzip') {
            const decompressed = await decompressData(combined.buffer);
            const messageStr = new TextDecoder().decode(decompressed);
            const originalMessage = JSON.parse(messageStr);
            
            console.log(`Decompressed message: ${message.originalSize} bytes original`);
            
            // Process the reassembled message
            await handleWebSocketMessage(webSocket, originalMessage, connection, env);
          }
          
          // Clean up binary chunks
          connection.binaryChunks = [];
          
        } catch (error) {
          console.error('Failed to reassemble compressed message:', error);
          sendMessage(webSocket, {
            type: 'error',
            error: {
              message: 'Failed to process compressed message',
              code: 500,
              type: 'ProcessingError'
            }
          }, connection.id);
        }
      }
      break;
      
    default:
      sendMessage(webSocket, {
        type: 'error',
        error: {
          message: `Unknown message type: ${message.type}`,
          code: 400,
          type: 'ValidationError'
        }
      });
  }
}

async function handleChatMessage(webSocket, message, connection, env) {
  const { requestId, model, messages, temperature, max_tokens, top_p, frequency_penalty, presence_penalty } = message;
  
  if (!requestId) {
    sendMessage(webSocket, {
      type: 'error',
      error: {
        message: 'requestId is required',
        code: 400,
        type: 'ValidationError'
      }
    });
    return;
  }
  
  try {
    const chatBody = {
      requestId,
      model,
      messages,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty
    };
    
    // Start streaming response
    sendMessage(webSocket, {
      type: 'stream_start',
      requestId: requestId
    });
    
    for await (const chunk of _chat.chatCompletionStream(chatBody)) {
      if (!chunk) continue;
      
      const normalizedChunk = {
        type: 'stream_chunk',
        requestId: requestId,
        id: chunk.id !== undefined ? chunk.id : undefined,
        model: chunk.model || model?.split('/')[1],
        provider: chunk.provider || undefined,
        createdAt: chunk.createdAt !== undefined ? chunk.createdAt : undefined,
        content: typeof chunk.content === "string" ? chunk.content : (chunk.content ?? ""),
        usage: chunk.usage !== undefined ? chunk.usage : null,
        latency: typeof chunk.latency === "number" ? chunk.latency : 0,
        finishReason: chunk.finishReason !== undefined ? chunk.finishReason : null
      };
      
      // Handle raw usage data and normalize metrics
      let normalizedUsage = chunk.usage;
      
      // Extract usage from Gemini's usageMetadata format
      if (chunk.raw && chunk.raw.usageMetadata) {
        const metadata = chunk.raw.usageMetadata;
        normalizedUsage = {
          promptTokens: metadata.promptTokenCount || 0,
          completionTokens: metadata.candidatesTokenCount || 0,
          totalTokens: metadata.totalTokenCount || 0
        };
      }
      // Extract usage from OpenAI's usage format
      else if (chunk.raw && chunk.raw.usage) {
        const usage = chunk.raw.usage;
        normalizedUsage = {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        };
      }
      
      // Update normalized chunk with proper usage
      if (normalizedUsage) {
        normalizedChunk.usage = normalizedUsage;
      }
      
      // Keep raw data for debugging
      const rawUsage = (chunk.raw && (chunk.raw.usage || chunk.raw.usageMetadata)) ? {
        usage: chunk.raw.usage,
        usageMetadata: chunk.raw.usageMetadata
      } : null;
      
      if (rawUsage) normalizedChunk.raw = rawUsage;
      
      // Send chunk (will be split if too large)
      sendMessage(webSocket, normalizedChunk);
    }
    
    // Send completion message
    sendMessage(webSocket, {
      type: 'stream_complete',
      requestId: requestId
    });
    
  } catch (error) {
    console.error('Chat streaming error:', error);
    const envError = error?.error;
    const errorPayload = envError && typeof envError === "object"
      ? { error: envError }
      : { error: { message: error?.message || "Stream error", code: error?.status || 500, type: error?.name || "StreamError" } };
    
    sendMessage(webSocket, {
      type: 'stream_error',
      requestId: requestId,
      ...errorPayload
    });
  }
}

function handleStopMessage(message, connection) {
  const { requestId } = message;
  if (requestId) {
    const result = _chat.stopGeneration({ requestId });
    sendMessage(connection.webSocket, {
      type: 'stop_response',
      requestId: requestId,
      success: result.success,
      message: result.message
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade requests
    if (request.headers.get("Upgrade") === "websocket") {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      
      handleWebSocket(server, request, env);
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    const cors = (req) => {
      const origin = req.headers.get("Origin") || "*";
      return {
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Cache-Control, Connection, X-Requested-With, Upgrade",
      };
    };

    // Fast-path CORS preflight without heavy initialization
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || "*";
      const reqMethod = request.headers.get("Access-Control-Request-Method") || "GET,POST,OPTIONS";
      const reqHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": reqMethod,
          "Access-Control-Allow-Headers": reqHeaders,
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
        }
      });
    }

    const json = (status, payload, headers = {}) => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...cors(request), ...headers } });

    // Fast-path info endpoints before provider initialization
    if (request.method === "GET" && (url.pathname === "/api/health" || url.pathname === "/api/status")) {
      return json(200, { status: "ok", timestamp: new Date().toISOString() });
    }
    if (request.method === "GET" && url.pathname === "/api/ready") {
      return json(200, { ready: true, timestamp: new Date().toISOString() });
    }
    if (request.method === "GET" && url.pathname === "/api/version") {
      return json(200, { version: "2.0.0", environment: env.NODE_ENV || "development", timestamp: new Date().toISOString() });
    }
    if (request.method === "GET" && url.pathname === "/metrics") {
      return new Response("# metrics disabled on workers", { status: 200, headers: { "content-type": "text/plain", ...cors(request) } });
    }

    // Initialize config/providers only when needed
    init(env);

    if (request.method === "GET" && url.pathname === "/api/models") {
      return json(200, await _models.getAllModels());
    }
    if (request.method === "GET" && url.pathname === "/api/models/providers") {
      return json(200, await _models.getProviders());
    }
    if (request.method === "GET" && url.pathname === "/api/models/categories") {
      return json(200, await _models.getCategories());
    }
    // /api/models/:providerName
    if (request.method === "GET" && url.pathname.startsWith("/api/models/")) {
      const providerName = decodeURIComponent(url.pathname.replace("/api/models/", ""));
      if (providerName && !["providers","categories","classified","classified/criteria"].includes(providerName)) {
        const data = await _models.getProviderModels(providerName);
        return new Response(JSON.stringify(data), { status: data.error ? 404 : 200, headers: { "content-type": "application/json" } });
      }
    }
    if (request.method === "GET" && url.pathname === "/api/models/classified") {
      const data = await _models.getClassifiedModels();
      return json(data.error ? 501 : 200, data);
    }
    if (request.method === "POST" && url.pathname === "/api/models/classified/criteria") {
      const body = await request.json();
      const data = await _models.getClassifiedModelsWithCriteria(body);
      return json(data.error ? 501 : 200, data);
    }
    if (request.method === "POST" && url.pathname === "/api/chat/completions") {
      const body = await request.json();
      try {
        const data = await _chat.chatCompletion(body);
        return json(200, data, { "X-Request-ID": body.requestId || "" });
      } catch (e) {
        const payload = { error: { message: e?.message || "An unexpected error occurred.", code: e?.status || 500, type: e?.name || "ServerError" } };
        return json(200, payload, { "X-Request-ID": body.requestId || "" });
      }
    }
    if (request.method === "POST" && url.pathname === "/api/chat/stop") {
      const body = await request.json();
      const res = _chat.stopGeneration(body);
      return json(res.success ? 200 : 404, res);
    }
    if (request.method === "GET" && url.pathname === "/api/chat/capabilities") {
      return json(200, await _chat.getChatCapabilities());
    }
    if (request.method === "POST" && url.pathname === "/api/chat/stream") {
      const body = await request.json();
      if (!body.requestId) body.requestId = Math.random().toString(36).slice(2);
      const requestId = body.requestId;
      const HEARTBEAT_INTERVAL_MS = 15000;
      const TIMEOUT_DURATION_MS = 120000;
      let lastActivityTime = Date.now();
      const modelNormalized = (typeof body.model === "string" ? (body.model.includes("/") ? body.model.split("/")[1] : body.model) : undefined);
      const stream = new ReadableStream({
        start: async (controller) => {
          const write = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          const interval = setInterval(() => {
            controller.enqueue(encoder.encode(`:heartbeat\n\n`));
            if ((Date.now() - lastActivityTime) > TIMEOUT_DURATION_MS) {
              _chat.stopGeneration({ requestId });
            }
          }, HEARTBEAT_INTERVAL_MS);
          try {
            for await (const chunk of _chat.chatCompletionStream(body)) {
              lastActivityTime = Date.now();
              if (!chunk) continue;
              const normalized = {
                id: chunk.id !== undefined ? chunk.id : undefined,
                model: chunk.model || modelNormalized,
                provider: chunk.provider || undefined,
                createdAt: chunk.createdAt !== undefined ? chunk.createdAt : undefined,
                content: typeof chunk.content === "string" ? chunk.content : (chunk.content ?? ""),
                usage: chunk.usage !== undefined ? chunk.usage : null,
                latency: typeof chunk.latency === "number" ? chunk.latency : 0,
                finishReason: chunk.finishReason !== undefined ? chunk.finishReason : null
              };
              const rawUsage = (chunk.raw && (chunk.raw.usage || chunk.raw.usageMetadata)) ? {
                usage: chunk.raw.usage,
                usageMetadata: chunk.raw.usageMetadata
              } : (chunk.usage ? { usage: {
                prompt_tokens: chunk.usage.promptTokens,
                completion_tokens: chunk.usage.completionTokens,
                total_tokens: chunk.usage.totalTokens
              }} : null);
              if (rawUsage) normalized.raw = rawUsage;
              write(normalized);
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (e) {
            const envError = e?.error;
            const payload = envError && typeof envError === "object"
              ? { error: envError }
              : { error: { message: e?.message || "Stream error", code: e?.status || 500, type: e?.name || "StreamError" } };
            write(payload);
          } finally {
            clearInterval(interval);
            controller.close();
          }
        }
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", "connection": "keep-alive", "X-Request-ID": requestId, ...cors(request) } });
    }

    return json(404, { error: "Not Found" });
  }
};


