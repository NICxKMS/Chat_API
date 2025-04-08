import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatMessage.module.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../../contexts/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * StreamingMessage component using react-markdown for rendering
 */
const StreamingMessage = ({ content }) => {
  const [parsedSegments, setParsedSegments] = useState([]);
  const { isDark } = useTheme();
  
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
        const codeContent = match[2] || match[4] || ''; // Renamed to avoid confusion
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
  
  // Update segments whenever content changes
  useEffect(() => {
    if (!content) return;
    try {
      const segments = processStreamingContent(content);
      setParsedSegments(segments);
    } catch (error) {
      console.error("Error updating segments:", error);
      setParsedSegments([{ type: 'text', content }]);
    }
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
      
      // Special handling for "markdown" language blocks - render using ReactMarkdown
      if (segment.language === 'markdown') {
        return (
          <div key={index} className={`${styles.codeBlockContainer} ${cssClass}`}>
            <div className={styles.codeHeader}>
              <span className={styles.language}>markdown</span>
              {/* Add Copy button or other controls here if needed */}
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
            {/* Add Copy button or other controls here if needed */}
          </div>
          <SyntaxHighlighter
            language={segment.language}
            style={syntaxTheme}
            className={styles.pre} // Use className for styling container
            wrapLines={true}
            // Remove customStyle if .pre class handles it
            // customStyle={{ 
            //   margin: 0, 
            //   padding: '1rem', 
            //   background: 'var(--code-bg)',
            //   borderRadius: '0 0 6px 6px' 
            // }}
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
  
  // Render the component
  return (
    <div className={`${styles.markdown} ${styles.streamingContent}`}>
      {parsedSegments && parsedSegments.map((segment, index) => 
        segment && segment.type === 'text' 
          ? renderTextSegment(segment.content, index)
          : renderCodeBlock(segment, index)
      )}
      {/* Add loading indicator or cursor if needed */}
    </div>
  );
};

StreamingMessage.propTypes = {
  content: PropTypes.string.isRequired
};

export default StreamingMessage; 