import React, { useState, useCallback, useMemo, lazy, Suspense, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ChatMessage.module.css';
import { useTheme } from '../../../contexts/ThemeContext';
import { convertTeXToMathDollars } from '../../../utils/formatters';

// Track registered Prism languages for on-demand lazy loading (all languages supported)
const registeredLanguages = new Set();

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

// Dynamically load PrismLight component
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter/dist/esm/prism-light').then(mod => ({ default: mod }))
);

// Dynamically load ReactMarkdown and its plugins for streaming
const StreamingMarkdown = lazy(async () => {
  const [rmMod, gfmMod, emojiMod, mathMod, rehypeMod] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
    import('remark-emoji'),
    import('remark-math'),
    import('rehype-katex'),
    import('katex/dist/katex.min.css'),
  ]);
  return {
    default: ({ children, components }) => (
      <rmMod.default
        remarkPlugins={[
          gfmMod.default || gfmMod,
          emojiMod.default || emojiMod,
          mathMod.default || mathMod
        ]}
        rehypePlugins={[rehypeMod.default || rehypeMod]}
        components={components}
      >
        {children}
      </rmMod.default>
    ),
  };
});

// Preload highlighter, theme, and markdown modules during idle time if not yet loaded
if (typeof window !== 'undefined') {
  const idleCallback = window.requestIdleCallback || (cb => setTimeout(cb, 2000));
  idleCallback(() => {
    import('react-syntax-highlighter');
    import('react-syntax-highlighter/dist/esm/styles/prism/atom-dark');
    import('react-syntax-highlighter/dist/esm/styles/prism/prism');
    import('react-markdown');
    import('remark-gfm');
    import('remark-emoji');
    import('remark-math');
    import('rehype-katex');
    import('katex/dist/katex.min.css');
  });
}

/**
 * StreamingMessage component using react-markdown for rendering the entire content.
 */
const StreamingMessage = ({ content, isStreaming }) => {
  const { isDark } = useTheme();
  const [copiedCodeMap, setCopiedCodeMap] = useState({}); // Use a map for multiple blocks
  // Dynamically load theme style based on current theme
  const [syntaxTheme, setSyntaxTheme] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const mod = await import(
          isDark
            ? 'react-syntax-highlighter/dist/esm/styles/prism/atom-dark'
            : 'react-syntax-highlighter/dist/esm/styles/prism/prism'
        );
        setSyntaxTheme(mod.default || mod);
      } catch (e) {
        console.warn('Failed to load syntax theme', e);
      }
    })();
  }, [isDark]);

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
    // Only treat content wrapped in triple backticks as code blocks (ignore indents)
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'plaintext'; // Default to plaintext if no language class
    // Lazy-load Prism language definition on demand
    if (language && !registeredLanguages.has(language)) {
      import(
        /* webpackChunkName: "prism-language-[request]" */
        `react-syntax-highlighter/dist/esm/languages/prism/${language}.js`
      )
        .then(mod => {
          SyntaxHighlighter.registerLanguage(language, mod.default || mod);
          registeredLanguages.add(language);
        })
        .catch(err => {
          console.warn(`Unable to load syntax highlighter language: ${language}`, err);
        });
    }
    const codeContent = String(children).replace(/\n$/, ''); // Get code content

    // Use index from node's position if available, fallback to content hash or similar
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
        <Suspense fallback={<pre className={styles.pre}>{codeContent}</pre>}>
          {syntaxTheme ? (
            <SyntaxHighlighter
              style={syntaxTheme}
              customStyle={{ background: 'transparent' }}
              language={language}
              PreTag="div" // Use div instead of pre, SyntaxHighlighter wraps in its own pre
              className={styles.pre}
              wrapLines={true} // Consider wrapping lines based on preference
              {...props}
            >
              {codeContent}
            </SyntaxHighlighter>
          ) : (
            <pre className={styles.pre}>{codeContent}</pre>
          )}
        </Suspense>
      </div>
    ) : (
      // Render inline code with specific styling
      <code className={`${styles.inlineCode} ${className || ''}`} {...props}>
        {children}
      </code>
    );
  }, [syntaxTheme, handleCopyCode, copiedCodeMap]);

  // Define components for ReactMarkdown
  const markdownComponents = useMemo(() => ({
    code: CodeBlock,
  }), [CodeBlock]); // CodeBlock is the dependency

  // Apply streaming class based on the passed-in prop
  const markdownClassName = `${styles.markdown} ${styles.ChatMessage__streamingContent} ${isStreaming ? styles['ChatMessage__streamingContent--streaming'] : ''}`;

  // Use a zero-width space for this purpose.
  const actualContent = typeof content === 'string' ? content : String(content || '');
  const contentToRender = !actualContent ? '\u200B' : convertTeXToMathDollars(actualContent);

  return (
    <div className={markdownClassName}>
      <Suspense fallback={<div>{contentToRender}</div>}>
        <StreamingMarkdown components={markdownComponents}>
          {contentToRender}
        </StreamingMarkdown>
      </Suspense>
    </div>
  );
};

StreamingMessage.propTypes = {
  content: PropTypes.string,
  isStreaming: PropTypes.bool // Add prop type for isStreaming
};

export default StreamingMessage;
