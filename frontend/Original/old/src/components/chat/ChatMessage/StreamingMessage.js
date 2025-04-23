import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import styles from './ChatMessage.module.css';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../../contexts/ThemeContext';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { convertTeXToMathDollars } from '../../../utils/formatters';

// Copy Icon SVG (simple inline version)
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
    <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path>
    <path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path>
  </svg>
);

// Check Icon SVG (simple inline version)
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
    <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
  </svg>
);

/**
 * StreamingMessage component using react-markdown for rendering the entire content.
 */
const StreamingMessage = ({ content, isStreaming }) => {
  const { isDark } = useTheme();
  const [copiedCodeMap, setCopiedCodeMap] = useState({}); // Use a map for multiple blocks

  const syntaxTheme = isDark ? atomDark : prism;

  // Handle copy code to clipboard, using index as key
  const handleCopyCode = useCallback((code, index) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCodeMap(prev => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopiedCodeMap(prev => ({ ...prev, [index]: false }));
      }, 2000);
    });
  }, []);

  // Custom component for rendering code blocks
  const CodeBlock = useCallback(({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'plaintext'; // Default to plaintext if no language class
    const codeContent = String(children).replace(/\n$/, ''); // Get code content

    // Use index from node's position if available, fallback to content hash or similar
    // Note: Relying on node properties might be unstable depending on markdown parser versions.
    // A more robust key might involve hashing the codeContent + language.
    // For simplicity, we'll use a basic key generation strategy.
    const codeBlockKey = node?.position?.start?.offset ?? codeContent.substring(0, 20); // Example key
    const isCopied = copiedCodeMap[codeBlockKey];

    return !inline ? (
      <div className={styles.codeBlockContainer}>
        <div className={styles.codeHeader}>
          <span className={styles.language}>{language}</span>
          <button
            className={styles.copyButton}
            onClick={() => handleCopyCode(codeContent, codeBlockKey)}
            disabled={isCopied}
          >
            {isCopied ? (
              <> <CheckIcon /> Copied! </>
            ) : (
              <> <CopyIcon /> Copy </>
            )}
          </button>
        </div>
        <SyntaxHighlighter
          style={syntaxTheme}
          language={language}
          PreTag="div" // Use div instead of pre, SyntaxHighlighter wraps in its own pre
          className={styles.pre}
          wrapLines={true} // Consider wrapping lines based on preference
          {...props}
        >
          {codeContent}
        </SyntaxHighlighter>
      </div>
    ) : (
      // Render inline code with specific styling
      <code className={`${styles.inlineCode} ${className || ''}`} {...props}>
        {children}
      </code>
    );
  }, [syntaxTheme, handleCopyCode, copiedCodeMap]); // Added dependencies

  // Define components for ReactMarkdown
  const markdownComponents = useMemo(() => ({
    code: CodeBlock,
    // Potentially add customizations for other elements like 'a', 'img', 'table' if needed
  }), [CodeBlock]); // CodeBlock is the dependency

  // Apply streaming class based on the passed-in prop
  const markdownClassName = `${styles.markdown} ${styles.streamingContent} ${isStreaming ? styles.streaming : ''}`;

  // Use a zero-width space for this purpose.
  const actualContent = typeof content === 'string' ? content : String(content || '');
  const contentToRender = !actualContent ? '\u200B' : convertTeXToMathDollars(actualContent);

  return (
    <div className={markdownClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={markdownComponents}
        skipHtml={false}
      >
        {contentToRender}
      </ReactMarkdown>
    </div>
  );
};

StreamingMessage.propTypes = {
  content: PropTypes.string,
  isStreaming: PropTypes.bool // Add prop type for isStreaming
};

export default StreamingMessage; 