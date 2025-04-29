import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './SettingsSelect.module.css';
import '../../../styles/common/utilities.css';

const SettingsSelect = ({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  tooltip
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);

  // Find the selected option display text
  const selectedOption = options.find(option => option.value === value);
  const displayText = selectedOption ? selectedOption.label : '';
  
  // Generate a unique ID for the label to use with aria-labelledby
  const labelId = `${id}-label`;
  
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen(open => !open);
    }
  }, [disabled]);

  const handleOptionSelect = useCallback((optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  }, [onChange]);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        toggleDropdown();
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        if (isOpen) {
          e.preventDefault();
          const currentIndex = options.findIndex(opt => opt.value === value);
          const nextIndex = (currentIndex + 1) % options.length;
          onChange(options[nextIndex].value);
        }
        break;
      case 'ArrowUp':
        if (isOpen) {
          e.preventDefault();
          const currentIndex = options.findIndex(opt => opt.value === value);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
          onChange(options[prevIndex].value);
        }
        break;
      default:
        break;
    }
  }, [disabled, isOpen, options, value, toggleDropdown, onChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        selectRef.current && 
        !selectRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Memoize the rendered options list
  const renderedOptions = useMemo(() => options.map(option => (
    <div 
      key={option.value}
      className={`${styles.option} ${option.value === value ? styles.selected : ''}`}
      onClick={() => handleOptionSelect(option.value)}
      role="option"
      aria-selected={option.value === value}
    >
      {option.label}
    </div>
  )), [options, value, handleOptionSelect]);

  return (
    <div className={`${styles.SettingsSelect} ${disabled ? styles['SettingsSelect--disabled'] : ''}`}>
      <label 
        htmlFor={id} 
        className={styles.SettingsSelect__label}
        title={tooltip || ''}
        id={labelId}
      >
        {label}
      </label>
      
      <div 
        ref={selectRef}
        className={`${styles.SettingsSelect__select} ${isOpen ? styles['SettingsSelect--open'] : ''} ${styles.selectElement}`}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        aria-labelledby={labelId}
        id={id}
      >
        <div className={styles.SettingsSelect__selectedValue}>
          {displayText}
        </div>
        <div className={`${styles.SettingsSelect__arrow} ${styles.selectIcon}`} />
      </div>
      
      {isOpen && !disabled && (
        <div 
          ref={dropdownRef}
          className={`${styles.SettingsSelect__dropdown} animation-fade-in`}
          role="listbox"
          id={`${id}-listbox`}
          aria-labelledby={id}
        >
          {renderedOptions.map(option => (
            <div
              key={option.key}
              className={`${styles.SettingsSelect__option} ${option.key === value ? styles['SettingsSelect__option--selected'] : ''}`}
              onClick={() => handleOptionSelect(option.key)}
              role="option"
              aria-selected={option.key === value}
            >
              {option.props.children}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

SettingsSelect.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]).isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
      ]).isRequired,
      label: PropTypes.string.isRequired
    })
  ).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  tooltip: PropTypes.string
};

export default SettingsSelect; 