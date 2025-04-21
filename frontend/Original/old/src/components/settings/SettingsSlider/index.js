import { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { InfoIcon } from '../icons';
import styles from './SettingsSlider.module.css';

/**
 * Slider control for numeric settings
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the slider
 * @param {string} props.label - Label text
 * @param {number} props.value - Current value
 * @param {number} props.min - Minimum value
 * @param {number} props.max - Maximum value
 * @param {number} props.step - Step size
 * @param {Function} props.onChange - Change handler function
 * @param {boolean} [props.disabled=false] - Whether the slider is disabled
 * @param {string} [props.tooltip] - Tooltip text
 * @param {string} [props.size='medium'] - Size variant ('small', 'medium', or 'large')
 * @param {boolean} [props.allowDirectInput=false] - Whether to show a number input field
 * @returns {JSX.Element} - Rendered component
 */
const SettingsSlider = memo(({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  tooltip,
  size = 'medium',
  allowDirectInput = false
}) => {
  // Add local state for input field
  const [inputValue, setInputValue] = useState(value.toString());
  
  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);
  
  // Calculate percentage for slider fill
  const percentage = ((value - min) / (max - min)) * 100;
  
  // Format displayed value based on step size
  const displayValue = Number(value).toFixed(step < 1 ? 2 : 0);
  
  // Apply size modifier CSS class
  const sizeClass = size === 'small' 
    ? styles.small 
    : size === 'large' 
      ? styles.large 
      : '';
  
  // Handle slider change
  const handleSliderChange = e => {
    if (!disabled) onChange(parseFloat(e.target.value));
  };
  
  // Handle input field change
  const handleInputChange = e => {
    setInputValue(e.target.value);
  };
  
  // Handle input field blur (commit value)
  const handleInputBlur = () => {
    if (disabled) return;
    
    // Parse and validate input
    let newValue = parseFloat(inputValue);
    
    // Handle NaN and enforce min/max bounds
    if (isNaN(newValue)) {
      setInputValue(value.toString());
      return;
    }
    
    // Enforce min/max bounds
    newValue = Math.max(min, Math.min(max, newValue));
    
    // Update the value and input field
    onChange(newValue);
    setInputValue(newValue.toString());
  };
  
  // Handle input field key press
  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      e.target.blur(); // Trigger blur to commit the value
    }
  };
  
  return (
    <div className={`${styles.sliderContainer} ${disabled ? styles.disabled : ''} ${sizeClass}`}>
      <div className={styles.labelContainer}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {tooltip && (
            <span className={styles.tooltipWrapper}>
              <InfoIcon className={styles.infoIcon} />
              <span className={styles.tooltip}>{tooltip}</span>
            </span>
          )}
        </label>
        
        {allowDirectInput ? (
          <input
            type="number"
            className={styles.numberInput}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={`${label} value`}
          />
        ) : (
          <span className={styles.value}>{displayValue}</span>
        )}
      </div>
      
      <div className={styles.sliderTrack}>
        <div 
          className={styles.sliderFill} 
          style={{ width: `${percentage}%` }}
        />
        
        <input
          id={id}
          type="range"
          className={styles.slider}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label}
        />
      </div>
    </div>
  );
});

SettingsSlider.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  tooltip: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  allowDirectInput: PropTypes.bool
};

// Display name for debugging
SettingsSlider.displayName = 'SettingsSlider';

export default SettingsSlider; 