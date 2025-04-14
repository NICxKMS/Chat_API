import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { useApi } from './ApiContext';
import { useModel } from './ModelContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';

// Create chat context
export const ChatContext = createContext();

// Custom hook for using chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Chat provider component
export const ChatProvider = ({ children }) => {
  const { apiUrl } = useApi();
  const { selectedModel } = useModel();
  const { settings, getModelAdjustedSettings } = useSettings();
  const { idToken } = useAuth();

  // State for chat - Initialize as empty
  const [chatHistory, setChatHistory] = useState([]);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [error, setError] = useState(null);

  // Performance metrics state - now stored per message
  const [currentMessageMetrics, setCurrentMessageMetrics] = useState({
    startTime: null,
    endTime: null,
    elapsedTime: null,
    tokenCount: null,
    tokensPerSecond: null,
    isComplete: false,
    timeToFirstToken: null
  });

  // Reference for streaming text content - used for direct DOM updates
  const streamingTextRef = useRef('');
  const streamBufferRef = useRef('');
  const updateTimeoutRef = useRef(null);
  const isStreamingRef = useRef(false);

  // Format model identifier for API
  const formatModelIdentifier = useCallback((model) => {
    if (!model || !model.provider || !model.id) {
      return null;
    }
    return `${model.provider}/${model.id}`;
  }, []);

  // Reset performance metrics
  const resetPerformanceMetrics = useCallback(() => {
    // console.log('Resetting performance metrics');
    setCurrentMessageMetrics({
      startTime: null,
      endTime: null,
      elapsedTime: null,
      tokenCount: null,
      tokensPerSecond: null,
      isComplete: false,
      timeToFirstToken: null
    });
  }, []);

  // Start performance timer
  const startPerformanceTimer = useCallback(() => {
    // console.log('Starting performance timer');
    setCurrentMessageMetrics(prev => ({
      ...prev,
      startTime: Date.now(),
      isComplete: false
    }));
  }, []);

  // Update performance metrics
  const updatePerformanceMetrics = useCallback((tokenCount, isComplete = false) => {
    // console.log('Updating performance metrics:', { tokenCount, isComplete });
    setCurrentMessageMetrics(prev => {
      const endTime = Date.now();
      const elapsedTime = endTime - (prev.startTime || endTime);

      // Calculate tokens per second if enough time has elapsed
      let tokensPerSecond = null;
      if (elapsedTime > 500 && tokenCount) {
        tokensPerSecond = Math.round((tokenCount / elapsedTime) * 1000);
      }

      // Only update token count if it's higher than the previous count
      const newTokenCount = tokenCount > (prev.tokenCount || 0) ? tokenCount : prev.tokenCount;

      // Calculate time to first token if we have tokens but haven't set it yet
      const timeToFirstToken = prev.timeToFirstToken ||
        (newTokenCount > 0 ? elapsedTime : null);

      const newMetrics = {
        startTime: prev.startTime,
        endTime,
        elapsedTime,
        tokenCount: newTokenCount,
        tokensPerSecond,
        isComplete,
        timeToFirstToken
      };

      // console.log('New metrics state:', newMetrics);

      // Update the last assistant message's metrics
      setChatHistory(prev => {
        const newHistory = [...prev];
        const lastMessage = newHistory[newHistory.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.metrics = { ...newMetrics };
        }
        return newHistory;
      });

      return newMetrics;
    });
  }, []);

  // Extract token count from response data
  const extractTokenCount = useCallback((data, content) => {
    // Try to get token count from response data
    if (data?.tokenUsage?.output) return data.tokenUsage.output;
    if (data?.tokenUsage?.total) return data.tokenUsage.total;
    if (data?.usage?.completion_tokens) return data.usage.completion_tokens;
    if (data?.usage?.total_tokens) return data.usage.total_tokens;

    // Fallback: estimate based on content length
    return Math.ceil((content.split(/\s+/).length) * 1.3);
  }, []);

  // Add message to chat history with metrics
  const addMessageToHistory = useCallback((role, content, metrics = null) => {
    setChatHistory(prev => {
      const newMessage = { role, content };

      // If metrics are provided, add them to the message
      if (metrics) {
        newMessage.metrics = metrics;
      }
      // If this is an assistant message, always ensure metrics are attached
      else if (role === 'assistant') {
        // Use current metrics if available, otherwise create a new metrics object
        newMessage.metrics = currentMessageMetrics.tokenCount !== null
          ? { ...currentMessageMetrics }
          : {
            startTime: Date.now(),
            endTime: null,
            elapsedTime: null,
            tokenCount: null,
            tokensPerSecond: null,
            isComplete: false,
            timeToFirstToken: null
          };
      }

      // console.log('Adding message to history:', { role, content, metrics: newMessage.metrics });
      return [...prev, newMessage];
    });
    return { role, content, metrics };
  }, [currentMessageMetrics]);

  // Update chat history with new content and metrics
  const updateChatWithContent = useCallback((content) => {
    setChatHistory(prev => {
      const newHistory = [...prev];
      const lastMessage = newHistory[newHistory.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = content;
        // Always update metrics for assistant messages
        if (currentMessageMetrics.tokenCount !== null) {
          lastMessage.metrics = { ...currentMessageMetrics };
        }
      }
      return newHistory;
    });
  }, [currentMessageMetrics]);

  // Process streaming message using Fetch API with ReadableStream for optimal performance
  const streamMessageWithFetch = useCallback(async (message) => {
    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }

    const modelId = formatModelIdentifier(selectedModel);
    if (!modelId) {
      setError('Invalid model selection');
      return null;
    }

    // Add user message to history
    const userMessage = addMessageToHistory('user', message);

    // Reset metrics and start timer
    resetPerformanceMetrics();
    startPerformanceTimer();

    // Set loading state
    setIsWaitingForResponse(true);
    setError(null);

    // Add assistant response with empty content and initial metrics
    addMessageToHistory('assistant', '', { ...currentMessageMetrics, isComplete: false });

    let accumulatedContent = '';
    let accumulatedTokenCount = 0;
    let abortController = new AbortController();
    let lastRenderTime = 0;

    // Set up timeout
    let timeoutId = setTimeout(() => {
      console.log('Streaming request timed out after 60 seconds');
      abortController.abort();
      setError('Request timed out. Please try again.');
      setIsWaitingForResponse(false);
    }, 60000); // 60 second timeout

    try {
      // Get adjusted settings based on model
      const adjustedSettings = getModelAdjustedSettings(selectedModel);

      // Prepare request payload - Filter out empty assistant messages and remove metrics
      // strip metrics only
      const validMessages = chatHistory.map(msg => {
        const { metrics, ...messageWithoutMetrics } = msg;
        return messageWithoutMetrics;
      });

      // then add the new user message (unstripped, if it has no metrics field it's fine)
      validMessages.push(userMessage);


      // Add only the user message
      // validMessages.push(userMessage);

      // Create the final payload
      const payload = {
        model: modelId,
        messages: validMessages,
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty
      };

      // Log payload before streaming request
      console.log('[DEBUG] Streaming request payload:', payload);

      // Prepare optimized headers for streaming
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      };

      // Add authorization header if idToken exists
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // Construct URL for fetch API
      const streamUrl = new URL('/api/chat/stream', apiUrl).toString();

      console.log(`Starting optimized fetch streaming request to ${streamUrl}`);

      // Make the fetch request with appropriate settings for streaming
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: abortController.signal,
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage);
      }

      // Get the response body as a stream with optimized settings
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      // Variables for optimized chunk processing
      let buffer = '';
      let processingChunk = false;
      let lastRawChunkReceived = null; // Variable to store the last raw chunk

      // Begin reading the stream
      while (true) {
        const { done, value } = await reader.read();

        // Reset timeout on each chunk
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          console.log('No data received for 60 seconds, timing out');
          abortController.abort();
          setError('Connection timed out');
          setIsWaitingForResponse(false);
        }, 60000);

        if (done) {
          // Stream is complete
          console.log('Stream complete');
          if (lastRawChunkReceived) {
             console.log('[CLIENT LAST RAW CHUNK RECV]', lastRawChunkReceived);
          }
          // Process any remaining data in the buffer before breaking
          if (buffer.trim()) { // Check if buffer has content
              console.log('[DEBUG] Processing remaining buffer content after stream done:', buffer);
              console.log(`[FRONTEND RECV RAW - FINAL] Char count: ${buffer.length}`);
              // Reuse the message processing logic
              const messages = buffer.split('\n\n');
              // Don't need to save the last part now, process everything
              for (const message of messages) {
                  if (!message.trim()) continue;

                  if (message.startsWith(':heartbeat')) {
                      // Ignore heartbeats in final processing
                      continue;
                  }

                  if (message.startsWith('data:')) {
                      const data = message.slice(5).trim();

                      if (data === '[DONE]') {
                          console.log('Received [DONE] message from final buffer processing');
                          // Ensure metrics are marked as complete if DONE is found here
                          updatePerformanceMetrics(accumulatedTokenCount, true);
                          continue; // Skip further processing for [DONE]
                      }

                      try {
                          const parsedData = JSON.parse(data);
                          const content = parsedData.content || '';
                          if (content) {
                              accumulatedContent += content;
                              const chunkTokenCount = content.split(/\s+/).length || 0; // Basic token estimate
                              accumulatedTokenCount += chunkTokenCount;
                              streamingTextRef.current = accumulatedContent;
                              // Update metrics immediately for final content, but don't mark as complete yet
                              updatePerformanceMetrics(accumulatedTokenCount, false);
                          }
                      } catch (parseError) {
                          console.warn('Error parsing final message data:', parseError, data);
                      }
                  }
              }
          }
          break; // Now break the loop
        }

        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        lastRawChunkReceived = chunk; // Store the latest raw chunk received
        console.log(`[FRONTEND RECV RAW] Char count: ${chunk.length}`);
        buffer += chunk;

        // Process all complete SSE messages in the buffer
        if (!processingChunk) {
          processingChunk = true;

          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // Keep incomplete message for next chunk

          for (const message of messages) {
            if (!message.trim()) continue;

            if (message.startsWith(':heartbeat')) {
              console.log('Received heartbeat');
              continue;
            }

            if (message.startsWith('data:')) {
              const data = message.slice(5).trim();

              if (data === '[DONE]') {
                console.log('Received [DONE] message from stream');
                // Mark as complete when DONE is received normally
                updatePerformanceMetrics(accumulatedTokenCount, true);
                continue; // Skip further processing for [DONE]
              }

              try {
                const parsedData = JSON.parse(data);
                const content = parsedData.content || '';
                console.log(`[FRONTEND PROC] Content char count: ${content.length}`);
                if (content) {
                  // Add to accumulated content
                  accumulatedContent += content;

                  // Update token count for this chunk and accumulate
                  const chunkTokenCount = content.split(/\s+/).length || 0; // Basic token estimate
                  accumulatedTokenCount += chunkTokenCount;

                  // Update the streaming text ref
                  streamingTextRef.current = accumulatedContent;

                  // Optimize UI updates
                  const now = performance.now();
                  if (now - lastRenderTime > 16) { // ~60fps update rate
                    const currentContent = accumulatedContent;
                    const currentTokenCount = accumulatedTokenCount;
                    window.requestAnimationFrame(() => {
                      updateChatWithContent(currentContent);
                      // Update metrics but don't mark as complete here
                      updatePerformanceMetrics(currentTokenCount, false);
                    });
                    lastRenderTime = now;
                  }
                }
              } catch (parseError) {
                console.warn('Error parsing message data:', parseError, data);
              }
            }
          }

          processingChunk = false;
        }
      } // End of while loop

      // Final update to ensure all content is displayed and metrics marked complete
      window.requestAnimationFrame(() => {
        updateChatWithContent(accumulatedContent);
        // Ensure performance metrics are marked as complete finally
        updatePerformanceMetrics(accumulatedTokenCount, true);
      });

      // Stream is complete
      setIsWaitingForResponse(false);
      return accumulatedContent;

    } catch (error) {
      console.error('Error in fetch streaming:', error);
      setError(error.message || 'An error occurred during streaming');
      setIsWaitingForResponse(false);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [
    apiUrl, selectedModel, chatHistory, getModelAdjustedSettings,
    addMessageToHistory, formatModelIdentifier, resetPerformanceMetrics,
    startPerformanceTimer, updatePerformanceMetrics,
    setError, setIsWaitingForResponse, updateChatWithContent,
    idToken
  ]);

  // Send message to API - decide between streaming and non-streaming
  const sendMessage = useCallback(async (message) => {
    // Use streaming if enabled in settings
    if (settings.streaming) {
      return streamMessageWithFetch(message);
    }

    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }

    const modelId = formatModelIdentifier(selectedModel);
    if (!modelId) {
      setError('Invalid model selection');
      return null;
    }

    // Add user message to history
    const userMessage = addMessageToHistory('user', message);

    // Reset metrics and start timer
    resetPerformanceMetrics();
    startPerformanceTimer();

    // Set loading state
    setIsWaitingForResponse(true);
    setError(null);

    try {
      // Get adjusted settings based on model
      const adjustedSettings = getModelAdjustedSettings(selectedModel);

      // Prepare request headers conditionally
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add authorization header if idToken exists
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // Prepare request payload
      const payload = {
        model: modelId,
        messages: [...chatHistory, userMessage].map(msg => {
          const { metrics, ...messageWithoutMetrics } = msg;
          return messageWithoutMetrics;
        }),
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty
      };

      // Log payload before non-streaming request
      console.log('[DEBUG] Non-streaming request payload:', payload);

      // Construct URL safely
      const completionsUrl = new URL('/api/chat/completions', apiUrl).toString();
      const response = await fetch(completionsUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage);
      }

      // Parse response
      const data = await response.json();
      // console.log('[DEBUG] Received non-streamed message:', data);
      const content = data.content || '';

      // Add AI response to history
      addMessageToHistory('assistant', content);

      // Calculate token count and update metrics
      const tokenCount = extractTokenCount(data, content);
      updatePerformanceMetrics(tokenCount, true);

      return content;
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message);
      return null;
    } finally {
      setIsWaitingForResponse(false);
    }
  }, [
    apiUrl, selectedModel, chatHistory, settings, getModelAdjustedSettings,
    addMessageToHistory, formatModelIdentifier, resetPerformanceMetrics,
    startPerformanceTimer, updatePerformanceMetrics, extractTokenCount,
    setError, setIsWaitingForResponse, streamMessageWithFetch,
    idToken
  ]);

  // Reset chat history
  const resetChat = useCallback(() => {
    setChatHistory([]);
    resetPerformanceMetrics();
    setError(null);
  }, [resetPerformanceMetrics]);

  // Download chat history as JSON
  const downloadChatHistory = useCallback(() => {
    if (chatHistory.length === 0) {
      setError('No chat history to download');
      return;
    }

    try {
      // Create JSON string with pretty formatting
      const historyJson = JSON.stringify(chatHistory, null, 2);

      // Create blob
      const blob = new Blob([historyJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');

      // Format date for filename
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      a.href = url;
      a.download = `chat-history-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error downloading chat history:', error);
      setError('Failed to download chat history');
    }
  }, [chatHistory]);

  // Optimized streaming update function with buffering
  const updateStreamingText = useCallback((newChunk) => {
    if (!isStreamingRef.current) {
      isStreamingRef.current = true;
    }

    // Add to buffer
    streamBufferRef.current += newChunk;

    // Update the streaming text ref directly
    // The StreamingMessage component will handle the word-by-word display
    streamingTextRef.current = streamBufferRef.current;

    // No need for excessive throttling since StreamingMessage handles the typing effect
    // Just ensure the reference is updated immediately for the typing component to access
  }, []);

  const finishStreaming = useCallback(() => {
    // Final update to ensure buffer is fully flushed
    streamingTextRef.current = streamBufferRef.current;

    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    isStreamingRef.current = false;
  }, []);

  // Memoize the context value
  const contextValue = useMemo(() => ({
    chatHistory,
    isWaitingForResponse,
    error,
    metrics: currentMessageMetrics,
    submitMessage: sendMessage,
    resetChat,
    downloadChatHistory,
    updateChatWithContent,
    streamingTextRef,
    updateStreamingText,
    finishStreaming,
    isStreaming: isStreamingRef.current
  }), [
    chatHistory,
    isWaitingForResponse,
    error,
    currentMessageMetrics,
    sendMessage,
    resetChat,
    downloadChatHistory,
    updateChatWithContent,
    updateStreamingText,
    finishStreaming
  ]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}; 