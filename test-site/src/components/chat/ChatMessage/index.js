import React, { memo, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatMessageContent } from '../../../utils/formatters';
import styles from './ChatMessage.module.css';

/**
 * Individual chat message component
 * @param {Object} props - Component props
 * @param {string} props.role - Message role (user, assistant, system, error)
 * @param {string} props.content - Message content
 * @param {boolean} [props.isStreaming=false] - Whether the message is currently streaming
 * @returns {JSX.Element} - Rendered component
 */
const ChatMessage = memo(({ role, content, isStreaming = false }) => {
  const { isDark } = useTheme();
  
  // Determine CSS classes based on role
  const messageClass = useMemo(() => {
    const baseClass = styles.message;
    
    switch (role) {
      case 'user':
        return `${baseClass} ${styles.userMessage}`;
      case 'assistant':
        return `${baseClass} ${styles.assistantMessage}`;
      case 'system':
        return `${baseClass} ${styles.systemMessage}`;
      case 'error':
        return `${baseClass} ${styles.errorMessage}`;
      default:
        return baseClass;
    }
  }, [role]);
  
  // Process code blocks in the content
  const formattedContent = useMemo(() => {
    return processMessageContent(content, isDark);
  }, [content, isDark]);
  
  return (
    <div 
      className={`${messageClass} ${isStreaming ? styles.streaming : ''}`}
      data-role={role}
    >
      <div className={styles.avatar}>
        {getAvatarIcon(role)}
      </div>
      
      <div 
        className={styles.messageContent}
        dangerouslySetInnerHTML={{ __html: formattedContent }}
      />
    </div>
  );
});

/**
 * Process message content with code highlighting
 * @param {string} content - Raw message content
 * @param {boolean} isDark - Whether dark theme is active
 * @returns {string} - HTML formatted content
 */
const processMessageContent = (content, isDark) => {
  if (!content) return '';
  
  // First, process all code blocks
  const codeBlockRegex = /```(\w*)([\s\S]*?)```/g;
  let result = content;
  let match;
  let lastIndex = 0;
  let processedContent = '';
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index);
      processedContent += formatMessageContent(textBefore);
    }
    
    // Get language and code
    const language = match[1].trim() || 'plaintext';
    const code = match[2].trim();
    
    // Create highlighted code
    const highlightedCode = highlightCode(code, language, isDark);
    processedContent += highlightedCode;
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex);
    processedContent += formatMessageContent(textAfter);
  }
  
  return result.includes('```') ? processedContent : formatMessageContent(content);
};

/**
 * Highlight code using SyntaxHighlighter
 * @param {string} code - Code to highlight
 * @param {string} language - Programming language
 * @param {boolean} isDark - Whether dark theme is active
 * @returns {string} - HTML with highlighted code
 */
const highlightCode = (code, language, isDark) => {
  // Use appropriate theme based on current app theme
  const style = isDark ? atomDark : prism;
  
  try {
    // Use SyntaxHighlighter to highlight the code
    const highlighted = SyntaxHighlighter.highlight(code, language, style);
    
    // Wrap in code block elements
    return `<div class="${styles.codeBlock}">
      <div class="${styles.codeHeader}">
        <span class="${styles.language}">${language}</span>
        <button class="${styles.copyButton}" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`)">
          Copy
        </button>
      </div>
      <pre class="${styles.pre}"><code class="${styles.code} language-${language}">${highlighted}</code></pre>
    </div>`;
  } catch (error) {
    console.error('Error highlighting code:', error);
    
    // Fallback to simple code block
    return `<div class="${styles.codeBlock}">
      <pre class="${styles.pre}"><code class="${styles.code}">${code}</code></pre>
    </div>`;
  }
};

/**
 * Get avatar icon based on role
 * @param {string} role - Message role
 * @returns {JSX.Element} - Avatar SVG icon
 */
const getAvatarIcon = (role) => {
  switch (role) {
    case 'user':
      return (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'assistant':
      return (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="10" r="3" />
          <path d="M7 16.3c0-3 2.5-5.5 5.5-5.5h1c3 0 5.5 2.5 5.5 5.5" />
          <path d="M12 13 L12 16" />
        </svg>
      );
    case 'system':
      return (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M8 10h8" />
          <path d="M8 14h4" />
        </svg>
      );
    case 'error':
      return (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    default:
      return null;
  }
};

// Display name for debugging
ChatMessage.displayName = 'ChatMessage';

export default ChatMessage; 