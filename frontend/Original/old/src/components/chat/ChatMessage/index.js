import React, { memo, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { useTheme } from '../../../contexts/ThemeContext';
import { useChat } from '../../../contexts/ChatContext';
import styles from './ChatMessage.module.css';
import { PersonIcon, CopilotIcon, GearIcon, AlertIcon, CopyIcon, CheckIcon, ClockIcon, PulseIcon } from '@primer/octicons-react';
import StreamingMessage from './StreamingMessage';

// Import prism theme for final rendered content
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import prismDark from 'react-syntax-highlighter/dist/esm/styles/prism/atom-dark';
import prismLight from 'react-syntax-highlighter/dist/esm/styles/prism/prism';

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
const ChatMessage = ({ message, isStreaming }) => {
  const { isWaitingForResponse } = useChat();
  const { isDark } = useTheme();
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(-1);
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
  
  // Determine if this message should use streaming optimization
  const shouldUseStreamingOptimization = isStreaming && message.role === 'assistant';
  
  // Determine if we should use direct text updates for streaming optimization
  // This applies to assistant messages that are currently streaming
  const shouldUseDirectTextUpdate = message.role === 'assistant' && 
                                   isWaitingForResponse && 
                                   isStreaming;
  
  // Handle copying code to clipboard
  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCodeIndex(index);
      setTimeout(() => setCopiedCodeIndex(-1), 2000);
    });
  };
  
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
  // ==========================================
  
  // Process message content to format code blocks
  const processContent = (content) => {
    if (!content) return '';
    
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\s*\n?([\s\S]*?)```/g;
    let match;
    let lastIndex = 0;
    let result = '';
    let codeBlockIndex = 0;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        result += content.substring(lastIndex, match.index);
      }
      
      // Get language and code content
      const language = match[1] || 'plaintext';
      const code = match[2] || '';
      const isCopied = codeBlockIndex === copiedCodeIndex;
      
      // Add formatted code block
      result += `
        <div class="${styles.codeBlockContainer}">
          <div class="${styles.codeHeader}">
            <span class="${styles.language}">${language}</span>
            <button 
              class="${styles.copyButton}"
              onclick="document.dispatchEvent(new CustomEvent('copy-code', {detail: {index: ${codeBlockIndex}, code: \`${escapeForHtml(code)}\`}}))"
            >
              ${isCopied ? 
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg> Copied!` : 
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14"><path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path><path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path></svg> Copy`
              }
            </button>
          </div>
          <pre class="${styles.pre}"><code class="language-${language}">${escapeHtml(code)}</code></pre>
        </div>
      `;
      
      lastIndex = match.index + match[0].length;
      codeBlockIndex++;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      result += content.substring(lastIndex);
    }
    
    // Setup copy code event listener
    if (typeof window !== 'undefined' && codeBlockIndex > 0) {
      setTimeout(() => {
        document.addEventListener('copy-code', (e) => {
          handleCopyCode(e.detail.code, e.detail.index);
        }, { once: false });
      }, 0);
    }
    
    return result;
  };
  
  // Escape HTML for code blocks
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  // Escape for HTML attributes in JS
  const escapeForHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/"/g, '\\"');
  };
  
  // Render performance metrics (Now includes the button)
  const renderMetrics = () => {
    if (!shouldShowMetrics || !message.metrics) return null;
    
    const isGenerating = isWaitingForResponse;
    const { elapsedTime, tokenCount, tokensPerSecond, timeToFirstToken } = message.metrics;
    
    return (
      <div className={styles.metricsContainer}>
        {timeToFirstToken && (
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
    // Use custom HTML processing for non-streaming
    if (message.role === 'assistant') {
      const processed = processContent(content);
      return (
        <div className={styles.markdown} dangerouslySetInnerHTML={{ __html: processed }} />
      );
    }
    
    // Use simple ReactMarkdown for user messages
    return (
      <ReactMarkdown
        className={styles.markdown}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
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
            <StreamingMessage content={message.content} />
          ) : (
            renderMarkdown(message.content || '')
          )}
        </div>

        {/* Render metrics (which now includes the button if applicable) */}
        {message.role === 'assistant' && renderMetrics()}

        {/* Render button at bottom-right for non-assistant OR assistant without metrics */}
        {(message.role !== 'assistant' || !shouldShowMetrics) && copyButtonJsx}

      </div>
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
  isStreaming: PropTypes.bool
};

export default memo(ChatMessage); 