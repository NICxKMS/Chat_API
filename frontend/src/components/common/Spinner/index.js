import React from 'react';
import styles from './Spinner.module.css';

/**
 * Loading spinner component with multiple sizes
 * @param {Object} props - Component props
 * @param {string} [props.size='medium'] - Size of spinner (small, medium, large)
 * @param {string} [props.color] - Optional custom color
 * @returns {JSX.Element} - Rendered spinner
 */
const Spinner = ({ size = 'medium', color }) => {
  // Map prop size to the correct BEM class name
  const sizeClassMap = {
    small: styles['Spinner--small'],
    medium: styles['Spinner--medium'],
    large: styles['Spinner--large']
  };
  const sizeClass = sizeClassMap[size] || styles['Spinner--medium']; // Default to medium
  
  const spinnerStyle = color ? { borderTopColor: color } : {};
  
  return (
    <div className={`${styles.Spinner} ${sizeClass}`}>
      <div 
        className={styles.Spinner__loader} 
        style={spinnerStyle}
        aria-label="Loading"
        role="status"
      />
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(Spinner); 