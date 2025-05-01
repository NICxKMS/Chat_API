import React, { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './TextAreaControl.module.css';
import commonStyles from '../common/ControlStyles.module.css';

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
 * @returns {JSX.Element} Rendered component
 */
const TextAreaControl = ({ 
  id, 
  label, 
  value, 
  onChange, 
  tooltip, 
  placeholder = 'Enter text here...'
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
    <div className={commonStyles.controlContainer}>
      <div className={commonStyles.controlHeader}>
        <label htmlFor={id} className={commonStyles.controlLabel} title={tooltip}>
          {label}
        </label>
      </div>
      
      <textarea
        id={id}
        className={styles.TextAreaControl__textarea}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={label}
      />
      
      {tooltip && (
        <div className={commonStyles.controlDescription}>
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
  placeholder: PropTypes.string
};

export default TextAreaControl; 