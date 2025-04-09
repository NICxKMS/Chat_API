import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatMessage.module.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../../contexts/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '../../../contexts/ChatContext';

/**
 * StreamingMessage component using react-markdown for rendering
 */
const StreamingMessage = ({ content }) => {
  const [parsedSegments, setParsedSegments] = useState([]);
  const { isDark } = useTheme();
  const { isWaitingForResponse } = useChat();
  const [copiedCode, setCopiedCode] = useState(null); // Track which code block is copied
  
  // Get the appropriate syntax highlighter theme based on dark/light mode
  const syntaxTheme = isDark ? atomDark : prism;
  
  // Process the streaming content for display with code block detection
  const processStreamingContent = (text) => {
    if (!text) return [];
    
    try {
      const segments = [];
      const codeBlockRegex = /```([\w-]*)\s*\n([\s\S]*?)```|```([\w-]*)\s*([\s\S]*?)$/g;
      let lastIndex = 0;
      let match;
      
      while ((match = codeBlockRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          segments.push({
            type: 'text',
            content: text.substring(lastIndex, match.index)
          });
        }
        
        const language = match[1] || match[3] || '';
        const codeContent = match[2] || match[4] || '';
        const isComplete = !!match[2]; 
        
        segments.push({
          type: 'code',
          language: language.trim(),
          content: codeContent,
          complete: isComplete
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < text.length) {
        segments.push({
          type: 'text',
          content: text.substring(lastIndex)
        });
      }
      
      return segments;
    } catch (error) {
      console.error("Error processing streaming content:", error);
      return [{ type: 'text', content: text }];
    }
  };

  // Handle copy code to clipboard
  const handleCopyCode = (code, segmentId) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(segmentId);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };
  
  // Update segments whenever content changes, with debounce for streaming
  useEffect(() => {
    if (!content) return;
    
    // Create a debounced update function to prevent too many re-renders
    const updateSegmentsWithDebounce = () => {
      const timeoutId = setTimeout(() => {
        try {
          const segments = processStreamingContent(content);
          setParsedSegments(segments);
        } catch (error) {
          console.error("Error updating segments:", error);
          setParsedSegments([{ type: 'text', content }]);
        }
      }, 50); // 50ms debounce

      return timeoutId;
    };

    const timeoutId = updateSegmentsWithDebounce();
    
    // Clean up timeout on content change or unmount
    return () => clearTimeout(timeoutId);
  }, [content]);
  
  // Render a text segment using ReactMarkdown
  const renderTextSegment = (textContent, key) => {
    if (!textContent) return null;
    
    try {
      // Use react-markdown for rendering text segments
      // Add components prop for customizations if needed later (e.g., links, images)
      return (
        <div 
          key={key} 
          className={styles.markdownText} // Main container for markdown text
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {textContent}
          </ReactMarkdown>
        </div>
      );
    } catch (error) {
      console.error("Error rendering text segment with ReactMarkdown:", error);
      // Fallback to preformatted text
      return <div key={key} className={styles.markdownText}><pre>{textContent}</pre></div>;
    }
  };
  
  // Render code block by language type
  const renderCodeBlock = (segment, index) => {
    if (!segment) return null;
    
    try {
      const cssClass = !segment.complete ? styles.incompleteCodeBlock : '';
      const segmentId = `code-${index}`;
      const isCopied = copiedCode === segmentId;
      
      // Special handling for "markdown" language blocks - render using ReactMarkdown
      if (segment.language === 'markdown') {
        return (
          <div key={index} className={`${styles.codeBlockContainer} ${cssClass}`}>
            <div className={styles.codeHeader}>
              <span className={styles.language}>markdown</span>
              <button 
                className={styles.copyButton}
                onClick={() => handleCopyCode(segment.content, segmentId)}
              >
                {isCopied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
                      <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
                    </svg> Copied!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
                      <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path>
                      <path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path>
                    </svg> Copy
                  </>
                )}
              </button>
            </div>
            {/* Render content as interpreted Markdown using ReactMarkdown */}
            <div className={styles.markdownCodeBlock}> 
              {/* This inner div provides padding/background matching code blocks */}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                 {segment.content || ''}
              </ReactMarkdown>
            </div>
          </div>
        );
      }
      
      // Special handling for "plaintext" language blocks - render raw text
      if (segment.language === 'plaintext' || segment.language === '') {
        return (
          <div key={index} className={`${styles.codeBlockContainer} ${cssClass}`}>
            <div className={styles.codeHeader}>
              <span className={styles.language}>{segment.language || 'plaintext'}</span>
              <button 
                className={styles.copyButton}
                onClick={() => handleCopyCode(segment.content, segmentId)}
              >
                {isCopied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
                      <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
                    </svg> Copied!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
                      <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path>
                      <path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path>
                    </svg> Copy
                  </>
                )}
              </button>
            </div>
            {/* Render raw text inside pre/code */}
            <pre className={styles.pre}>
              <code>{segment.content || ''}</code>
            </pre>
          </div>
        );
      }
      
      // Regular code blocks with syntax highlighting
      return (
        <div key={index} className={`${styles.codeBlockContainer} ${cssClass}`}>
          <div className={styles.codeHeader}>
            <span className={styles.language}>{segment.language || 'code'}</span>
            <button 
              className={styles.copyButton}
              onClick={() => handleCopyCode(segment.content, segmentId)}
            >
              {isCopied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
                    <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
                  </svg> Copied!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
                    <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path>
                    <path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path>
                  </svg> Copy
                </>
              )}
            </button>
          </div>
          <SyntaxHighlighter
            language={segment.language}
            style={syntaxTheme}
            className={styles.pre} // Use className for styling container
            wrapLines={true}
            PreTag="div" // Use div instead of pre, SyntaxHighlighter wraps in its own pre
          >
            {segment.content || ''}
          </SyntaxHighlighter>
        </div>
      );
    } catch (error) {
      console.error("Error rendering code block:", error);
      // Fallback for code block error
      return <div key={index} className={styles.codeBlockContainer}><pre>{segment.content || ''}</pre></div>;
    }
  };
  
  // Render the component with optimization to reduce layout shifts
  return (
    <div className={`${styles.markdown} ${styles.streamingContent} ${isWaitingForResponse ? styles.streaming : ''}`}>
      {parsedSegments && parsedSegments.map((segment, index) => 
        segment && segment.type === 'text' 
          ? renderTextSegment(segment.content, index)
          : renderCodeBlock(segment, index)
      )}
    </div>
  );
};

StreamingMessage.propTypes = {
  content: PropTypes.string.isRequired
};

export default StreamingMessage; 