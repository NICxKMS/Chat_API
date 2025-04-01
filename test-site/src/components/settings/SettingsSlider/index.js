import React, { memo, useState, useRef, useEffect } from 'react';
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
  tooltip
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);
  
  // Calculate percentage for slider fill
  const percentage = ((value - min) / (max - min)) * 100;
  
  // Format displayed value
  const displayValue = Number(value).toFixed(step < 1 ? 1 : 0);
  
  // Position tooltip away from cursor when hovered
  useEffect(() => {
    const handleTooltipPosition = (e) => {
      if (tooltipRef.current && showTooltip) {
        tooltipRef.current.style.left = `${e.clientX + 15}px`;
        tooltipRef.current.style.top = `${e.clientY - 30}px`;
      }
    };
    
    if (showTooltip) {
      document.addEventListener('mousemove', handleTooltipPosition);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleTooltipPosition);
    };
  }, [showTooltip]);
  
  // Handle slider change
  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };
  
  return (
    <div className={`${styles.sliderContainer} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.labelContainer}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <span className={styles.value}>{displayValue}</span>
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
          onChange={handleChange}
          disabled={disabled}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label}
        />
      </div>
      
      {/* Tooltip */}
      {tooltip && showTooltip && (
        <div className={styles.tooltip} ref={tooltipRef}>
          {tooltip}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
SettingsSlider.displayName = 'SettingsSlider';

export default SettingsSlider; 