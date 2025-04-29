// eslint-disable import/first
import React, { memo, useMemo, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { PersonIcon, CopilotIcon, GearIcon, AlertIcon, CheckIcon, CopyIcon, ClockIcon, PulseIcon, PencilIcon } from '@primer/octicons-react';
import styles from './ChatMessage.module.css';
import { formatTime } from '../../../utils/messageHelpers';
import { convertTeXToMathDollars } from '../../../utils/formatters';
// Lazy-load Markdown renderer for user/system/error messages
import LazyMarkdownRenderer from '../../common/LazyMarkdownRenderer';
// Dynamically load StreamingMessage to defer heavy modules
const StreamingMessage = lazy(() => import(/* webpackChunkName: "streaming-message", webpackPrefetch: true */ './StreamingMessage'));

// Add a module-level singleton for the TeX worker so we only load the worker script once
let texWorker;
const getTexWorker = () => {
  if (typeof Worker !== 'undefined' && !texWorker) {
    texWorker = new Worker(new URL('../../../workers/texProcessor.js', import.meta.url), { type: 'module' });
  }
  return texWorker;
};

/**
 * ChatMessage component with optimized rendering for streaming content
 * @param {Object} props - Component props
 * @param {string} props.role - Message role (user, assistant, system, error)
 * @param {string} props.content - Message content
 * @param {number} props.index - Message index in the chat history
 * @param {boolean} props.isStreaming - Whether this message is currently streaming
 * @returns {JSX.Element} - Rendered component
 */
const ChatMessage = ({ message, isStreaming, onEditMessage, overrideContent }) => {
  // Use overrideContent if provided, else fall back to message.content
  const content = overrideContent != null ? overrideContent : message.content;

  const [messageCopied, setMessageCopied] = useState(false);
  const defaultProcessedMessage = useMemo(() => (
    message.role === 'assistant'
      ? content
      : convertTeXToMathDollars(content)
  ), [content, message.role]);
  const [processedMessage, setProcessedMessage] = useState(defaultProcessedMessage);

  useEffect(() => {
    if (message.role !== 'assistant' || typeof content !== 'string' || typeof Worker === 'undefined') {
      return;
    }
    const id = message.timestamp;
    const worker = getTexWorker();
    const handleMessage = (e) => {
      if (e.data.id !== id) return;
      if (e.data.success) setProcessedMessage(e.data.data);
      else setProcessedMessage(content);
    };
    worker.addEventListener('message', handleMessage);
    worker.postMessage({ id, content });
    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [content, message.role, message.timestamp]);
  
  // Choose appropriate icon based on message role
  const icon = useMemo(() => {
    switch (message.role) {
      case 'user':
        return <PersonIcon size={16} className={styles.ChatMessage__icon} />;
      case 'assistant':
        return <CopilotIcon size={16} className={styles.ChatMessage__icon} />;
      case 'system':
        return <GearIcon size={16} className={styles.ChatMessage__icon} />;
      case 'error':
        return <AlertIcon size={16} className={styles.ChatMessage__icon} />;
      default:
        return null;
    }
  }, [message.role]);
  
  // Select CSS classes based on message role
  const messageClass = useMemo(() => {
    switch (message.role) {
      case 'user':
        return styles['ChatMessage--user'];
      case 'assistant':
        return styles['ChatMessage--assistant'];
      case 'system':
        return styles['ChatMessage--system'];
      case 'error':
        return styles['ChatMessage--error'];
      default:
        return '';
    }
  }, [message.role]);
  
  // Determine if we should show metrics (only for assistant messages)
  const shouldShowMetrics = useMemo(() => {
    // Show metrics if this is an assistant message with any metrics
    if (message.role !== 'assistant' || !message.metrics) return false;
    return true;
  }, [message.role, message.metrics]);
  
  // Copy message content to clipboard
  const handleCopyMessage = useCallback(() => {
    const content = typeof message.content === 'string' 
      ? message.content 
      : Array.isArray(message.content) 
        ? message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n')
        : '';
    navigator.clipboard.writeText(content).then(() => {
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    });
  }, [message.content]);
  
  // === BUTTON JSX (Moved here for reuse) ===
  const copyButtonJsx = useMemo(() => (
    <button
      className={`${styles.ChatMessage__copyMessageButton} ${
        (message.role === 'assistant' && shouldShowMetrics) ? styles.ChatMessage__copyMessageButtonInMetrics : styles.ChatMessage__copyMessageButtonBottomRight
      }`}
      onClick={handleCopyMessage}
      aria-label="Copy message"
      title="Copy message"
    >
      {messageCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
    </button>
  ), [handleCopyMessage, message.role, shouldShowMetrics, messageCopied]);

  // Edit button only for user messages
  const handleEditClick = useCallback(() => {
    if (onEditMessage) onEditMessage(message);
  }, [onEditMessage, message]);
  const editButtonJsx = useMemo(() => message.role === 'user' ? (
    <button
      className={styles.ChatMessage__editMessageButton}
      onClick={handleEditClick}
      aria-label="Edit message"
      title="Edit message"
    >
      <PencilIcon size={16} />
    </button>
  ) : null, [message.role, handleEditClick]);
  // ==========================================
  
  // Render performance metrics (only for assistant messages)
  const renderMetrics = () => {
    if (!shouldShowMetrics || !message.metrics) return null;
    
    // Use the specific isStreaming prop passed down to determine if THIS message is generating
    const isGenerating = isStreaming;
    const { 
      elapsedTime, 
      tokenCount, 
      tokensPerSecond, 
      timeToFirstToken, 
      promptTokens, 
      completionTokens, 
      totalTokens,
      finishReason 
    } = message.metrics;
    
    // Check if we have any valid metrics to show
    const hasValidMetrics = 
      elapsedTime != null || 
      tokenCount != null || 
      tokensPerSecond != null || 
      timeToFirstToken != null ||
      promptTokens != null ||
      completionTokens != null ||
      totalTokens != null ||
      finishReason != null;
      
    // Don't render anything if no valid metrics are found
    if (!hasValidMetrics) return null;
    
    return (
      <div className={styles.ChatMessage__metricsContainer}>
        {/* Time metrics */}
        {timeToFirstToken != null && timeToFirstToken !== 0 && (
          <span className={styles.ChatMessage__metric}>
            <ClockIcon size={14} className={styles.ChatMessage__metricIcon} />
            First Token: {formatTime(timeToFirstToken)}
          </span>
        )}
        {elapsedTime != null && elapsedTime !== 0 && (
          <span className={styles.ChatMessage__metric}>
            <ClockIcon size={14} className={styles.ChatMessage__metricIcon} />
            Total Time: {formatTime(elapsedTime)}
          </span>
        )}
        
        {/* Token metrics */}
        {tokenCount != null && tokenCount !== 0 && (
          <span className={styles.ChatMessage__metric}>
            <CopilotIcon size={14} className={styles.ChatMessage__metricIcon} />
            Tokens: {tokenCount}
          </span>
        )}
        {promptTokens != null && promptTokens !== 0 && (
          <span className={styles.ChatMessage__metric}>
            <CopilotIcon size={14} className={styles.ChatMessage__metricIcon} />
            Prompt: {promptTokens}
          </span>
        )}
        {completionTokens != null && completionTokens !== 0 && (
          <span className={styles.ChatMessage__metric}>
            <CopilotIcon size={14} className={styles.ChatMessage__metricIcon} />
            Completion: {completionTokens}
          </span>
        )}
        {totalTokens != null && totalTokens !== 0 && (
          <span className={styles.ChatMessage__metric}>
            <CopilotIcon size={14} className={styles.ChatMessage__metricIcon} />
            Total: {totalTokens}
          </span>
        )}
        
        {/* Speed metrics */}
        {tokensPerSecond != null && tokensPerSecond !== 0 && (
          <span className={styles.ChatMessage__metric}>
            <PulseIcon size={14} className={styles.ChatMessage__metricIcon} />
            Speed: {tokensPerSecond} t/s
          </span>
        )}
        
        {/* Status */}
        {finishReason != null && finishReason !== '' && (
          <span className={styles.ChatMessage__metric}>
            <AlertIcon size={14} className={styles.ChatMessage__metricIcon} />
            {finishReason}
          </span>
        )}
        {isGenerating && (
          <span className={`${styles.ChatMessage__metric} ${styles.ChatMessage__generatingIndicator}`}>
            <span className={styles.ChatMessage__generatingDot}></span>
            Generating...
          </span>
        )}
        
        {/* Copy button */}
        {copyButtonJsx}
      </div>
    );
  };
  
  // Main return
  return (
    <div className={styles.ChatMessage + ' ' + messageClass}>
      {/* Avatar */}
      <div className={styles.ChatMessage__avatar}>{icon}</div>

      {/* Message content section */}
      <div className={styles.ChatMessage__contentWrapper}>
        <Suspense fallback={null}>
          <div className={styles.ChatMessage__content}>
            {message.role === 'assistant' ? (
              <StreamingMessage
                content={processedMessage}
                isStreaming={isStreaming}
              />
            ) : (
              // Render markdown lazily for user/system/error messages
              <LazyMarkdownRenderer>
                {processedMessage}
              </LazyMarkdownRenderer>
            )}
          </div>
        </Suspense>

        {/* Render performance metrics for assistant messages */}
        {message.role === 'assistant' && renderMetrics()}

        {/* Copy button for non-user messages, hide when assistant metrics exist */}
        {message.role !== 'user' && (message.role !== 'assistant' || !shouldShowMetrics) && copyButtonJsx}
      </div>

      {/* User-specific buttons */}
      {message.role === 'user' && (
        <div className={styles.ChatMessage__userButtonContainer}>
          {editButtonJsx}
          {copyButtonJsx}
        </div>
      )}
    </div>
  );
};

ChatMessage.propTypes = {
  message: PropTypes.shape({
    role: PropTypes.string.isRequired,
    content: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.array
    ]).isRequired
  }).isRequired,
  isStreaming: PropTypes.bool,
  onEditMessage: PropTypes.func
};

export default memo(ChatMessage); 