import { memo, lazy, useRef, useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useChatLogic } from '../../../hooks/useChatLogic';
import { ChevronDownIcon } from '@primer/octicons-react';
import styles from './ChatContainer.module.css';
import throttle from 'lodash.throttle';
import PropTypes from 'prop-types';

// Lazy-loaded components
const MessageList = lazy(() => import(/* webpackChunkName: "chat-messagelist" */ '../MessageList'));
const ChatInput = lazy(() => import(/* webpackChunkName: "chat-input" */ '../ChatInput'));
const GlobalMetricsBar = lazy(() => import(/* webpackChunkName: "chat-globalmetrics" */ '../GlobalMetricsBar'));
const ModelSelectorButton = lazy(() => import(/* webpackChunkName: "model-selector-button" */ '../../models/ModelSelectorButton'));

/**
 * Main chat container component
 */
const ChatContainer = memo(({ 
  selectedModel: passedSelectedModel,
  isLoadingModels, 
  toggleModelSelector,
  onToggleSettings,
  isSidebarOpen,
  isSettingsOpen,
  isModelSelectorOpen
}) => {
  const {
    chatHistory,
    isWaitingForResponse,
    error,
    metrics, 
    selectedModel: modelFromLogic,
    handleSendMessage,
  } = useChatLogic();

  // Add state to track which message is being edited
  const [editingMessage, setEditingMessage] = useState(null);

  const messageListRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isActiveChat = chatHistory.length > 0;
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const prevWaitingForResponse = useRef(isWaitingForResponse);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // === Performance-tuned handlers ===
  // Smooth scroll to bottom, memoized
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior });
      setShowScrollToBottomButton(false);
    }
  }, []);

  // Scroll handler for showing/hiding the scroll-to-bottom button, throttled
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollThreshold = 10;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold;
    setShowScrollToBottomButton(!atBottom);
    setIsAtBottom(atBottom);
  }, []);
  const throttledHandleScroll = useMemo(
    () => throttle(handleScroll, 100),
    [handleScroll]
  );

  // Focus input helper, memoized
  const focusInputField = useCallback(() => {
    // Use a timeout to ensure the component is fully rendered and mounted
    setTimeout(() => {
      // Try to find the textarea within the ChatInput component
      const inputField = document.querySelector('textarea.'+styles.chatInput) || 
                         document.querySelector('textarea[aria-label="Chat message input"]');
      if (inputField) {
        inputField.focus();
      }
    }, 100);
  }, []);

  // Focus the input field when the component is mounted
  useEffect(() => {
    focusInputField();
  }, [focusInputField]);

  // Focus input when response is completed, only if UI elements aren't open
  useEffect(() => {
    // Check if response has just completed (was waiting, now not waiting)
    if (prevWaitingForResponse.current && !isWaitingForResponse) {
      // Only focus if no UI elements are open
      const noUIElementsOpen = !isSidebarOpen && !isSettingsOpen && !isModelSelectorOpen && !editingMessage;
      
      if (noUIElementsOpen) {
        focusInputField();
      }
    }
    
    // Update the ref for the next check
    prevWaitingForResponse.current = isWaitingForResponse;
  }, [isWaitingForResponse, isSidebarOpen, isSettingsOpen, isModelSelectorOpen, editingMessage, focusInputField]);

  // Effect to handle manual scrolling by the user (NOW MANAGES BUTTON VISIBILITY)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Initial check
    throttledHandleScroll();
    container.addEventListener('scroll', throttledHandleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      throttledHandleScroll.cancel();
    };
  }, [throttledHandleScroll]);

  // Effect to handle manual scrolling by the user (NOW MANAGES BUTTON VISIBILITY)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollThreshold = 10; // Pixels from bottom to consider "at bottom"
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold;
      // Show the button if user is NOT at the bottom
      setShowScrollToBottomButton(!atBottom);
      setIsAtBottom(atBottom);
    };

    // Run handler once initially to set correct state
    handleScroll();

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);

  }, [showScrollToBottomButton]); // Dependency helps re-attach listener if needed, though primary logic is inside

  // Need another effect to check scroll position when chatHistory length changes,
  // as new content might make the button necessary even if user didn't scroll.
  useEffect(() => {
    // React to new messages by re-checking scroll only once after DOM update
    const timeout = setTimeout(() => throttledHandleScroll(), 100);
    return () => clearTimeout(timeout);
  }, [chatHistory, throttledHandleScroll]);

  // Use the selected model passed down for the button, but model from logic elsewhere
  const displayModelName = passedSelectedModel?.name;
  const displayProviderName = passedSelectedModel?.provider;

  // Handle edit message request from a message
  const handleEditMessage = useCallback((message) => {
    // Can't edit while waiting for response
    if (isWaitingForResponse) return;
    setEditingMessage(message);
    // Scroll to input area if needed
    setTimeout(() => {
      const inputArea = document.querySelector(`.${styles.fixedInputArea}`);
      if (inputArea) {
        inputArea.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, [isWaitingForResponse]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  // Disable editing if the model starts responding
  useEffect(() => {
    if (isWaitingForResponse && editingMessage) {
      setEditingMessage(null);
    }
  }, [isWaitingForResponse, editingMessage]);

  // Classes for the main container
  const chatContainerClasses = `${styles.ChatContainer} ${isActiveChat ? styles['ChatContainer--activeChat'] : styles['ChatContainer--emptyChat']} ${editingMessage ? styles['ChatContainer--editingMode'] : ''}`;

  // Helper function to render the input area contents
  const renderInputAreaContents = (isFixedLayout) => {
    
    return (
      <>
        {/* Global Metrics: Only show when fixed */} 
        {isFixedLayout && !editingMessage && (
          <Suspense fallback={<div className={styles.globalMetricsPlaceholder} />}>
            <GlobalMetricsBar 
              metrics={metrics?.session}
              modelName={modelFromLogic?.name} 
            />
          </Suspense>
        )}

        <div className={styles.ChatContainer__inputControlsWrapper}> 
          <Suspense fallback={<div className={styles.ChatContainer__inputPlaceholder} />}>
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isWaitingForResponse} 
              selectedModel={modelFromLogic} 
              editingMessage={editingMessage}
              onCancelEdit={handleCancelEdit}
              isStreaming={isWaitingForResponse}
              toggleModelSelector={toggleModelSelector}
              onFocus={focusInputField}
              isAtBottom={isAtBottom}
            />
          </Suspense>
        </div>
      </>
    );
  };

  // Update CSS var for input height

  return (
    <div className={chatContainerClasses}>
      {/* Container for the Model Selector Button */}
      <div className={styles.ChatContainer__modelButtonContainer}>
        <Suspense fallback={null}> 
          <ModelSelectorButton 
            selectedModelName={displayModelName}
            providerName={displayProviderName}
            onClick={toggleModelSelector}
            disabled={isLoadingModels}
          />
        </Suspense>
      </div>

      <div className={styles.ChatContainer__chatAreaWrapper}>
        <div className={styles.ChatContainer__chatArea}>
          {isActiveChat ? (
            // Active Chat: Render MessageList inside scroll container
            <div className={styles.ChatContainer__scrollContainer} ref={scrollContainerRef}>
              <div className={styles.ChatContainer__scrollInner}>
                <Suspense fallback={<div className={styles.messagePlaceholder} />}>
                  <MessageList
                    ref={messageListRef}
                    messages={chatHistory}
                    error={error}
                    onEditMessage={handleEditMessage}
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            // Empty Chat: Render Greeting and Input Area (Static Layout)
            <div className={styles.ChatContainer__emptyChatContent}>
              <div className={styles.ChatContainer__greetingMessage}>
                <h2>Welcome to AI Chat!</h2>
                <p>Select a model above and start your conversation.</p>
              </div>
              {/* Render input area directly below greeting */}
              <div className={`${styles.ChatContainer__inputArea} ${styles.ChatContainer__staticInputArea}`}> 
                {renderInputAreaContents(false)} 
              </div>
            </div>
          )}
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollToBottomButton && isActiveChat && (
          <button
            className={styles.ChatContainer__scrollToBottomButton}
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
        <div className={`${styles.ChatContainer__inputArea} ${styles.ChatContainer__fixedInputArea}`}> 
          {renderInputAreaContents(true)} 
        </div>
      )}
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';

ChatContainer.propTypes = {
  selectedModel: PropTypes.object, // Shape could be refined
  isLoadingModels: PropTypes.bool,
  toggleModelSelector: PropTypes.func.isRequired,
  onToggleSettings: PropTypes.func.isRequired,
  isSidebarOpen: PropTypes.bool,
  isSettingsOpen: PropTypes.bool,
  isModelSelectorOpen: PropTypes.bool
};

export default ChatContainer; 