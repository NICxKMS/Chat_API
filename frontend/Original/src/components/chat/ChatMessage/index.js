import React, { memo, useMemo, Suspense, lazy, useContext } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../../../contexts/ThemeContext';
import { useChat } from '../../../contexts/ChatContext';
import styles from './ChatMessage.module.css';
import { PersonIcon, CopilotIcon, GearIcon, AlertIcon, CopyIcon, ClockIcon, PulseIcon } from '@primer/octicons-react';
import StreamingMessage from './StreamingMessage';
import { ChatContext } from '../../../contexts/ChatContext';

// Lazy load SyntaxHighlighter and styles
const SyntaxHighlighter = lazy(() => import('react-syntax-highlighter'));
const lazyLoadStyle = lazy(() => import('react-syntax-highlighter/dist/esm/styles/prism'));

// Utility to copy text to clipboard
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

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
 * Component to render code blocks with syntax highlighting and copy button
 */
const CodeBlock = memo(({ node, inline, className, children, ...props }) => {
  const { isDark } = useTheme();
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1] || 'plaintext';
  const codeString = String(children).replace(/\n$/, ''); // Remove trailing newline

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString).then(() => {
      console.log('Code copied!');
    }).catch(err => {
      console.error('Failed to copy code:', err);
    });
  };

  const StyleComponent = useMemo(() => lazyLoadStyle(isDark), [isDark]);

  return !inline ? (
    <div className={styles.codeBlockContainer}> 
      <div className={styles.codeHeader}>
        <span className={styles.language}>{language}</span>
        <button className={styles.copyButton} onClick={handleCopy} aria-label="Copy code">
          <CopyIcon size={14} className={styles.copyIcon} /> Copy
        </button>
      </div>
      <Suspense fallback={<pre className={styles.pre}><code>Loading style...</code></pre>}>
        <StyleComponent>
          {(style) => (
            <Suspense fallback={<pre className={styles.pre}><code>Loading highlighter...</code></pre>}>
              <SyntaxHighlighter
                style={style}
                language={language}
                PreTag="pre"
                className={styles.pre}
                wrapLines={true}
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            </Suspense>
          )}
        </StyleComponent>
      </Suspense>
    </div>
  ) : (
    <code className={`${styles.inlineCode} ${className}`} {...props}>
      {children}
    </code>
  );
});
CodeBlock.displayName = 'CodeBlock';
CodeBlock.propTypes = { /* Add PropTypes if needed */ };

/**
 * ChatMessage component with optimized rendering for streaming content
 * @param {Object} props - Component props
 * @param {string} props.role - Message role (user, assistant, system, error)
 * @param {string} props.content - Message content
 * @param {number} props.index - Message index in the chat history
 * @param {boolean} props.isStreaming - Whether this message is currently streaming
 * @returns {JSX.Element} - Rendered component
 */
const ChatMessage = ({ message, isStreaming }) => {
  const { streamingTextRef } = useContext(ChatContext);
  const { isWaitingForResponse, metrics } = useChat();
  
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
  const shouldShowMetrics = message.role === 'assistant' && 
                           (isWaitingForResponse || (metrics && metrics.isComplete));
  
  // Determine if this message should use streaming optimization
  const shouldUseStreamingOptimization = isStreaming && message.role === 'assistant';
  
  // Determine if we should use direct text updates for streaming optimization
  // This applies to assistant messages that are currently streaming
  const shouldUseDirectTextUpdate = message.role === 'assistant' && 
                                   isWaitingForResponse && 
                                   isStreaming;
  
  // Function to render code blocks with syntax highlighting
  const renderCode = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    // Handle inline code differently
    if (inline) {
      return (
        <code className={styles.inlineCode} {...props}>
          {children}
        </code>
      );
    }
    
    // Extract code content
    const codeContent = String(children).replace(/\n$/, '');
    
    // Copy code to clipboard handler
    const handleCopyCode = async () => {
      try {
        await navigator.clipboard.writeText(codeContent);
        console.log('Code copied to clipboard');
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    };
    
    // Render code block with syntax highlighting
    return (
      <div className={styles.codeBlockContainer}>
        <div className={styles.codeHeader}>
          <span className={styles.language}>{language || 'code'}</span>
          <button onClick={handleCopyCode} className={styles.copyButton}>
            <CopyIcon size={14} className={styles.copyIcon} />
            Copy
          </button>
        </div>
        <Suspense fallback={<pre>{codeContent}</pre>}>
          <SyntaxHighlighter
            language={language}
            className={styles.pre}
            useInlineStyles={false}
            // Use the lazyLoadStyle when it's loaded
            style={lazyLoadStyle}
            wrapLongLines={true}
            showLineNumbers={!inline && language !== 'text'}
          >
            {codeContent}
          </SyntaxHighlighter>
        </Suspense>
      </div>
    );
  };
  
  // Render performance metrics
  const renderMetrics = () => {
    if (!shouldShowMetrics || !metrics) return null;
    
    const isGenerating = isWaitingForResponse;
    const { elapsedTime, tokenCount, tokensPerSecond } = metrics;
    
    return (
      <div className={styles.metricsContainer}>
        {elapsedTime && (
          <span className={styles.metric}>
            <ClockIcon size={14} className={styles.metricIcon} />
            Time: {formatTime(elapsedTime)}
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
      </div>
    );
  };
  
  // For streaming assistant messages, use the optimized component
  if (shouldUseStreamingOptimization) {
    return (
      <div className={styles.message + ' ' + messageClass}>
        <div className={styles.avatar}>
          {icon}
        </div>
        <div className={styles.messageContentWrapper}>
          <div className={styles.messageContent}>
            <StreamingMessage content={message.content} />
          </div>
          {renderMetrics()}
        </div>
      </div>
    );
  }
  
  // For non-streaming messages, use the standard ReactMarkdown rendering
  return (
    <div className={styles.message + ' ' + messageClass}>
      {/* Avatar section */}
      <div className={styles.avatar}>
        {icon}
      </div>
      
      {/* Message content section */}
      <div className={styles.messageContentWrapper}>
        <div className={styles.messageContent}>
          {shouldUseDirectTextUpdate ? (
            // Use StreamingMessage for optimized streaming content rendering
            <StreamingMessage content={message.content} />
          ) : (
            // Use normal ReactMarkdown for non-streaming content
            <ReactMarkdown
              className={styles.markdown}
              remarkPlugins={[remarkGfm]}
              components={{ code: renderCode }}
            >
              {message.content || ''}
            </ReactMarkdown>
          )}
        </div>
        {renderMetrics()}
      </div>
    </div>
  );
};

ChatMessage.propTypes = {
  message: PropTypes.shape({
    role: PropTypes.oneOf(['user', 'assistant', 'system', 'error']).isRequired,
    content: PropTypes.string.isRequired,
  }).isRequired,
  isStreaming: PropTypes.bool.isRequired,
};

ChatMessage.displayName = 'ChatMessage';

export default memo(ChatMessage); 