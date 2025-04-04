import React, { memo, useMemo, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../../../contexts/ThemeContext';
import styles from './ChatMessage.module.css';
import { PersonIcon, CopilotIcon, GearIcon, AlertIcon, CopyIcon } from '@primer/octicons-react';

// Lazy load SyntaxHighlighter and styles
const LazySyntaxHighlighter = lazy(() => 
  import('react-syntax-highlighter').then(module => ({ default: module.Prism }))
);
const lazyLoadStyle = (isDark) => 
  lazy(() => 
    isDark 
      ? import('react-syntax-highlighter/dist/esm/styles/prism/atom-dark') 
      : import('react-syntax-highlighter/dist/esm/styles/prism/prism')
  );

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
              <LazySyntaxHighlighter
                style={style}
                language={language}
                PreTag="pre"
                className={styles.pre}
                wrapLines={true}
                {...props}
              >
                {codeString}
              </LazySyntaxHighlighter>
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
 * Individual chat message component
 */
const ChatMessage = memo(({ role, content, metrics }) => {
  const messageClass = useMemo(() => {
    const baseClass = styles.message;
    
    let roleClass = '';
    switch (role) {
      case 'user': roleClass = styles.userMessage; break;
      case 'assistant': roleClass = styles.assistantMessage; break;
      case 'system': roleClass = styles.systemMessage; break;
      case 'error': roleClass = styles.errorMessage; break;
      default: break;
    }
    return `${baseClass} ${roleClass}`.trim();
  }, [role]);
  
  // Components map for react-markdown
  const markdownComponents = useMemo(() => ({ 
    code: CodeBlock, // Use our custom CodeBlock component
    // Customize other elements like p, a, etc. if needed
    // p: ({node, ...props}) => <p className={styles.paragraph} {...props} />,
    // a: ({node, ...props}) => <a className={styles.link} target="_blank" rel="noopener noreferrer" {...props} />,
  }), []);

  return (
    <div 
      className={messageClass} // Apply combined classes here
      data-role={role}
    >
      <div className={styles.avatar}>
        {getAvatarIcon(role)}
      </div>
      
      <div className={styles.messageContentWrapper}>
        <div className={styles.messageContent}>
          <ReactMarkdown
            children={content || ''} 
            remarkPlugins={[remarkGfm]} // Enable GitHub Flavored Markdown
            components={markdownComponents}
            // Disallow dangerous HTML - rely on markdown components
            disallowedElements={['script', 'style']}
            unwrapDisallowed={true}
          />
        </div>
        
        {/* Per-Response Metrics - only show if assistant and metrics exist */}
        {role === 'assistant' && metrics && (
          <div className={styles.metricsContainer}>
             <span>⏱️ {metrics.time?.toFixed(2)}s</span> |
             <span>#️⃣ {metrics.tokens}</span> |
             <span>⚡ {metrics.tps?.toFixed(1)} TPS</span>
          </div>
        )}
      </div>

    </div>
  );
});
ChatMessage.displayName = 'ChatMessage';
ChatMessage.propTypes = {
  role: PropTypes.oneOf(['user', 'assistant', 'system', 'error']).isRequired,
  content: PropTypes.string,
  metrics: PropTypes.shape({ 
    time: PropTypes.number,
    tokens: PropTypes.number,
    tps: PropTypes.number,
  }),
};

/**
 * Get avatar icon based on role
 * @param {string} role - Message role
 * @returns {JSX.Element} - Avatar SVG icon
 */
const getAvatarIcon = (role) => {
  const iconProps = { size: 20, className: styles.avatarIcon };
  switch (role) {
    case 'user': return <PersonIcon {...iconProps} />;
    case 'assistant': return <CopilotIcon {...iconProps} />;
    case 'system': return <GearIcon {...iconProps} />;
    case 'error': return <AlertIcon {...iconProps} />;
    default: return null;
  }
};

export default ChatMessage; 