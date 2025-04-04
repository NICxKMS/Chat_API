import React, { memo, lazy, Suspense, useRef } from 'react';
import { useChatLogic } from '../../../hooks/useChatLogic';
import styles from './ChatContainer.module.css';
import Spinner from '../../common/Spinner';

// Lazy-loaded components
const MessageList = lazy(() => import('../MessageList'));
const ChatInput = lazy(() => import('../ChatInput'));
const ChatControls = lazy(() => import('../ChatControls'));
const GlobalMetricsBar = lazy(() => import('../GlobalMetricsBar'));
const ModelSelectorButton = lazy(() => import('../../models/ModelSelectorButton'));

/**
 * Main chat container component
 */
const ChatContainer = memo(({ 
  selectedModel: passedSelectedModel,
  isLoadingModels, 
  toggleModelSelector,
  onNewChat,
  onToggleSettings
}) => {
  const {
    chatHistory,
    isWaitingForResponse,
    error,
    metrics, 
    selectedModel: modelFromLogic,
    settings,
    handleSendMessage,
    resetChat, 
    downloadChatHistory, 
  } = useChatLogic();

  const messageListRef = useRef(null);
  const isActiveChat = chatHistory.length > 0;

  // Use the selected model passed down for the button, but model from logic elsewhere
  const displayModelName = passedSelectedModel?.name;

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
              modelName={modelFromLogic?.name} 
            />
          </Suspense>
        )}

        <div className={styles.inputControlsWrapper}> 
          {isWaitingForResponse && (
            <div className={styles.inputSpinnerContainer}>
              <Spinner size="small" />
            </div>
          )}
          <Suspense fallback={<div className={styles.inputPlaceholder} />}>
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isWaitingForResponse} 
              selectedModel={modelFromLogic} 
              onNewChat={onNewChat}
              isStaticLayout={isStaticLayout}
            />
          </Suspense>
          <Suspense fallback={<div className={styles.controlsPlaceholder} />}>
            <ChatControls
              onReset={resetChat} 
              onDownload={downloadChatHistory} 
              isGenerating={isWaitingForResponse}
              hasMessages={isActiveChat}
              isStaticLayout={isStaticLayout}
              onNewChat={onNewChat}
              onToggleSettings={onToggleSettings}
            />
          </Suspense>
        </div>
      </>
    );
  };

  return (
    <div className={chatContainerClasses}>
      {/* Container for the Model Selector Button */}
      <div className={styles.modelButtonContainer}>
        <Suspense fallback={null}> 
          <ModelSelectorButton 
            selectedModelName={displayModelName}
            onClick={toggleModelSelector}
            disabled={isLoadingModels}
          />
        </Suspense>
      </div>

      <div className={styles.chatArea}>
        {isActiveChat ? (
          // Active Chat: Render MessageList
          <Suspense fallback={<div className={styles.messagePlaceholder} />}>
            <MessageList
              ref={messageListRef}
              messages={chatHistory}
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