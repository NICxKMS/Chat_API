import React, { createContext, useContext, useRef, useCallback, useMemo, useEffect } from 'react';
import { useApi } from './ApiContext';
import { useModel } from './ModelContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { useChatHistory } from './ChatHistoryContext';
import { useChatStatus } from './ChatStatusContext';
import { usePerformanceMetrics } from './PerformanceMetricsContext';
import { generateRequestId, generateUUID } from '../utils/uuid';
import debounce from 'lodash.debounce';

// Create a context for streaming events and logic
const StreamingEventsContext = createContext();

export const useStreamingEvents = () => {
  const context = useContext(StreamingEventsContext);
  if (context === undefined) {
    throw new Error('useStreamingEvents must be used within a StreamingEventsProvider');
  }
  return context;
};

export const StreamingEventsProvider = ({ children }) => {
  const { apiUrl } = useApi();
  const { selectedModel } = useModel();
  const { getModelAdjustedSettings } = useSettings();
  const { idToken } = useAuth();
  const { chatHistoryRef, setChatHistory, addMessageToHistory, updateChatWithContent } = useChatHistory();
  const { setIsWaitingForResponse, setError } = useChatStatus();
  const { resetPerformanceMetrics, startPerformanceTimer, updatePerformanceMetrics } = usePerformanceMetrics();

  // Refs for WebSocket streaming
  const streamingTextRef = useRef('');
  const currentRequestIdRef = useRef(null);
  const isStreamingRef = useRef(false);
  const firstTokenReceivedRef = useRef(false);

  // WebSocket connection management
  const webSocketRef = useRef(null);
  const connectionStateRef = useRef('disconnected'); // 'disconnected', 'connecting', 'connected'
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const messageChunksRef = useRef(new Map()); // For reassembling chunked messages
  const pendingRequestsRef = useRef(new Map()); // Track pending requests
  
  // Heartbeat management
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const lastPongRef = useRef(Date.now());
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const HEARTBEAT_TIMEOUT = 10000; // 10 seconds to wait for pong
  
  // Message splitting for large outgoing messages
  const MESSAGE_CHUNK_SIZE = 800 * 1024; // 800KB chunks
  
  // Reusable encoder to avoid recreation overhead
  const textEncoder = useMemo(() => new TextEncoder(), []);
  
  // WebSocket optimization settings
  const WS_OPTIMIZATION = {
    binaryType: 'arraybuffer', // Use binary frames for better performance
    maxBackpressure: 16 * 1024, // 16KB backpressure limit
    compressionThreshold: 1024, // Compress messages > 1KB
    batchingWindow: 1, // Reduced from 3ms to 1ms for faster non-critical messages
  };

  // Adaptive debounced content updater - optimized for streaming performance
  const debouncedUpdateChat = useMemo(() => {
    let lastUpdateTime = 0;
    let updateCount = 0;
    let isInStream = false;
    let consecutiveUpdates = 0;
    
    return debounce((content) => {
      const now = Date.now();
      const timeDelta = now - lastUpdateTime;
      updateCount++;
      
      // Detect if we're in an active stream (frequent updates)
      if (timeDelta < 100) {
        consecutiveUpdates++;
        isInStream = consecutiveUpdates > 3;
      } else {
        consecutiveUpdates = 0;
        isInStream = false;
      }
      
      // Stream-optimized delays: much faster during active streaming
      let adaptiveDelay;
      if (isInStream) {
        // During active streaming: very fast updates (2-8ms)
        adaptiveDelay = Math.min(8, Math.max(2, content.length / 5000));
      } else {
        // Non-streaming: slower, content-based delays (10-30ms)
        adaptiveDelay = Math.min(30, Math.max(10, content.length / 1000));
      }
      
      updateChatWithContent(content);
      lastUpdateTime = now;
      
      // Reset counter periodically
      if (updateCount > 100) {
        updateCount = 0;
        consecutiveUpdates = 0;
      }
    }, 8); // Reduced base delay from 15ms to 8ms for faster streaming
  }, [updateChatWithContent]);

  // WebSocket URL construction
  const getWebSocketUrl = useCallback(() => {
    if (!apiUrl) return null;
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    return wsUrl;
  }, [apiUrl]);

  // Heartbeat functions
  const startHeartbeat = useCallback(() => {
    stopHeartbeat(); // Clear any existing heartbeat
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (webSocketRef.current && connectionStateRef.current === 'connected') {
        // Send ping
        try {
          webSocketRef.current.send(JSON.stringify({ type: 'ping' }));
          console.log('Sent heartbeat ping');
          
          // Set timeout to wait for pong
          heartbeatTimeoutRef.current = setTimeout(() => {
            console.warn('Heartbeat timeout - no pong received');
            // Force reconnection if no pong received
            if (webSocketRef.current) {
              webSocketRef.current.close(1000, 'Heartbeat timeout');
            }
          }, HEARTBEAT_TIMEOUT);
          
        } catch (error) {
          console.error('Failed to send heartbeat ping:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const handlePong = useCallback(() => {
    lastPongRef.current = Date.now();
    console.log('Received heartbeat pong');
    
    // Clear the timeout since we received pong
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Compression utility
  const compressData = useCallback(async (text) => {
    if (typeof CompressionStream === 'undefined') {
      // Fallback: return uncompressed data
      return { data: new TextEncoder().encode(text), compressed: false };
    }

    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      // Start compression
      writer.write(new TextEncoder().encode(text));
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
      return { data: new TextEncoder().encode(text), compressed: false };
    }
  }, []);

  // Optimized compression-first message splitting
  const splitOutgoingMessage = useCallback(async (message) => {
    const messageStr = JSON.stringify(message);
    const originalSize = new TextEncoder().encode(messageStr).byteLength;
    
    // Step 1: Compress if beneficial (>40KB)
    const shouldCompress = originalSize > 40 * 1024;
    let compressed, compressedSize;
    
    if (shouldCompress) {
      const compressionResult = await compressData(messageStr);
      compressed = compressionResult.data;
      compressedSize = compressed.byteLength;
      
      console.log(`Compression: ${originalSize} → ${compressedSize} bytes (${((1 - compressedSize/originalSize) * 100).toFixed(1)}% reduction)`);
    } else {
      // No compression, calculate size but don't encode yet
      compressedSize = originalSize;
    }
    
    // Step 2: Check if chunking needed
    if (compressedSize <= MESSAGE_CHUNK_SIZE) {
      if (shouldCompress) {
        // Send compressed binary directly
        return [compressed];
      } else {
        // Send original message directly
        return [message];
      }
    }
    
    // Step 3: Binary chunking of compressed data
    console.log(`Splitting compressed message: ${compressedSize} bytes into binary chunks`);
    
    const chunks = [];
    const messageId = generateUUID();
    const totalChunks = Math.ceil(compressedSize / MESSAGE_CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * MESSAGE_CHUNK_SIZE;
      const end = Math.min(start + MESSAGE_CHUNK_SIZE, compressedSize);
      const chunkData = compressed.slice(start, end);
      
      chunks.push(chunkData);
    }
    
    // Send final marker
    chunks.push({ 
      type: 'compressed_done', 
      id: messageId,
      compression: 'gzip',
      originalSize: originalSize,
      compressedSize: compressedSize
    });
    
    return chunks;
  }, [compressData]);


  // WebSocket message optimizer for batching and efficiency
  const messageOptimizerRef = useRef({
    queue: [],
    batchTimer: null,
    
    addMessage: async function(message) {
      // Critical messages send immediately
      const criticalTypes = ['auth', 'chat', 'stop', 'ping'];
      if (criticalTypes.includes(message.type)) {
        await this.flushQueue();
        await this.sendImmediate(message);
        return;
      }
      
      // Queue non-critical messages for batching
      this.queue.push(message);
      
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(async () => {
          await this.flushQueue();
        }, WS_OPTIMIZATION.batchingWindow);
      }
    },
    
    flushQueue: async function() {
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      
      if (this.queue.length === 0) return;
      
      // Send all queued messages
      const messages = [...this.queue];
      this.queue = [];
      
      for (const message of messages) {
        await this.sendImmediate(message);
      }
    },
    
    sendImmediate: async function(message) {
      if (webSocketRef.current && connectionStateRef.current === 'connected') {
        try {
          // Check if message needs splitting - use reusable encoder
          const messageStr = JSON.stringify(message);
          const messageBytes = textEncoder.encode(messageStr);
          
          if (messageBytes.length > MESSAGE_CHUNK_SIZE) {
            await sendLargeMessage(message);
          } else {
            webSocketRef.current.send(messageStr);
          }
        } catch (error) {
          console.error('Failed to send WebSocket message:', error);
        }
      }
    },
    
    cleanup: function() {
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      this.queue = [];
    }
  });

  const sendLargeMessage = useCallback(async (message) => {
    if (!webSocketRef.current || connectionStateRef.current !== 'connected') {
      return false;
    }
    
    try {
      const chunks = await splitOutgoingMessage(message);
      
      // If only 1 chunk returned, send directly
      if (chunks.length === 1) {
        try {
          const chunk = chunks[0];
          if (chunk instanceof ArrayBuffer || chunk instanceof Uint8Array) {
            // Send binary data directly
            webSocketRef.current.send(chunk);
          } else {
            // Send JSON message
            webSocketRef.current.send(JSON.stringify(chunk));
          }
          return true;
        } catch (error) {
          console.error('Failed to send message:', error);
          return false;
        }
      }
      
      // Actually splitting into multiple chunks
      console.log(`Sending ${chunks.length - 1} chunks for large message`);
      
      for (const chunk of chunks) {
        try {
          if (chunk instanceof ArrayBuffer || chunk instanceof Uint8Array) {
            // Send binary chunk directly
            webSocketRef.current.send(chunk);
          } else if (typeof chunk === 'string') {
            // Send JSON string directly
            webSocketRef.current.send(chunk);
          } else {
            // Send as JSON
            webSocketRef.current.send(JSON.stringify(chunk));
          }
        } catch (error) {
          console.error('Failed to send chunk:', error);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to split message:', error);
      return false;
    }
  }, [splitOutgoingMessage]);

  // Message chunk handling
  const handleMessageChunk = useCallback((message) => {
    const { type, id } = message;
    
    // Handle chunking protocol messages
    if (type === 'complete') {
      // Single message, no chunking
      return message.data;
    }
    
    if (type === 'chunk') {
      const { chunkIndex, totalChunks, data } = message;
      
      if (!messageChunksRef.current.has(id)) {
        messageChunksRef.current.set(id, {
          chunks: new Array(totalChunks),
          receivedCount: 0,
          totalChunks
        });
      }
      
      const messageData = messageChunksRef.current.get(id);
      messageData.chunks[chunkIndex] = data;
      messageData.receivedCount++;
      
      // Check if all chunks received
      if (messageData.receivedCount === messageData.totalChunks) {
        const completeMessage = JSON.parse(messageData.chunks.join(''));
        messageChunksRef.current.delete(id);
        return completeMessage;
      }
      
      return null; // Still waiting for more chunks
    }
    
    if (type === 'done') {
      // Final chunk marker - cleanup if needed
      messageChunksRef.current.delete(id);
      return null;
    }
    
    // Regular message that's not part of chunking protocol
    return message;
  }, []);

  // Optimized WebSocket message handler with fast paths
  const handleWebSocketMessage = useCallback((event) => {
    const startTime = performance.now();
    
    // Handle binary data (compressed chunks from server)
    if (event.data instanceof ArrayBuffer) {
      console.log('Received binary chunk from server:', event.data.byteLength, 'bytes');
      // TODO: Implement binary chunk reassembly
      return;
    }
    
    // Handle JSON messages
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error('Invalid JSON received:', error);
      return;
    }
    
    // OPTIMIZATION: Ultra-fast path for stream chunks (most common during streaming)
    if (message.type === 'stream_chunk') {
      processRegularMessage(message);
      
      // Track fast path usage for performance metrics
      const processingTime = performance.now() - startTime;
      updatePerformanceMetrics({
        fastPathUsed: true,
        processingTime: processingTime,
        messageType: 'stream_chunk'
      });
      return;
    }
    
    // Fast path for other non-chunked messages
    if (!message.type || !['chunk', 'complete', 'done'].includes(message.type)) {
      processRegularMessage(message);
      return;
    }
    
    // Handle chunked messages (rare case)
    const reassembledMessage = handleMessageChunk(message);
    if (!reassembledMessage) return; // Still waiting for chunks
    
    processRegularMessage(reassembledMessage);
    
    // Performance tracking
    const processingTime = performance.now() - startTime;
    if (processingTime > 10) { // Log slow processing
      console.warn(`Slow message processing: ${processingTime.toFixed(2)}ms`);
    }
  }, [handleMessageChunk]);

  // Separate function for processing regular messages
  const processRegularMessage = useCallback((message) => {
    const { type, requestId } = message;
      
      switch (type) {
        case 'connection':
          console.log('WebSocket connected:', message.connectionId);
          connectionStateRef.current = 'connected';
          reconnectAttemptsRef.current = 0;
          
          // Start heartbeat
          startHeartbeat();
          
          // Authenticate if we have a token
          if (idToken) {
            webSocketRef.current?.send(JSON.stringify({
              type: 'auth',
              token: idToken
            }));
          }
          break;
          
        case 'auth':
          console.log('Authentication status:', message.status);
          break;
          
        case 'stream_start':
          console.log('Stream started for request:', requestId);
          break;
          
        case 'stream_chunk':
          if (requestId === currentRequestIdRef.current) {
            // Handle server-sent error payload
            if (message.error || message.finishReason === 'error') {
              const errMsg = message.error?.message || 'Error occurred during generation';
              console.error('Error in WebSocket payload:', errMsg);
              setError(errMsg);
              setChatHistory(prev => {
                const newHistory = [...prev];
                const lastMsg = newHistory[newHistory.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content += `\n\n**Error:** ${errMsg}`;
                  if (lastMsg.metrics) {
                    lastMsg.metrics.isComplete = true;
                    lastMsg.metrics.error = true;
                  }
                }
                return newHistory;
              });
              return;
            }
            
            // Append any content from the chunk
            if (message.content) {
              // Record time to first token once
              if (!firstTokenReceivedRef.current) {
                updatePerformanceMetrics(1);
                firstTokenReceivedRef.current = true;
              }
              
              streamingTextRef.current += message.content;
              debouncedUpdateChat(streamingTextRef.current);
            }
            
            // Always use server-reported completion tokens for metrics
            const completionTokens = message.usage?.completionTokens ?? 0;
            updatePerformanceMetrics(completionTokens, false, message.usage, message.finishReason);
          }
          break;
          
        case 'stream_complete':
          if (requestId === currentRequestIdRef.current) {
            console.log('Stream completed for request:', requestId);
            debouncedUpdateChat.flush();
            updateChatWithContent(streamingTextRef.current);
            isStreamingRef.current = false;
            setIsWaitingForResponse(false);
            currentRequestIdRef.current = null;
            
            // Resolve pending promise
            const pendingRequest = pendingRequestsRef.current.get(requestId);
            if (pendingRequest) {
              if (pendingRequest.timeout) {
                clearTimeout(pendingRequest.timeout);
              }
              if (pendingRequest.resolve) {
                pendingRequest.resolve(streamingTextRef.current);
              }
              pendingRequestsRef.current.delete(requestId);
            }
          }
          break;
          
        case 'stream_error':
          if (requestId === currentRequestIdRef.current) {
            const errMsg = message.error?.message || 'Stream error occurred';
            console.error('Stream error:', errMsg);
            setError(errMsg);
            setChatHistory(prev => {
              const newHistory = [...prev];
              const lastMsg = newHistory[newHistory.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content += `\n\n**Error:** ${errMsg}`;
                if (lastMsg.metrics) {
                  lastMsg.metrics.isComplete = true;
                  lastMsg.metrics.error = true;
                }
              }
              return newHistory;
            });
            isStreamingRef.current = false;
            setIsWaitingForResponse(false);
            currentRequestIdRef.current = null;
            
            // Reject pending promise
            const pendingRequest = pendingRequestsRef.current.get(requestId);
            if (pendingRequest) {
              if (pendingRequest.timeout) {
                clearTimeout(pendingRequest.timeout);
              }
              if (pendingRequest.reject) {
                pendingRequest.reject(new Error(errMsg));
              }
              pendingRequestsRef.current.delete(requestId);
            }
          }
          break;
          
        case 'stop_response':
          console.log('Stop response:', message);
          break;
          
        case 'error':
          console.error('WebSocket error:', message.error);
          setError(message.error?.message || 'WebSocket error occurred');
          break;
          
        case 'pong':
          // Heartbeat response
          handlePong();
          break;
          
        default:
          console.warn('Unknown WebSocket message type:', type);
      }
  }, [idToken, debouncedUpdateChat, updateChatWithContent, setError, setIsWaitingForResponse, 
      setChatHistory, updatePerformanceMetrics, startHeartbeat, handlePong]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (connectionStateRef.current === 'connected' || connectionStateRef.current === 'connecting') {
      return;
    }
    
    const wsUrl = getWebSocketUrl();
    if (!wsUrl) {
      console.error('No WebSocket URL available');
      return;
    }
    
    connectionStateRef.current = 'connecting';
    console.log('Connecting to WebSocket:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      
      // Apply WebSocket optimizations
      ws.binaryType = WS_OPTIMIZATION.binaryType;
      
      webSocketRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connection opened with optimizations');
        console.log('- Binary type:', ws.binaryType);
        console.log('- Batching window:', WS_OPTIMIZATION.batchingWindow + 'ms');
      };
      
      ws.onmessage = handleWebSocketMessage;
      
      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        connectionStateRef.current = 'disconnected';
        webSocketRef.current = null;
        
        // Stop heartbeat
        stopHeartbeat();
        
        // Cleanup message optimizer
        messageOptimizerRef.current.cleanup();
        
        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
          setError('Connection lost. Please refresh the page.');
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        connectionStateRef.current = 'disconnected';
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      connectionStateRef.current = 'disconnected';
      setError('Failed to connect to server');
    }
  }, [getWebSocketUrl, handleWebSocketMessage, setError]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Stop heartbeat
    stopHeartbeat();
    
    if (webSocketRef.current) {
      webSocketRef.current.close(1000, 'Client disconnect');
      webSocketRef.current = null;
    }
    
    connectionStateRef.current = 'disconnected';
  }, [stopHeartbeat]);

  // Send WebSocket message
  const sendWebSocketMessage = useCallback(async (message) => {
    if (connectionStateRef.current !== 'connected' || !webSocketRef.current) {
      console.warn('WebSocket not connected, attempting to connect...');
      connectWebSocket();
      return false;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(messageStr);
      
      // Check if message is too large and needs splitting
      if (messageBytes.length > MESSAGE_CHUNK_SIZE) {
        console.log(`Message too large (${messageBytes.length} bytes), splitting...`);
        return await sendLargeMessage(message);
      }
      
      webSocketRef.current.send(messageStr);
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      
      // If send failed due to size, try splitting
      if (error.message && error.message.includes('too large')) {
        console.log('Message too large error, attempting to split...');
        return await sendLargeMessage(message);
      }
      
      return false;
    }
  }, [connectWebSocket, sendLargeMessage]);

  // Stream a message using WebSocket
  const streamMessageWithFetch = useCallback(async (message, editIndex = null) => {
    // Generate and store a client-side requestId for this stream
    const requestId = generateRequestId();
    
    currentRequestIdRef.current = requestId;
    const isEditing = editIndex !== null && Number.isInteger(editIndex) && editIndex >= 0;
    
    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }
    
    const modelId = `${selectedModel.provider}/${selectedModel.id}`;
    if (!modelId) {
      setError('Invalid model selection');
      return null;
    }
    
    // Ensure WebSocket connection
    if (connectionStateRef.current !== 'connected') {
      connectWebSocket();
      // Wait for connection with timeout
      const connectionTimeout = 5000;
      const startTime = Date.now();
      while (connectionStateRef.current !== 'connected' && Date.now() - startTime < connectionTimeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (connectionStateRef.current !== 'connected') {
        setError('Failed to connect to server');
        return null;
      }
    }
    
    let userMessage;
    if (isEditing) {
      setChatHistory(prev => {
        const truncated = prev.slice(0, editIndex);
        const original = prev[editIndex];
        // Preserve original id/timestamp, only update content
        userMessage = { ...original, content: message };
        return [...truncated, userMessage];
      });
    } else {
      userMessage = addMessageToHistory('user', message);
    }
    
    resetPerformanceMetrics();
    startPerformanceTimer();
    firstTokenReceivedRef.current = false;
    setIsWaitingForResponse(true);
    setError(null);
    streamingTextRef.current = '';
    isStreamingRef.current = true;
    addMessageToHistory('assistant', '');
    
    try {
      const adjusted = getModelAdjustedSettings(selectedModel);
      // Build API history without the placeholder assistant message (empty content)
      const historyForApi = chatHistoryRef.current
        .slice(0, -1)
        .map(({ metrics, ...m }) => m);
      
      if (adjusted.systemPrompt && (!historyForApi.length || historyForApi[0].role !== 'system')) {
        historyForApi.unshift({ role: 'system', content: adjusted.systemPrompt, timestamp: Date.now() - 1 });
      }
      
      const payload = {
        type: 'chat',
        requestId,
        model: modelId,
        messages: historyForApi,
        temperature: adjusted.temperature,
        max_tokens: adjusted.max_tokens,
        top_p: adjusted.top_p,
        frequency_penalty: adjusted.frequency_penalty,
        presence_penalty: adjusted.presence_penalty
      };
      
      pendingRequestsRef.current.set(requestId, {
        startTime: Date.now(),
        payload
      });
      
      const sent = await sendWebSocketMessage(payload);
      if (!sent) {
        throw new Error('Failed to send message to server');
      }
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequestsRef.current.delete(requestId);
          if (currentRequestIdRef.current === requestId) {
            currentRequestIdRef.current = null;
            isStreamingRef.current = false;
          setIsWaitingForResponse(false);
            setError('Request timed out');
            reject(new Error('Request timed out'));
          }
        }, 120000); // 2 minute timeout
        
        // Store resolve/reject for completion handling
        pendingRequestsRef.current.get(requestId).resolve = resolve;
        pendingRequestsRef.current.get(requestId).reject = reject;
        pendingRequestsRef.current.get(requestId).timeout = timeout;
      });
      
    } catch (error) {
      console.error('Error streaming message:', error);
      setError(error.message);
      
      // Show the server error content as the assistant's message
      setChatHistory(prev => {
        const newHistory = [...prev];
        const lastMsg = newHistory[newHistory.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += `\n\n**Error:** ${error.message || 'Error occurred during generation'}`;
          if (lastMsg.metrics) {
            lastMsg.metrics.isComplete = true;
            lastMsg.metrics.error = true;
          }
        }
        return newHistory;
      });
      
      isStreamingRef.current = false;
      setIsWaitingForResponse(false);
      currentRequestIdRef.current = null;
      pendingRequestsRef.current.delete(requestId);
      return null;
    }
  }, [
    selectedModel, getModelAdjustedSettings, connectWebSocket, sendWebSocketMessage,
    chatHistoryRef, setChatHistory, addMessageToHistory, setError, setIsWaitingForResponse,
    resetPerformanceMetrics, startPerformanceTimer
  ]);

  const stopStreaming = useCallback(async () => {
    const reqId = currentRequestIdRef.current;
    if (reqId) {
      const stopMessage = {
        type: 'stop',
        requestId: reqId
      };
      
      await sendWebSocketMessage(stopMessage);
      
      // Clean up pending request
      const pendingRequest = pendingRequestsRef.current.get(reqId);
      if (pendingRequest) {
        if (pendingRequest.timeout) {
          clearTimeout(pendingRequest.timeout);
        }
        if (pendingRequest.reject) {
          pendingRequest.reject(new Error('Stopped by user'));
        }
        pendingRequestsRef.current.delete(reqId);
      }
      
        currentRequestIdRef.current = null;
      }
    
    isStreamingRef.current = false;
    setIsWaitingForResponse(false);
    return true;
  }, [sendWebSocketMessage, setIsWaitingForResponse]);

  // Initialize WebSocket connection on mount
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  // Handle authentication token changes
  useEffect(() => {
    if (connectionStateRef.current === 'connected' && idToken && webSocketRef.current) {
      (async () => {
        await sendWebSocketMessage({
          type: 'auth',
          token: idToken
        });
      })();
    }
  }, [idToken, sendWebSocketMessage]);

  // Handle completion of streaming requests
  useEffect(() => {
    const handleStreamComplete = (requestId) => {
      const pendingRequest = pendingRequestsRef.current.get(requestId);
      if (pendingRequest) {
        if (pendingRequest.timeout) {
          clearTimeout(pendingRequest.timeout);
        }
        if (pendingRequest.resolve) {
          pendingRequest.resolve(streamingTextRef.current);
        }
        pendingRequestsRef.current.delete(requestId);
      }
    };

    // This effect will be triggered by the WebSocket message handler
    // when stream_complete messages are received
    return () => {
      // Cleanup any pending timeouts on unmount
      for (const [requestId, pendingRequest] of pendingRequestsRef.current) {
        if (pendingRequest.timeout) {
          clearTimeout(pendingRequest.timeout);
        }
        if (pendingRequest.reject) {
          pendingRequest.reject(new Error('Component unmounted'));
        }
      }
      pendingRequestsRef.current.clear();
      
      // Stop heartbeat on unmount
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  const value = useMemo(() => ({
    streamMessageWithFetch,
    stopStreaming,
    streamingTextRef,
    isStreaming: () => isStreamingRef.current,
    connectionState: () => connectionStateRef.current,
    connectWebSocket,
    disconnectWebSocket
  }), [streamMessageWithFetch, stopStreaming, connectWebSocket, disconnectWebSocket]);

  return (
    <StreamingEventsContext.Provider value={value}>
      {children}
    </StreamingEventsContext.Provider>
  );
}; 