// eslint-disable import/first
import React, { memo, useMemo, useState, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import LazyMarkdownRenderer from '../../common/LazyMarkdownRenderer';
import { PersonIcon, CopilotIcon, GearIcon, AlertIcon, CheckIcon, CopyIcon, ClockIcon, PulseIcon, PencilIcon } from '@primer/octicons-react';
import styles from './ChatMessage.module.css';
import { convertTeXToMathDollars } from '../../../utils/formatters';
// Dynamically load StreamingMessage to defer heavy modules
const StreamingMessage = lazy(() => import('./StreamingMessage'));

/**
 * Format time in milliseconds to a human-readable format
 * @param {number} ms - Time in milliseconds
 * @returns {string} - Formatted time string
 */
const formatTime = (ms) => {
  if (!ms) return '0.0s';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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
const ChatMessage = ({ message, isStreaming, onEditMessage }) => {
  const [messageCopied, setMessageCopied] = useState(false);
  
  // Choose appropriate icon based on message role
  const icon = useMemo(() => {
    switch (message.role) {
      case 'user':
        return <PersonIcon size={16} className={styles.icon} />;
      case 'assistant':
        return <CopilotIcon size={16} className={styles.icon} />;
      case 'system':
        return <GearIcon size={16} className={styles.icon} />;
      case 'error':
        return <AlertIcon size={16} className={styles.icon} />;
      default:
        return null;
    }
  }, [message.role]);
  
  // Select CSS classes based on message role
  const messageClass = useMemo(() => {
    switch (message.role) {
      case 'user':
        return styles.userMessage;
      case 'assistant':
        return styles.assistantMessage;
      case 'system':
        return styles.systemMessage;
      case 'error':
        return styles.errorMessage;
      default:
        return '';
    }
  }, [message.role]);
  
  // Determine if we should show metrics (only for assistant messages)
  const shouldShowMetrics = useMemo(() => {
    if (message.role !== 'assistant' || !message.metrics) return false;
    
    // Check if we have any valid metrics values
    const { elapsedTime, tokenCount, tokensPerSecond, timeToFirstToken } = message.metrics;
    return elapsedTime !== null || tokenCount !== null || tokensPerSecond !== null || timeToFirstToken !== null;
  }, [message.role, message.metrics]);
  
  // console.log('Should show metrics:', shouldShowMetrics, { role: message.role, metrics: message.metrics });
  
  // Copy message content to clipboard
  const handleCopyMessage = () => {
    // If content is an array (multimodal message), extract just the text
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
  };
  
  // === BUTTON JSX (Moved here for reuse) ===
  const copyButtonJsx = (
    <button
      className={`${styles.copyMessageButton} ${ // Apply conditional class later
        (message.role === 'assistant' && shouldShowMetrics) ? styles.copyButtonInMetrics : styles.copyButtonBottomRight
      }`}
      onClick={handleCopyMessage}
      aria-label="Copy message"
      title="Copy message"
    >
      {messageCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
    </button>
  );

  // Edit button only for user messages
  const editButtonJsx = message.role === 'user' ? (
    <button
      className={styles.editMessageButton}
      onClick={() => onEditMessage && onEditMessage(message)}
      aria-label="Edit message"
      title="Edit message"
    >
      <PencilIcon size={16} />
    </button>
  ) : null;
  // ==========================================
  
  // Render performance metrics (Now includes the button)
  const renderMetrics = () => {
    if (!shouldShowMetrics || !message.metrics) return null;
    
    // Use the specific isStreaming prop passed down to determine if THIS message is generating
    const isGenerating = isStreaming;
    const { elapsedTime, tokenCount, tokensPerSecond, timeToFirstToken } = message.metrics;
    
    return (
      <div className={styles.metricsContainer}>
        {/* Only show TTFT for streaming messages where timeToFirstToken exists */}
        {timeToFirstToken !== null && (
          <span className={styles.metric}>
            <ClockIcon size={14} className={styles.metricIcon} />
            First Token: {formatTime(timeToFirstToken)}
          </span>
        )}
        {elapsedTime && (
          <span className={styles.metric}>
            <ClockIcon size={14} className={styles.metricIcon} />
            Total Time: {formatTime(elapsedTime)}
          </span>
        )}
        {tokenCount && (
          <span className={styles.metric}>
            <CopilotIcon size={14} className={styles.metricIcon} />
            Tokens: {tokenCount}
          </span>
        )}
        {tokensPerSecond && (
          <span className={styles.metric}>
            <PulseIcon size={14} className={styles.metricIcon} />
            Speed: {tokensPerSecond} t/s
          </span>
        )}
        {isGenerating && (
          <span className={`${styles.metric} ${styles.generatingIndicator}`}>
            <span className={styles.generatingDot}></span>
            Generating...
          </span>
        )}
        {/* Render the button here for assistant messages with metrics */}
        {copyButtonJsx}
      </div>
    );
  };
  
  // Process markdown content safely
  const renderMarkdown = (content) => {
    // Convert TeX notation if content is a string
    const processedContent = typeof content === 'string' ? convertTeXToMathDollars(content) : content;
    
    // Use dynamic LazyMarkdownRenderer for non-blocking markdown rendering
    return (
      <Suspense fallback={null}>
        <LazyMarkdownRenderer>
          {processedContent}
        </LazyMarkdownRenderer>
      </Suspense>
    );
  };
  
  // Main return
  return (
    <div className={styles.message + ' ' + messageClass}>
      {/* Avatar section */}
      <div className={styles.avatar}>
        {icon}
      </div>
      
      {/* Message content section */}
      <div className={styles.messageContentWrapper}>
        <div className={styles.messageContent}>
          {message.role === 'assistant' ? (
            <StreamingMessage content={message.content} isStreaming={isStreaming} />
          ) : (
            renderMarkdown(message.content || '')
          )}
        </div>

        {/* Render metrics (which now includes the button if applicable) */}
        {message.role === 'assistant' && renderMetrics()}

        {/* Render copy button at bottom-right for non-user assistant without metrics */}
        {message.role !== 'user' && (message.role !== 'assistant' || !shouldShowMetrics) && copyButtonJsx}
      </div>

      {/* User message buttons container - moved to be direct child of message */}
      {message.role === 'user' && (
        <div className={styles.userButtonContainer}>
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