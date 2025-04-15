import { memo, lazy, useRef, useEffect, useState, useCallback } from 'react';
import { useChatLogic } from '../../../hooks/useChatLogic';
import styles from './ChatContainer.module.css';

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
  onResetChat,
  onDownloadChat,
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
  } = useChatLogic();

  const messageListRef = useRef(null);
  const chatAreaRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isActiveChat = chatHistory.length > 0;
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const prevChatHistoryLength = useRef(chatHistory.length);

  // Function to smoothly scroll to the bottom
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: behavior
      });
      // Ensure button is hidden immediately after explicitly scrolling
      setShowScrollToBottomButton(false);
    }
  }, []);

  // Effect when new messages arrive (NO LONGER MANAGES BUTTON VISIBILITY)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isActiveChat) return;

    // Only proceed if chat history actually grew
    if (chatHistory.length <= prevChatHistoryLength.current) {
      prevChatHistoryLength.current = chatHistory.length;
      return;
    }

    // Update previous length tracking
    prevChatHistoryLength.current = chatHistory.length;

    // We might still need to check scroll position *after* history updates
    // to show the button if the new content itself pushes the view up.
    // Let's add a check within the scroll handler effect as well.

  }, [chatHistory, isActiveChat]); // Removed scrollToBottom from deps as it's not used here

  // Effect to handle manual scrolling by the user (NOW MANAGES BUTTON VISIBILITY)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollThreshold = 10; // Pixels from bottom to consider "at bottom"
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold;
      // Show the button if user is NOT at the bottom
      setShowScrollToBottomButton(!atBottom);
    };

    // Run handler once initially to set correct state
    handleScroll();

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);

  }, [showScrollToBottomButton]); // Dependency helps re-attach listener if needed, though primary logic is inside

  // Need another effect to check scroll position when chatHistory length changes,
  // as new content might make the button necessary even if user didn't scroll.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Check after a short delay to allow DOM to update with new message height
    const checkScrollTimeout = setTimeout(() => {
      const scrollThreshold = 10;
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold;
      setShowScrollToBottomButton(!atBottom);
    }, 100); // Adjust delay if needed

    return () => clearTimeout(checkScrollTimeout);
  }, [chatHistory]); // Run when chatHistory changes

  // Use the selected model passed down for the button, but model from logic elsewhere
  const displayModelName = passedSelectedModel?.name;

  // Classes for the main container
  const chatContainerClasses = `${styles.chatContainer} ${isActiveChat ? styles.activeChat : styles.emptyChat}`;

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
              onReset={onResetChat}
              onDownload={onDownloadChat}
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

      <div className={styles.chatAreaWrapper}>
        <div className={styles.chatArea}>
          {isActiveChat ? (
            // Active Chat: Render MessageList inside scroll container
            <div className={styles.scrollContainer} ref={scrollContainerRef}>
              <div className={styles.scrollInner}>
                <Suspense fallback={<div className={styles.messagePlaceholder} />}>
                  <MessageList
                    ref={messageListRef}
                    messages={chatHistory}
                    error={error}
                  />
                </Suspense>
              </div>
            </div>
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

        {/* Scroll to Bottom Button */}
        {showScrollToBottomButton && isActiveChat && (
          <button
            className={styles.scrollToBottomButton}
            onClick={() => scrollToBottom('smooth')}
            aria-label="Scroll to bottom"
            title="Scroll to bottom"
          >
            <ChevronDownIcon size={20} />
          </button>
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