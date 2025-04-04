import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useApi } from './ApiContext';
import { useModel } from './ModelContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';

// Create chat context
const ChatContext = createContext();

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
  
  // Create refs at component level
  const lastUpdateTimeRef = React.useRef(0);
  const contentBufferRef = React.useRef('');
  
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
  
  // Process streaming message using EventSource instead of fetch
  const streamMessage = useCallback(async (message) => {
    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }
    
    const modelId = formatModelIdentifier(selectedModel);
    if (!modelId) {
      setError('Invalid model selection');
      return null;
    }
    
    // Add user message to history (for UI only)
    const userMessage = addMessageToHistory('user', message);
    
    // Reset metrics and start timer
    resetPerformanceMetrics();
    startPerformanceTimer();
    
    // Set loading state
    setIsWaitingForResponse(true);
    setError(null);
    
    // Add assistant response with empty content initially (for UI only)
    // This will appear immediately in the UI but won't be sent to the API
    addMessageToHistory('assistant', '');
    
    let accumulatedContent = '';
    let tokenCount = 0;
    let eventSource = null;

    // Set up timeout
    let timeoutId = setTimeout(() => {
      console.log('Streaming request timed out after 60 seconds');
      if (eventSource) {
        eventSource.close();
      }
      setError('Request timed out. Please try again.');
      setIsWaitingForResponse(false);
    }, 60000); // 60 second timeout
    
    try {
      // Get adjusted settings based on model
      const adjustedSettings = getModelAdjustedSettings(selectedModel);
      
      // Prepare request payload - Filter out empty assistant messages to avoid validation error
      const validMessages = [...chatHistory].filter(msg => {
        // Keep all user messages
        if (msg.role === 'user') return true;
        // For assistant messages, only keep ones with content
        return (msg.role === 'assistant' && msg.content && msg.content.trim() !== '');
      });
      
      // Add only the user message (not the empty assistant message)
      validMessages.push(userMessage);
      
      // Create the final payload with valid messages only
      const payload = {
        model: modelId,
        messages: validMessages,
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty
      };
      
      // Using POST with EventSource requires a different approach
      // We'll use URLSearchParams to send the request in the URL
      const params = new URLSearchParams();
      params.append('data', JSON.stringify(payload));
      
      // Construct URL for EventSource (POST simulation via query param)
      const streamUrl = new URL(`/api/chat/stream-sse?${params.toString()}`, apiUrl).toString();
      
      console.log(`Starting EventSource streaming request to ${streamUrl}`);
      
      // Create a promise that will be resolved when the streaming is complete
      return new Promise((resolve, reject) => {
        // Create EventSource
        eventSource = new EventSource(streamUrl);
        
        // Use component-level refs for tracking updates
        // Reset them for a new streaming session
        lastUpdateTimeRef.current = 0;
        contentBufferRef.current = '';
        
        eventSource.onopen = (event) => {
          console.log('EventSource connection opened');
          // Reset timeout each time connection opens
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            console.log('Streaming request timed out after 60 seconds');
            eventSource.close();
            setError('Request timed out. Please try again.');
            setIsWaitingForResponse(false);
            reject(new Error('Request timed out'));
          }, 60000);
        };
        
        eventSource.onmessage = (event) => {
          try {
            // Clear existing timeout and set a new one
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              console.log('No messages received for 60 seconds, timing out');
              eventSource.close();
              setError('Connection timed out');
              setIsWaitingForResponse(false);
              reject(new Error('Connection timed out'));
            }, 60000);
            
            // Check for [DONE] message
            if (event.data === '[DONE]') {
              console.log('Received [DONE] message from stream');
              
              // Ensure any buffered content is flushed
              if (contentBufferRef.current) {
                accumulatedContent += contentBufferRef.current;
                updateChatWithContent(accumulatedContent);
                contentBufferRef.current = '';
              }
              
              eventSource.close();
              updatePerformanceMetrics(tokenCount, true);
              setIsWaitingForResponse(false);
              resolve(accumulatedContent);
              return;
            }
            
            try {
              const parsedData = JSON.parse(event.data);
              const content = parsedData.content || '';
              
              if (content) {
                // Add to buffer
                contentBufferRef.current += content;
                
                // Track if we need to update now based on time since last update
                const now = Date.now();
                const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
                
                // Update every 33ms (approximately 30fps) for smoother visual updates
                // This helps prevent React's batching from making updates appear jerky
                if (timeSinceLastUpdate >= 33 || contentBufferRef.current.length > 10) {
                  // Update accumulated content
                  accumulatedContent += contentBufferRef.current;
                  
                  // Update the UI with the latest content
                  updateChatWithContent(accumulatedContent);
                  
                  // Reset buffer and update timestamp
                  contentBufferRef.current = '';
                  lastUpdateTimeRef.current = now;
                  
                  // Update token count estimate
                  tokenCount += content.split(/\s+/).length || 0;
                  updatePerformanceMetrics(tokenCount, false);
                }
              }
            } catch (parseError) {
              console.warn('Error parsing message data:', parseError, event.data);
            }
          } catch (e) {
            console.error('Error in message handler:', e);
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('EventSource error:', error);
          // Don't close connection on the first error - let it try to reconnect
          // But if we get repeated errors, close it
          if (eventSource.readyState === 2) { // CLOSED
            clearTimeout(timeoutId);
            setError('Connection to server lost');
            setIsWaitingForResponse(false);
            reject(new Error('Connection to server lost'));
          }
        };
        
        // Set up cleanup method that will be called if the component unmounts
        return () => {
          if (eventSource) {
            console.log('Closing EventSource connection');
            eventSource.close();
            clearTimeout(timeoutId);
          }
        };
      });
      
    } catch (error) {
      console.error('Error in streaming message:', error);
      setError(error.message || 'An error occurred during streaming');
      setIsWaitingForResponse(false);
      if (eventSource) {
        eventSource.close();
      }
      clearTimeout(timeoutId);
      return null;
    }
  }, [
    apiUrl, selectedModel, chatHistory, getModelAdjustedSettings, 
    addMessageToHistory, formatModelIdentifier, resetPerformanceMetrics, 
    startPerformanceTimer, updatePerformanceMetrics, 
    isAuthenticated, idToken, setError, setIsWaitingForResponse
  ]);
  
  // Send message to API - decide between streaming and non-streaming
  const sendMessage = useCallback(async (message) => {
    // Use streaming if enabled in settings
    if (settings.streaming) {
      return streamMessage(message);
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
    isAuthenticated, idToken, setError, setIsWaitingForResponse, streamMessage
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
  
  // Helper function to update chat history with new content
  // Using a separate function to ensure consistent updates
  const updateChatWithContent = (content) => {
    // Use unstable_batchedUpdates to ensure the update isn't batched with others
    // This helps create smoother visual updates
    queueMicrotask(() => {
      setChatHistory(prev => {
        const updated = [...prev];
        const assistantIndex = updated.length - 1;
        
        if (assistantIndex >= 0 && updated[assistantIndex].role === 'assistant') {
          updated[assistantIndex] = { 
            role: 'assistant', 
            content: content 
          };
        }
        
        return updated;
      });
    });
  };
  
  // Memoize the context value
  const contextValue = useMemo(() => ({
    chatHistory,
    isWaitingForResponse,
    error,
    metrics,
    submitMessage: sendMessage,
    resetChat,
    downloadChatHistory
  }), [
    chatHistory,
    isWaitingForResponse,
    error,
    metrics,
    sendMessage,
    resetChat,
    downloadChatHistory
  ]);
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}; 