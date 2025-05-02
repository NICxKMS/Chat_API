import React, { createContext, useContext, useRef, useCallback,  useMemo } from 'react';
import { useApi } from './ApiContext';
import { useModel } from './ModelContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { useChatHistory } from './ChatHistoryContext';
import { useChatStatus } from './ChatStatusContext';
import { usePerformanceMetrics } from './PerformanceMetricsContext';
import { fetchWithRetry } from '../utils/network';
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

  // Refs for streaming
  const streamingTextRef = useRef('');
  const currentRequestIdRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isStreamingRef = useRef(false);
  const firstTokenReceivedRef = useRef(false);

  // Debounced content updater
  const debouncedUpdateChat = useMemo(
    () => debounce((content) => updateChatWithContent(content), 20),
    [updateChatWithContent]
  );

  // SSE parsing worker setup
  const streamWorkerUrlRef = useRef(null);
  const streamWorkerRef = useRef(null);
  const getOrCreateStreamWorker = useCallback(() => {
    if (!streamWorkerRef.current) {
      if (!streamWorkerUrlRef.current) {
        streamWorkerUrlRef.current = new URL('../workers/streamProcessor.js', import.meta.url);
      }
      streamWorkerRef.current = new Worker(streamWorkerUrlRef.current, { type: 'module' });
    }
    return streamWorkerRef.current;
  }, []);

  const parseStreamChunk = useCallback((chunk) => new Promise((resolve, reject) => {
    const worker = getOrCreateStreamWorker();
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = reject;
    worker.postMessage(chunk);
  }), [getOrCreateStreamWorker]);

  // Stream a message using fetch SSE
  const streamMessageWithFetch = useCallback(async (message, editIndex = null) => {
    // Generate and store a client-side requestId for this stream
    const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
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
    let timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort('timeout');
      setError('Connection timed out');
      setIsWaitingForResponse(false);
    }, 60000);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const adjusted = getModelAdjustedSettings(selectedModel);
      const historyForApi = chatHistoryRef.current.map(({ metrics, ...m }) => m);
      if (adjusted.systemPrompt && (!historyForApi.length || historyForApi[0].role !== 'system')) {
        historyForApi.unshift({ role: 'system', content: adjusted.systemPrompt, timestamp: Date.now() - 1 });
      }
      historyForApi.push(userMessage);
      const payload = {
        requestId,
        model: modelId,
        messages: historyForApi,
        temperature: adjusted.temperature,
        max_tokens: adjusted.max_tokens,
        top_p: adjusted.top_p,
        frequency_penalty: adjusted.frequency_penalty,
        presence_penalty: adjusted.presence_penalty
      };
      const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'Cache-Control': 'no-cache' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      const response = await fetchWithRetry(new URL('/api/chat/stream', apiUrl).toString(), {
        method: 'POST', headers, body: JSON.stringify(payload), signal: abortController.signal, cache: 'no-store'
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = '';
      while (true) {
        const { done, value } = await reader.read();
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          abortControllerRef.current?.abort();
          setError('Connection timed out');
          setIsWaitingForResponse(false);
        }, 60000);
        if (done) {
          // handle leftover buffer
          break;
        }
        const chunk = decoder.decode(value, { stream: true });

        console.log('Received stream chunk:', chunk);

        try {
          const msgs = await parseStreamChunk(chunk);
          for (const msg of msgs) {
            // Handle server-sent error payload
            if (msg.rawChunk?.error || msg.finishReason === 'error') {
              const errMsg = msg.rawChunk?.error?.message || 'Error occurred during generation';
              console.error('Error in SSE payload:', errMsg);
              setError(errMsg);
              setChatHistory(prev => {
                const newHistory = [...prev];
                const lastMsg = newHistory[newHistory.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content = errMsg;
                  if (lastMsg.metrics) {
                    lastMsg.metrics.isComplete = true;
                    lastMsg.metrics.error = true;
                  }
                }
                return newHistory;
              });
              return null;
            }
            // Append any content from the chunk
            if (msg.content) {
              // Record time to first token once
              if (!firstTokenReceivedRef.current) {
                updatePerformanceMetrics(1);
                firstTokenReceivedRef.current = true;
              }
              accumulatedContent += msg.content;
              streamingTextRef.current = accumulatedContent;
              debouncedUpdateChat(accumulatedContent);
            }
            // Always use server-reported completion tokens for metrics
            const completionTokens = msg.usage?.completionTokens ?? 0;
            updatePerformanceMetrics(completionTokens, msg.isDone, msg.usage, msg.finishReason);
          }
        } catch {}
      }
      debouncedUpdateChat.flush();
      updateChatWithContent(streamingTextRef.current);
      return streamingTextRef.current;
    } catch (error) {
      console.error('Error streaming message:', error);
      setError(error.message);
      // Show the server error content as the assistant's message
      setChatHistory(prev => {
        const newHistory = [...prev];
        const lastMsg = newHistory[newHistory.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = error.message || 'Error occurred during generation';
          if (lastMsg.metrics) {
            lastMsg.metrics.isComplete = true;
            lastMsg.metrics.error = true;
          }
        }
        return newHistory;
      });
      return null;
    } finally {
      clearTimeout(timeoutId);
      isStreamingRef.current = false;
      setIsWaitingForResponse(false);
      // Do not auto-call stop endpoint here; only explicit stop should trigger it
      currentRequestIdRef.current = null;
    }
  }, [
    apiUrl, selectedModel, getModelAdjustedSettings, idToken,
    chatHistoryRef, setChatHistory, addMessageToHistory, updateChatWithContent,
    debouncedUpdateChat, setError, setIsWaitingForResponse,
    resetPerformanceMetrics, startPerformanceTimer, updatePerformanceMetrics,
    parseStreamChunk
  ]);

  const stopStreaming = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort('user_stopped');
    const reqId = currentRequestIdRef.current;
    if (reqId) {
      const headers = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      try {
        await fetchWithRetry(new URL('/api/chat/stop', apiUrl).toString(), {
          method: 'POST', headers, body: JSON.stringify({ requestId: reqId })
        });
      } catch {} finally {
        currentRequestIdRef.current = null;
        abortControllerRef.current = null;
      }
    }
    isStreamingRef.current = false;
    setIsWaitingForResponse(false);
    return true;
  }, [apiUrl, idToken, setIsWaitingForResponse]);

  const value = useMemo(() => ({
    streamMessageWithFetch,
    stopStreaming,
    parseStreamChunk,
    streamingTextRef,
    isStreaming: () => isStreamingRef.current
  }), [streamMessageWithFetch, stopStreaming, parseStreamChunk]);

  return (
    <StreamingEventsContext.Provider value={value}>
      {children}
    </StreamingEventsContext.Provider>
  );
}; 