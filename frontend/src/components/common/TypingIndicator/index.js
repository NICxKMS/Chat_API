import React from 'react';
import PropTypes from 'prop-types';
import { memo } from 'react';
import styles from './TypingIndicator.module.css';

/**
 * Animated dots to indicate that the AI is typing
 * @returns {JSX.Element} - Rendered component
 */
const TypingIndicator = memo(() => {
  return (
    <div className={styles.TypingIndicator} aria-label="AI is typing">
      <div className={styles.TypingIndicator__dot}></div>
      <div className={styles.TypingIndicator__dot}></div>
      <div className={styles.TypingIndicator__dot}></div>
    </div>
  );
});

// Display name for debugging
TypingIndicator.displayName = 'TypingIndicator';

TypingIndicator.propTypes = {
  isVisible: PropTypes.bool.isRequired
};

export default TypingIndicator; 