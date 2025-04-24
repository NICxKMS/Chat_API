import React, { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './TextAreaControl.module.css';

/**
 * TextArea control component for settings
 * 
 * @param {Object} props Component props
 * @param {string} props.id Unique identifier
 * @param {string} props.label Label text
 * @param {string} props.value Current value
 * @param {Function} props.onChange Change handler
 * @param {string} props.tooltip Tooltip text
 * @param {string} props.placeholder Placeholder text
 * @param {number} props.rows Number of rows for the textarea
 * @returns {JSX.Element} Rendered component
 */
const TextAreaControl = ({ 
  id, 
  label, 
  value, 
  onChange, 
  tooltip, 
  placeholder = 'Enter text here...', 
  rows = 4 
}) => {
  const [localValue, setLocalValue] = useState(value);
  
  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };
  
  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleBlur();
    }
  };
  
  return (
    <div className={styles.textAreaControl}>
      <div className={styles.header}>
        <label htmlFor={id} className={styles.label} title={tooltip}>
          {label}
        </label>
      </div>
      
      <textarea
        id={id}
        className={styles.textarea}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        aria-label={label}
      />
      
      {tooltip && (
        <div className={styles.description}>
          {tooltip}
        </div>
      )}
    </div>
  );
};

TextAreaControl.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  tooltip: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.number
};

export default TextAreaControl; 