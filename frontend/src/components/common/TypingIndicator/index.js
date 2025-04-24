import { memo } from 'react';
import styles from './TypingIndicator.module.css';

/**
 * Animated dots to indicate that the AI is typing
 * @returns {JSX.Element} - Rendered component
 */
const TypingIndicator = memo(() => {
  return (
    <div className={styles.typingIndicator} aria-label="AI is typing">
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
    </div>
  );
});

// Display name for debugging
TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator; 