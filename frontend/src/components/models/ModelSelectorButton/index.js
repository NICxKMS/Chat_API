import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon } from '@primer/octicons-react';
import styles from './ModelSelectorButton.module.css';
import Spinner from '../../common/Spinner';

/**
 * Button to trigger the model selection UI (Dropdown/Modal)
 */
const ModelSelectorButton = ({ 
  selectedModelName = null, 
  providerName = null,
  onClick, 
  disabled = false 
}) => {
  // State to track window width for responsive text
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showProvider, setShowProvider] = useState(false);
  const buttonRef = useRef(null);
  const textRef = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(0);
  const [buttonSet, setButtonSet] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Update mobile state on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Measure button width once it's rendered with the model name
  useEffect(() => {
    if (buttonRef.current && selectedModelName && !buttonSet) {
      const width = buttonRef.current.offsetWidth;
      setButtonWidth(width);
      setButtonSet(true);
    }
  }, [selectedModelName, buttonSet]);
  
  // Apply width to button when width is determined
  useEffect(() => {
    if (buttonWidth > 0 && buttonRef.current) {
      buttonRef.current.style.width = `${buttonWidth+10}px`;
    }
  }, [buttonWidth]);
  
  // Animation to toggle between model and provider
  useEffect(() => {
    if (!selectedModelName || !providerName) return;
    
    const interval = setInterval(() => {
      setShowProvider(prev => !prev);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedModelName, providerName]);
  
  // Check if text is overflowing
  useEffect(() => {
    if (textRef.current) {
      const isOverflowing = textRef.current.scrollWidth > textRef.current.clientWidth;
      setHasOverflow(isOverflowing);
    }
  }, [showProvider, selectedModelName, providerName, isMobile]);
  
  // Format provider name to title case
  const getFormattedProvider = () => {
    if (!providerName) return '';
    
    return providerName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .replace(/Ai\b/g, 'AI');
  };
  
  // Get display text based on current state
  const displayText = () => {
    if (!selectedModelName) {
      return isMobile ? 'Select Model' : 'Select a Model';
    }
    
    if (!providerName || !showProvider) {
      return selectedModelName;
    } else {
      return getFormattedProvider();
    }
  };
  
  return (
    <button 
      ref={buttonRef}
      className={styles.ModelSelectorButton}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="true"
      aria-label={`Select Model (Current: ${selectedModelName || 'None'})`}
    >
      {disabled && !selectedModelName ? (
        <Spinner size="small" className={styles.ModelSelectorButton__spinner} />
      ) : (
        <div className={styles.ModelSelectorButton__innerContent}>
          <span 
            ref={textRef}
            className={`${styles.ModelSelectorButton__text} ${showProvider ? styles['ModelSelectorButton__text--showProvider'] : ''} ${hasOverflow && showProvider ? styles['ModelSelectorButton__text--scrollText'] : ''}`}
          >
            {displayText()}
          </span>
          <ChevronDownIcon size={16} className={styles.ModelSelectorButton__icon} />
        </div>
      )}
    </button>
  );
};

ModelSelectorButton.propTypes = {
  /** Currently selected model name to display */
  selectedModelName: PropTypes.string,
  /** Provider name of the selected model */
  providerName: PropTypes.string,
  /** Function to call when the button is clicked */
  onClick: PropTypes.func.isRequired,
  /** Whether the button should be disabled */
  disabled: PropTypes.bool,
};

export default ModelSelectorButton;