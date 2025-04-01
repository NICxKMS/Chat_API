import React, { useState, useRef, useCallback, memo, lazy, Suspense } from 'react';
import { useChat } from '../../../contexts/ChatContext';
import { useModel } from '../../../contexts/ModelContext';
import { useSettings } from '../../../contexts/SettingsContext';
import styles from './ChatContainer.module.css';

// Lazy-loaded components for better performance
const MessageList = lazy(() => import('../MessageList'));
const ChatInput = lazy(() => import('../ChatInput'));
const ChatControls = lazy(() => import('../ChatControls'));
const PerformanceMetrics = lazy(() => import('../PerformanceMetrics'));

/**
 * Main chat container component that holds the chat interface
 * @param {Object} props - Component props
 * @param {Function} props.toggleSettings - Function to toggle settings panel
 * @returns {JSX.Element} - Rendered component
 */
const ChatContainer = memo(({ toggleSettings }) => {
  const { 
    chatHistory, 
    isWaitingForResponse, 
    error,
    metrics,
    sendMessage, 
    sendMessageStreaming,
    stopStreaming,
    resetChat, 
    downloadChatHistory 
  } = useChat();
  
  const { selectedModel } = useModel();
  const { settings } = useSettings();
  
  // Reference to message list for scrolling
  const messageListRef = useRef(null);
  
  // Local state for streaming content updates
  const [streamContent, setStreamContent] = useState('');
  
  // State for tracking the currently processed message
  const [currentMessage, setCurrentMessage] = useState('');
  
  // Function to handle sending messages
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !selectedModel) return;
    
    setCurrentMessage(message);
    
    // Reset stream content
    setStreamContent('');
    
    if (settings.stream) {
      // Use streaming API
      await sendMessageStreaming(message, (content) => {
        setStreamContent(content);
      });
    } else {
      // Use non-streaming API
      await sendMessage(message);
    }
    
    // Clear current message
    setCurrentMessage('');
  }, [selectedModel, settings.stream, sendMessage, sendMessageStreaming]);
  
  // Handle stopping generation
  const handleStopGeneration = useCallback(() => {
    stopStreaming();
    setStreamContent('');
  }, [stopStreaming]);
  
  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatArea}>
        {/* Message list */}
        <Suspense fallback={<div className={styles.messagePlaceholder} />}>
          <MessageList 
            ref={messageListRef}
            messages={chatHistory}
            streamContent={streamContent}
            isStreaming={isWaitingForResponse && settings.stream}
            error={error}
          />
        </Suspense>
        
        {/* Performance metrics */}
        <Suspense fallback={<div className={styles.metricsPlaceholder} />}>
          <PerformanceMetrics metrics={metrics} />
        </Suspense>
      </div>
      
      <div className={styles.inputArea}>
        {/* Chat input */}
        <Suspense fallback={<div className={styles.inputPlaceholder} />}>
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isWaitingForResponse && !settings.stream}
            selectedModel={selectedModel}
          />
        </Suspense>
        
        {/* Chat controls */}
        <Suspense fallback={<div className={styles.controlsPlaceholder} />}>
          <ChatControls
            onReset={resetChat}
            onDownload={downloadChatHistory}
            onSettings={toggleSettings}
            onStopGeneration={handleStopGeneration}
            isGenerating={isWaitingForResponse}
            hasMessages={chatHistory.length > 0}
          />
        </Suspense>
      </div>
    </div>
  );
});

// Display name for debugging
ChatContainer.displayName = 'ChatContainer';

export default ChatContainer; 