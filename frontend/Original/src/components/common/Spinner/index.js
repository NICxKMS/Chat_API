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
  const sizeClass = styles[size] || styles.medium;
  
  const spinnerStyle = color ? { borderTopColor: color } : {};
  
  return (
    <div className={`${styles.spinnerContainer} ${sizeClass}`}>
      <div 
        className={styles.spinner} 
        style={spinnerStyle}
        aria-label="Loading"
        role="status"
      />
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(Spinner); 