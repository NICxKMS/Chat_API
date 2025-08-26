import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useChatHistory } from './ChatHistoryContext';

// Create performance metrics context
const PerformanceMetricsContext = createContext();

// Hook to use performance metrics context
export const usePerformanceMetrics = () => {
  const context = useContext(PerformanceMetricsContext);
  if (context === undefined) {
    throw new Error('usePerformanceMetrics must be used within a PerformanceMetricsProvider');
  }
  return context;
};

// Provider component for performance metrics
export const PerformanceMetricsProvider = ({ children }) => {
  const { setChatHistory } = useChatHistory();
  const [currentMessageMetrics, setCurrentMessageMetrics] = useState({
    startTime: null,
    endTime: null,
    elapsedTime: null,
    generationTime: null,
    tokenCount: null,
    tokensPerSecond: null,
    generationSpeed: null,
    isComplete: false,
    timeToFirstToken: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    finishReason: null
  });

  const resetPerformanceMetrics = useCallback(() => {
    setCurrentMessageMetrics({
      startTime: null,
      endTime: null,
      elapsedTime: null,
      generationTime: null,
      tokenCount: null,
      tokensPerSecond: null,
      generationSpeed: null,
      isComplete: false,
      timeToFirstToken: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      finishReason: null
    });
  }, []);

  const startPerformanceTimer = useCallback(() => {
    setCurrentMessageMetrics(prev => ({
      ...prev,
      startTime: Date.now(),
      isComplete: false
    }));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updatePerformanceMetrics = useCallback((newTokenCount, isComplete = false, tokenInfo = null, finishReason = null) => {
    setCurrentMessageMetrics(prev => {
      const endTime = Date.now();
      const elapsedTime = prev.startTime ? endTime - prev.startTime : 0;
      const timeToFirstToken = prev.timeToFirstToken || (newTokenCount > 0 ? elapsedTime : null);
      const generationTime = timeToFirstToken != null ? Math.max(0, elapsedTime - timeToFirstToken) : 0;

      const nextPromptTokens = tokenInfo?.promptTokens ?? prev.promptTokens;
      const nextCompletionTokens = tokenInfo?.completionTokens ?? prev.completionTokens ?? newTokenCount ?? 0;
      const nextTotalTokens = tokenInfo?.totalTokens ?? prev.totalTokens;

      const generationSpeed = generationTime > 0
        ? Math.round((nextCompletionTokens / (generationTime / 1000)) * 10) / 10
        : prev.generationSpeed;

      const newMetrics = {
        startTime: prev.startTime,
        endTime,
        elapsedTime,
        generationTime,
        tokenCount: newTokenCount,
        tokensPerSecond: generationSpeed, // backward compat
        generationSpeed,
        isComplete,
        timeToFirstToken,
        promptTokens: nextPromptTokens,
        completionTokens: nextCompletionTokens,
        totalTokens: nextTotalTokens,
        finishReason: finishReason || prev.finishReason
      };

      return newMetrics;
    });
  }, []);

  // Sync performance metrics into chat history after a metrics update
  useEffect(() => {
    if (currentMessageMetrics.endTime != null) {
      setChatHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const lastMsg = newHistory[newHistory.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.metrics = { ...currentMessageMetrics };
        }
        return newHistory;
      });
    }
  }, [currentMessageMetrics, setChatHistory]);

  // Direct function to set token metrics for the last message - for debugging/testing
  const setTokenMetricsForLastMessage = useCallback((metrics) => {
    setChatHistory(prevHistory => {
      const newHistory = [...prevHistory];
      const lastMsg = newHistory[newHistory.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.metrics = {
          ...(lastMsg.metrics || {}),
          ...metrics,
          isComplete: true
        };
      }
      return newHistory;
    });
  }, [setChatHistory]);

  const value = useMemo(() => ({
    currentMessageMetrics,
    resetPerformanceMetrics,
    startPerformanceTimer,
    updatePerformanceMetrics,
    setTokenMetricsForLastMessage
  }), [currentMessageMetrics, resetPerformanceMetrics, startPerformanceTimer, updatePerformanceMetrics, setTokenMetricsForLastMessage]);

  return (
    <PerformanceMetricsContext.Provider value={value}>
      {children}
    </PerformanceMetricsContext.Provider>
  );
}; 