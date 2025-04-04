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
  const { idToken, isAuthenticated } = useAuth();
  
  // State for chat - Initialize as empty
  const [chatHistory, setChatHistory] = useState([]); // Reverted to empty array
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [error, setError] = useState(null);
  
  // Performance metrics state
  const [metrics, setMetrics] = useState({
    startTime: null,
    endTime: null,
    elapsedTime: null,
    tokenCount: null,
    tokensPerSecond: null,
    isComplete: false
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
    setMetrics({
      startTime: null,
      endTime: null,
      elapsedTime: null,
      tokenCount: null,
      tokensPerSecond: null,
      isComplete: false
    });
  }, []);
  
  // Start performance timer
  const startPerformanceTimer = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      startTime: Date.now(),
      isComplete: false
    }));
  }, []);
  
  // Update performance metrics
  const updatePerformanceMetrics = useCallback((tokenCount, isComplete = false) => {
    setMetrics(prev => {
      const endTime = Date.now();
      const elapsedTime = endTime - (prev.startTime || endTime);
      
      // Calculate tokens per second if enough time has elapsed
      let tokensPerSecond = null;
      if (elapsedTime > 500 && tokenCount) {
        tokensPerSecond = Math.round((tokenCount / elapsedTime) * 1000);
      }
      
      return {
        startTime: prev.startTime,
        endTime,
        elapsedTime,
        tokenCount,
        tokensPerSecond,
        isComplete
      };
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
  
  // Add message to chat history
  const addMessageToHistory = useCallback((role, content) => {
    setChatHistory(prev => [...prev, { role, content }]);
    return { role, content };
  }, []);
  
  // Helper function to update chat history with new content
  // Using an optimized approach to minimize re-renders
  const updateChatWithContent = useCallback((content) => {
    // Store the latest content in the ref for direct DOM access
    streamingTextRef.current = content;
    
    // Use React's functional update to ensure we're working with the latest state
    setChatHistory(prev => {
      const updated = [...prev];
      const assistantIndex = updated.length - 1;
      
      // Only update if we have a valid assistant message to update
      if (assistantIndex >= 0 && updated[assistantIndex].role === 'assistant') {
        // Only update if content has changed to avoid unnecessary re-renders
        if (updated[assistantIndex].content !== content) {
          updated[assistantIndex] = { 
            role: 'assistant', 
            content: content 
          };
          return updated;
        }
      }
      
      // Return the same reference if no change is needed
      return prev;
    });
  }, []);
  
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
    
    // Add assistant response with empty content initially
    addMessageToHistory('assistant', '');
    
    let accumulatedContent = '';
    let tokenCount = 0;
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
      
      // Prepare request payload - Filter out empty assistant messages
      const validMessages = [...chatHistory].filter(msg => {
        if (msg.role === 'user') return true;
        return (msg.role === 'assistant' && msg.content && msg.content.trim() !== '');
      });
      
      // Add only the user message
      validMessages.push(userMessage);
      
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
      
      // Prepare optimized headers for streaming
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      };
      
      if (isAuthenticated && idToken) {
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
          break;
        }
        
        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process all complete SSE messages in the buffer
        // Don't process overlapping calls
        if (!processingChunk) {
          processingChunk = true;
          
          // Split by double newlines to find complete SSE messages
          const messages = buffer.split('\n\n');
          
          // Keep the last potentially incomplete message in the buffer
          buffer = messages.pop() || '';
          
          // Process each complete message
          for (const message of messages) {
            if (!message.trim()) continue;
            
            // Check for heartbeat
            if (message.startsWith(':heartbeat')) {
              console.log('Received heartbeat');
              continue;
            }
            
            // Process data message
            if (message.startsWith('data:')) {
              const data = message.slice(5).trim();
              
              // Check for [DONE] message
              if (data === '[DONE]') {
                console.log('Received [DONE] message from stream');
                updatePerformanceMetrics(tokenCount, true);
                continue;
              }
              
              // Parse the JSON data
              try {
                const parsedData = JSON.parse(data);
                const content = parsedData.content || '';
                
                if (content) {
                  // Add to accumulated content immediately
                  accumulatedContent += content;
                  
                  // Update the streaming text ref for direct DOM updates
                  streamingTextRef.current = accumulatedContent;
                  
                  // Update token count estimate
                  tokenCount += content.split(/\s+/).length || 0;
                  
                  // Optimize UI updates to avoid React re-render thrashing
                  // Use requestAnimationFrame for smoother visual experience
                  const now = performance.now();
                  if (now - lastRenderTime > 16) { // ~60fps update rate
                    const currentContent = accumulatedContent;
                    const currentTokenCount = tokenCount;
                    window.requestAnimationFrame(() => {
                      updateChatWithContent(currentContent);
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
      }
      
      // Final update to ensure all content is displayed
      window.requestAnimationFrame(() => {
        updateChatWithContent(accumulatedContent);
        updatePerformanceMetrics(tokenCount, true);
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
    isAuthenticated, idToken, setError, setIsWaitingForResponse, updateChatWithContent
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
      if (isAuthenticated && idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
      
      // Prepare request payload
      const payload = {
        model: modelId,
        messages: [...chatHistory, userMessage],
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty
      };
      
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
    isAuthenticated, idToken, setError, setIsWaitingForResponse, streamMessageWithFetch
  ]);
  
  // Reset chat history
  const resetChat = useCallback(() => {
    setChatHistory([]); // Reverted to empty array
    resetPerformanceMetrics();
    setError(null);
  }, [resetPerformanceMetrics]); // Removed sampleHistory dependency
  
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
    metrics,
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
    metrics,
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