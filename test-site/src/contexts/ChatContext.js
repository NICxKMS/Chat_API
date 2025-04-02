import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { useApi } from './ApiContext';
import { useModel } from './ModelContext';
import { useSettings } from './SettingsContext';

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
  const { apiUrl, apiStatus } = useApi();
  const { selectedModel } = useModel();
  const { settings, getModelAdjustedSettings } = useSettings();
  
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
  
  // Refs for streaming
  const abortControllerRef = useRef(null);
  const streamingContentRef = useRef('');
  
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
  
  // Send message to API (non-streaming)
  const sendMessage = useCallback(async (message) => {
    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }
    
    if (!apiStatus.online) {
      setError('API is offline. Please try again later.');
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
      
      // Prepare request payload
      const payload = {
        model: modelId,
        messages: [...chatHistory, userMessage],
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty,
        stream: false // Non-streaming mode
      };
      
      // Send request to API
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
    selectedModel, 
    apiStatus.online, 
    apiUrl, 
    chatHistory, 
    addMessageToHistory, 
    formatModelIdentifier, 
    getModelAdjustedSettings, 
    resetPerformanceMetrics, 
    startPerformanceTimer,
    updatePerformanceMetrics,
    extractTokenCount
  ]);
  
  // Send message with streaming
  const sendMessageStreaming = useCallback(async (message, onUpdate) => {
    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }
    
    if (!apiStatus.online) {
      setError('API is offline. Please try again later.');
      return null;
    }
    
    const modelId = formatModelIdentifier(selectedModel);
    if (!modelId) {
      setError('Invalid model selection');
      return null;
    }
    
    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    // Add user message to history
    const userMessage = addMessageToHistory('user', message);
    
    // Reset content buffer
    streamingContentRef.current = '';
    
    // Reset metrics and start timer
    resetPerformanceMetrics();
    startPerformanceTimer();
    
    // Set loading state
    setIsWaitingForResponse(true);
    setError(null);
    
    try {
      // Get adjusted settings based on model
      const adjustedSettings = getModelAdjustedSettings(selectedModel);
      
      // Prepare request payload
      const payload = {
        model: modelId,
        messages: [...chatHistory, userMessage],
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty,
        stream: true // Enable streaming
      };
      
      // Send streaming request to API
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal
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
      
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let tokenCount = 0;
      
      // Process stream chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode chunk
        const chunk = decoder.decode(value, { stream: true });
        
        // Process chunk data (format may vary depending on API)
        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
        
        for (const line of lines) {
          try {
            // Extract JSON data from SSE format (data: {...})
            const jsonStr = line.replace(/^data: /, '').trim();
            if (!jsonStr) continue;
            
            const data = JSON.parse(jsonStr);
            
            // Get content delta (adjust based on your API format)
            const content = data.content || data.delta?.content || '';
            
            if (content) {
              // Append to buffer
              streamingContentRef.current += content;
              
              // Call update callback with current content
              if (onUpdate) {
                onUpdate(streamingContentRef.current);
              }
              
              // Estimate token count for ongoing metrics updates
              tokenCount = extractTokenCount(data, streamingContentRef.current);
              updatePerformanceMetrics(tokenCount, false);
            }
          } catch (e) {
            console.error('Error parsing streaming chunk:', e);
          }
        }
      }
      
      // Add final AI response to history
      const finalContent = streamingContentRef.current;
      addMessageToHistory('assistant', finalContent);
      
      // Update metrics as complete
      updatePerformanceMetrics(tokenCount, true);
      
      return finalContent;
    } catch (error) {
      // Don't treat aborted requests as errors
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return null;
      }
      
      console.error('Error sending streaming message:', error);
      setError(error.message);
      return null;
    } finally {
      setIsWaitingForResponse(false);
      abortControllerRef.current = null;
    }
  }, [
    selectedModel,
    apiStatus.online,
    apiUrl,
    chatHistory,
    addMessageToHistory,
    formatModelIdentifier,
    getModelAdjustedSettings,
    resetPerformanceMetrics,
    startPerformanceTimer,
    updatePerformanceMetrics,
    extractTokenCount
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
  
  // Stop streaming response
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsWaitingForResponse(false);
    }
  }, []);
  
  // Memoize the context value
  const contextValue = useMemo(() => ({
    chatHistory,
    isWaitingForResponse,
    error,
    metrics,
    sendMessage,
    sendMessageStreaming,
    stopStreaming,
    resetChat,
    downloadChatHistory
  }), [
    chatHistory,
    isWaitingForResponse,
    error,
    metrics,
    sendMessage,
    sendMessageStreaming,
    stopStreaming,
    resetChat,
    downloadChatHistory
  ]);
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}; 