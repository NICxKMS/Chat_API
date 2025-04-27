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
    tokenCount: null,
    tokensPerSecond: null,
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
      tokenCount: null,
      tokensPerSecond: null,
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
      const tokensPerSecond = newTokenCount && elapsedTime ?
        Math.round((newTokenCount / (elapsedTime / 1000)) * 10) / 10 :
        prev.tokensPerSecond;
      const timeToFirstToken = prev.timeToFirstToken ||
        (newTokenCount > 0 ? elapsedTime : null);

      const newMetrics = {
        startTime: prev.startTime,
        endTime,
        elapsedTime,
        tokenCount: newTokenCount,
        tokensPerSecond,
        isComplete,
        timeToFirstToken,
        promptTokens: tokenInfo?.promptTokens || prev.promptTokens,
        completionTokens: tokenInfo?.completionTokens || prev.completionTokens,
        totalTokens: tokenInfo?.totalTokens || prev.totalTokens,
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