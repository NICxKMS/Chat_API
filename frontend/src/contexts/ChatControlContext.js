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
  const { chatHistory, chatHistoryRef, setChatHistory, addMessageToHistory } = useChatHistory();
  const { setIsWaitingForResponse, setError } = useChatStatus();
  const { resetPerformanceMetrics, startPerformanceTimer, setTokenMetricsForLastMessage } = usePerformanceMetrics();
  const { streamMessageWithFetch, stopStreaming } = useStreamingEvents();

  // Helpers
  const formatModelIdentifier = useCallback((model) => {
    if (!model || !model.provider || !model.id) return null;
    return `${model.provider}/${model.id}`;
  }, []);

  const extractTokenCount = useCallback((data, content) => {
    if (data?.usage?.completion_tokens) return data.usage.completion_tokens;
    if (data?.usage?.completionTokens) return data.usage.completionTokens;
    if (data?.tokenUsage?.output) return data.tokenUsage.output;
    if (data?.tokenUsage?.total) return data.tokenUsage.total;
    if (data?.usage?.total_tokens) return data.usage.total_tokens;
    if (data?.usage?.totalTokens) return data.usage.totalTokens;
    if (data?.raw?.usageMetadata?.candidatesTokenCount) return data.raw.usageMetadata.candidatesTokenCount;
    return Math.ceil((content.split(/\s+/).length) * 1.3);
  }, []);

  const processChunkResponse = useCallback((data) => {
    if (!data || typeof data !== 'object') return null;
    if (data.id && data.model && data.usage && typeof data.usage === 'object') {
      return {
        tokenInfo: {
          promptTokens: data.usage.promptTokens,
          completionTokens: data.usage.completionTokens,
          totalTokens: data.usage.totalTokens
        },
        finishReason: data.finishReason,
        model: data.model,
        provider: data.provider
      };
    }
    return null;
  }, []);

  const extractTokenInfo = useCallback((data) => {
    if (!data) return null;
    if (data.usage && typeof data.usage === 'object') {
      if ('promptTokens' in data.usage && 'completionTokens' in data.usage && 'totalTokens' in data.usage) {
        return {
          promptTokens: data.usage.promptTokens,
          completionTokens: data.usage.completionTokens,
          totalTokens: data.usage.totalTokens
        };
      }
      if ('prompt_tokens' in data.usage && 'completion_tokens' in data.usage && 'total_tokens' in data.usage) {
        return {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        };
      }
    }
    if (data.tokenUsage) {
      return {
        promptTokens: data.tokenUsage.input || data.tokenUsage.prompt,
        completionTokens: data.tokenUsage.output || data.tokenUsage.completion,
        totalTokens: data.tokenUsage.total
      };
    }
    if (data.raw?.usageMetadata) {
      return {
        promptTokens: data.raw.usageMetadata.promptTokenCount,
        completionTokens: data.raw.usageMetadata.candidatesTokenCount,
        totalTokens: data.raw.usageMetadata.totalTokenCount
      };
    }
    return null;
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
        userMessage = { role: 'user', content: message, timestamp: Date.now() };
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
      const content = data.content || 'No Response returned';
      const processed = processChunkResponse(data);
      const tokenInfo = processed?.tokenInfo || extractTokenInfo(data);
      const finishReason = processed?.finishReason || data.finishReason;
      const tokenCount = tokenInfo?.completionTokens || extractTokenCount(data, content);
      if (!tokenInfo || (!tokenInfo.promptTokens && !tokenInfo.completionTokens)) {
        const testMetrics = { promptTokens: 0, completionTokens: tokenCount, totalTokens: tokenCount, finishReason };
        addMessageToHistory('assistant', content, testMetrics);
      } else {
        const requestEndTime = Date.now();
        const elapsed = requestEndTime - requestStartTime;
        const finalMetrics = {
          startTime: requestStartTime,
          endTime: requestEndTime,
          elapsedTime: elapsed,
          tokenCount,
          tokensPerSecond: Math.round((tokenCount/(elapsed/1000))*10)/10,
          isComplete: true,
          timeToFirstToken: null,
          promptTokens: tokenInfo.promptTokens,
          completionTokens: tokenInfo.completionTokens,
          totalTokens: tokenInfo.totalTokens,
          finishReason
        };
        addMessageToHistory('assistant', content, finalMetrics);
      }
      return content;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message);
      addMessageToHistory('error', err.message || 'An error occurred');
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
    extractTokenInfo,
    extractTokenCount,
    processChunkResponse,
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
  const clearChatAction = useCallback(() => {
    setChatHistory([]);
    resetPerformanceMetrics();
  }, [setChatHistory, resetPerformanceMetrics]);

  // Action: downloadChatHistory
  const downloadChatHistoryAction = useCallback(() => {
    if (chatHistory.length === 0) return;
    const formatted = chatHistory.map(msg => {
      const role = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? selectedModel?.name||'Assistant' : msg.role;
      const content = typeof msg.content === 'string' ? msg.content : '';
      return `${role}: ${content}\n`;
    }).join('\n');
    const blob = new Blob([formatted], { type:'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download=`chat_${new Date().toISOString()}.txt`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); },100);
  }, [chatHistory, selectedModel]);

  // Action: getOrCreateConversation (stub)
  const getOrCreateConversation = useCallback((conversationId) => {
    // implement or delegate
  }, []);

  // Value
  const value = useMemo(() => ({
    sendMessage,
    stopGeneration: stopGenerationAction,
    addMessageToHistory,
    clearChat: clearChatAction,
    downloadChatHistory: downloadChatHistoryAction,
    getOrCreateConversation,
    setTokenMetricsForLastMessage
  }), [
    sendMessage,
    stopGenerationAction,
    addMessageToHistory,
    clearChatAction,
    downloadChatHistoryAction,
    getOrCreateConversation,
    setTokenMetricsForLastMessage
  ]);

  return (
    <ChatControlContext.Provider value={value}>
      {children}
    </ChatControlContext.Provider>
  );
}; 