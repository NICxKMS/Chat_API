import React, { memo, lazy, Suspense, useRef } from 'react';
import { useChatLogic } from '../../../hooks/useChatLogic';
import styles from './ChatContainer.module.css';
import Spinner from '../../common/Spinner';

// Lazy-loaded components
const MessageList = lazy(() => import('../MessageList'));
const ChatInput = lazy(() => import('../ChatInput'));
const ChatControls = lazy(() => import('../ChatControls'));
const GlobalMetricsBar = lazy(() => import('../GlobalMetricsBar'));
const SecondaryActions = lazy(() => import('../SecondaryActions'));

/**
 * Main chat container component
 */
const ChatContainer = memo(() => {
  const {
    chatHistory,
    isWaitingForResponse,
    error,
    metrics, 
    selectedModel,
    settings,
    streamContent,
    handleSendMessage,
    handleStopGeneration,
    resetChat, 
    downloadChatHistory, 
  } = useChatLogic();

  const messageListRef = useRef(null);
  const isActiveChat = chatHistory.length > 0;

  // Classes for the main container
  const chatContainerClasses = `${styles.chatContainer} ${isActiveChat ? styles.activeChat : styles.emptyChat}`;
  // Input area class determination moved inside conditional rendering

  // Helper function to render the input area contents
  const renderInputAreaContents = (isFixedLayout) => {
    const isStaticLayout = !isFixedLayout; // Flag for empty state layout
    return (
      <>
        {/* Global Metrics: Only show when fixed */} 
        {isFixedLayout && (
          <Suspense fallback={<div className={styles.globalMetricsPlaceholder} />}>
            <GlobalMetricsBar 
              metrics={metrics?.session}
              modelName={selectedModel?.name} 
            />
          </Suspense>
        )}

        <div className={styles.inputControlsWrapper}> 
          {isWaitingForResponse && !settings?.stream && (
            <div className={styles.inputSpinnerContainer}>
              <Spinner size="small" />
            </div>
          )}
          <Suspense fallback={<div className={styles.inputPlaceholder} />}>
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isWaitingForResponse && !settings?.stream} 
              selectedModel={selectedModel} 
            />
          </Suspense>
          <Suspense fallback={<div className={styles.controlsPlaceholder} />}>
            <ChatControls
              onReset={resetChat} 
              onDownload={downloadChatHistory} 
              onStopGeneration={handleStopGeneration}
              isGenerating={isWaitingForResponse}
              hasMessages={isActiveChat}
              isStaticLayout={isStaticLayout}
            />
          </Suspense>
        </div>

        {/* Secondary Actions: Only show when fixed */} 
        {isFixedLayout && (
          <Suspense fallback={<div className={styles.secondaryActionsPlaceholder} />}>
            <SecondaryActions 
              onNewChat={resetChat}
              onDownloadChat={downloadChatHistory}
              canDownload={isActiveChat}
            />
          </Suspense>
        )}
      </>
    );
  };

  return (
    <div className={chatContainerClasses}>
      <div className={styles.chatArea}>
        {isActiveChat ? (
          // Active Chat: Render MessageList
          <Suspense fallback={<div className={styles.messagePlaceholder} />}>
            <MessageList
              ref={messageListRef}
              messages={chatHistory}
              streamContent={streamContent}
              isStreaming={isWaitingForResponse && settings?.stream}
              error={error}
            />
          </Suspense>
        ) : (
          // Empty Chat: Render Greeting and Input Area (Static Layout)
          <div className={styles.emptyChatContent}>
            <div className={styles.greetingMessage}>
              <h2>Welcome to AI Chat!</h2>
              <p>Select a model above and start your conversation.</p>
            </div>
            {/* Render input area directly below greeting */}
            <div className={`${styles.inputArea} ${styles.staticInputArea}`}> 
              {renderInputAreaContents(false)} 
            </div>
          </div>
        )}
      </div>

      {/* Fixed Input Area Wrapper (Only rendered when chat is active) */}
      {isActiveChat && (
        <div className={`${styles.inputArea} ${styles.fixedInputArea}`}> 
          {renderInputAreaContents(true)} 
        </div>
      )}
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';

export default ChatContainer; 