import React, { createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { useApi } from './ApiContext';
import { useModel } from './ModelContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { useChatHistory } from './ChatHistoryContext';
import { useChatStatus } from './ChatStatusContext';
import { usePerformanceMetrics } from './PerformanceMetricsContext';
import { useStreamingEvents } from './StreamingEventsContext';
import { fetchWithRetry } from '../utils/network';
import { useToast } from './ToastContext';

// Context for chat actions (controls)
const ChatControlContext = createContext();

// Hook to consume chat controls
export const useChatControl = () => {
  const context = useContext(ChatControlContext);
  if (context === undefined) {
    throw new Error('useChatControl must be used within a ChatControlProvider');
  }
  return context;
};

// Provider component for chat controls
export const ChatControlProvider = ({ children }) => {
  // Ref to track client-generated request ID for non-streaming
  const currentRequestIdRef = useRef(null);
  const { apiUrl } = useApi();
  const { selectedModel } = useModel();
  const { settings, getModelAdjustedSettings } = useSettings();
  const { idToken } = useAuth();
  const { chatHistoryRef, setChatHistory, addMessageToHistory } = useChatHistory();
  const { setIsWaitingForResponse, setError } = useChatStatus();
  const { resetPerformanceMetrics, startPerformanceTimer, setTokenMetricsForLastMessage } = usePerformanceMetrics();
  const { streamMessageWithFetch, stopStreaming } = useStreamingEvents();
  const { showToast } = useToast();

  // Helpers
  const formatModelIdentifier = useCallback((model) => {
    if (!model || !model.provider || !model.id) return null;
    return `${model.provider}/${model.id}`;
  }, []);

  // Action: sendMessage
  const sendMessage = useCallback(async (message, editIndex = null) => {
    // Generate unique client-side requestId
    const clientRequestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
    currentRequestIdRef.current = clientRequestId;
    const isEditing = editIndex !== null && Number.isInteger(editIndex) && editIndex >= 0;
    if (settings.streaming) {
      return streamMessageWithFetch(message, isEditing ? editIndex : null);
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
    const requestStartTime = Date.now();
    setIsWaitingForResponse(true);
    setError(null);
    try {
      const adjusted = getModelAdjustedSettings(selectedModel);
      const historyForApi = chatHistoryRef.current.map(({ metrics, ...m }) => m);
      if (adjusted.systemPrompt && (!historyForApi.length || historyForApi[0].role !== 'system')) {
        historyForApi.unshift({ role: 'system', content: adjusted.systemPrompt, timestamp: Date.now()-1 });
      }
      historyForApi.push(userMessage);
      const payload = { 
        requestId: clientRequestId,
        model: modelId, messages: historyForApi,
        temperature: adjusted.temperature,
        max_tokens: adjusted.max_tokens,
        top_p: adjusted.top_p,
        frequency_penalty: adjusted.frequency_penalty,
        presence_penalty: adjusted.presence_penalty
      };
      resetPerformanceMetrics();
      startPerformanceTimer();
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      const response = await fetchWithRetry(new URL('/api/chat/completions', apiUrl).toString(), {
        method: 'POST', headers, body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let errMsg = `API error: ${response.status}`;
        try { const errData = await response.json(); errMsg = errData?.error?.message || errData?.message || errMsg; } catch {};
        throw new Error(errMsg);
      }
      const data = await response.json();
      console.log('Received non-streaming chat data:', data);

      // Handle server-sent error in response payload
      if (data.error?.message || data.finishReason === 'error') {
        const errMsg = data.error?.message || 'Error occurred during generation';
        console.error('Error in API response:', errMsg);
        setError(errMsg);
        const rawUsage = data.usage || {};
        const promptTokens = rawUsage.promptTokens ?? rawUsage.prompt_tokens ?? 0;
        const completionTokens = rawUsage.completionTokens ?? rawUsage.completion_tokens ?? 0;
        const totalTokens = rawUsage.totalTokens ?? rawUsage.total_tokens ?? completionTokens;
        const requestEndTime = Date.now();
        const elapsed = requestEndTime - requestStartTime;
        const tokensPerSecond = elapsed ? Math.round((completionTokens / (elapsed / 1000)) * 10) / 10 : null;
        const errorMetrics = {
          startTime: requestStartTime,
          endTime: requestEndTime,
          elapsedTime: elapsed,
          tokenCount: completionTokens,
          tokensPerSecond,
          isComplete: true,
          timeToFirstToken: null,
          promptTokens,
          completionTokens,
          totalTokens,
          finishReason: data.finishReason || 'error',
          error: true
        };
        addMessageToHistory('assistant', errMsg, errorMetrics);
        return null;
      }
      const content = data.content || 'No Response returned';
      // Use server-provided usage tokens directly
      const rawUsage = data.usage || {};
      const promptTokens = rawUsage.promptTokens ?? rawUsage.prompt_tokens ?? 0;
      const completionTokens = rawUsage.completionTokens ?? rawUsage.completion_tokens ?? 0;
      const totalTokens = rawUsage.totalTokens ?? rawUsage.total_tokens ?? completionTokens;
      // Compute timing and rates
      const requestEndTime = Date.now();
      const elapsed = requestEndTime - requestStartTime;
      const tokensForMetrics = completionTokens > 0 ? completionTokens : 0;
      const tokensPerSecond = elapsed
        ? Math.round((tokensForMetrics / (elapsed / 1000)) * 10) / 10
        : null;
      const finalMetrics = {
        startTime: requestStartTime,
        endTime: requestEndTime,
        elapsedTime: elapsed,
        tokenCount: tokensForMetrics,
        tokensPerSecond,
        isComplete: true,
        timeToFirstToken: null,
        promptTokens,
        completionTokens,
        totalTokens,
        finishReason: data.finishReason
      };
      addMessageToHistory('assistant', content, finalMetrics);
      return content;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message);
      // Show the server error as an assistant reply
      addMessageToHistory('assistant', err.message || 'An error occurred');
      return null;
    } finally {
      // Clear the clientRequestId after completion
      currentRequestIdRef.current = null;
      setIsWaitingForResponse(false);
    }
  }, [
    apiUrl,
    selectedModel,
    settings.streaming,
    getModelAdjustedSettings,
    idToken,
    chatHistoryRef,
    setChatHistory,
    addMessageToHistory,
    streamMessageWithFetch,
    formatModelIdentifier,
    resetPerformanceMetrics,
    startPerformanceTimer,
    setError,
    setIsWaitingForResponse,
  ]);

  // Action: stopGeneration
  const stopGenerationAction = useCallback(async () => {
    stopStreaming();
    return true;
  }, [stopStreaming]);

  // Action: clearChat
  const clearChat = useCallback(() => {
    setChatHistory([]);
    resetPerformanceMetrics();
  }, [setChatHistory, resetPerformanceMetrics]);

  // Action: newChat
  const newChat = useCallback(() => {
    if (chatHistoryRef.current.length > 0) {
      clearChat();
    }
  }, [chatHistoryRef, clearChat]);

  // Action: resetChat
  const resetChat = useCallback(() => {
    if (chatHistoryRef.current.length === 0) return;
    
    if (window.confirm('Are you sure you want to clear the current chat?')) {
      clearChat();
      showToast({ type: 'info', message: 'Chat has been cleared' });
    }
  }, [chatHistoryRef, clearChat, showToast]);

  // Action: downloadChat
  const downloadChat = useCallback(() => {
    const history = chatHistoryRef.current;
    if (!history.length) return;
    try {
      const formatted = history.map(msg => {
        const role = msg.role === 'user'
          ? 'You'
          : msg.role === 'assistant'
            ? selectedModel?.name || 'Assistant'
            : msg.role;
        let contentText = '';
        if (typeof msg.content === 'string') {
          contentText = msg.content;
        } else if (Array.isArray(msg.content)) {
          contentText = msg.content
            .map(part => part.type === 'text' ? part.text : '[Image]')
            .join('\n');
        }
        return `${role}: ${contentText}\n`;
      }).join('');
      const blob = new Blob([formatted], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_${new Date().toISOString().replace(/:/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      showToast({ type: 'success', message: 'Chat downloaded successfully' });
      // Clean up anchor and URL
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading chat:", error);
      showToast({ type: 'error', message: 'Failed to download chat. Please try again.' });
    }
  }, [chatHistoryRef, selectedModel, showToast]);

  // Action: getOrCreateConversation (stub)
  const getOrCreateConversation = useCallback((conversationId) => {
    // implement or delegate
  }, []);

  // Value
  const value = useMemo(() => ({
    sendMessage,
    stopGeneration: stopGenerationAction,
    addMessageToHistory,
    clearChat,
    newChat,
    resetChat,
    downloadChat,
    getOrCreateConversation,
    setTokenMetricsForLastMessage
  }), [
    sendMessage,
    stopGenerationAction,
    addMessageToHistory,
    clearChat,
    newChat,
    resetChat,
    downloadChat,
    getOrCreateConversation,
    setTokenMetricsForLastMessage
  ]);

  return (
    <ChatControlContext.Provider value={value}>
      {children}
    </ChatControlContext.Provider>
  );
}; 