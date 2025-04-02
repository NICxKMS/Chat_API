import React, { memo } from 'react';
import PropTypes from 'prop-types';
import styles from './ModelItem.module.css';

/**
 * Component for displaying a single model
 * @param {Object} props - Component props
 * @param {Object} props.model - Model data
 * @param {boolean} props.selected - Whether the model is currently selected
 * @param {Function} props.onClick - Function to handle model selection
 * @param {string} props.searchTerm - Current search term for highlighting
 * @returns {JSX.Element} - Rendered component
 */
const ModelItem = memo(({ 
  model, 
  selected, 
  onClick,
  searchTerm
}) => {
  // Highlight matching text if searchTerm is provided
  const highlightMatch = (text) => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, i) => (
          regex.test(part) ? (
            <span key={i} className={styles.highlight}>{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        ))}
      </>
    );
  };
  
  return (
    <div 
      className={`${styles.modelItem} ${selected ? styles.selected : ''}`}
      onClick={() => onClick(model)}
      role="option"
      aria-selected={selected}
    >
      <div className={styles.modelIcon}>
        {model.series?.charAt(0) || model.name.charAt(0)}
      </div>
      
      <div className={styles.modelDetails}>
        <div className={styles.modelName}>
          {highlightMatch(model.name)}
        </div>
        
        {model.description && (
          <div className={styles.modelDescription}>
            {highlightMatch(model.description)}
          </div>
        )}
        
        {model.tags && model.tags.length > 0 && (
          <div className={styles.tags}>
            {model.tags.map(tag => (
              <span 
                key={tag} 
                className={styles.tag}
                style={{
                  backgroundColor: 
                    searchTerm && 
                    tag.toLowerCase().includes(searchTerm.toLowerCase()) 
                      ? 'rgba(var(--button-bg-rgb), 0.2)' 
                      : undefined
                }}
              >
                {highlightMatch(tag)}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {selected && (
        <div className={styles.selectedIndicator} data-testid="check-icon">
          <CheckIcon className={styles.checkIcon} />
        </div>
      )}
    </div>
  );
});

// SVG Check icon as a component
const CheckIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

ModelItem.propTypes = {
  model: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    series: PropTypes.string,
    providerName: PropTypes.string,
    typeGroupName: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string)
  }).isRequired,
  selected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  searchTerm: PropTypes.string
};

// Display name for debugging
ModelItem.displayName = 'ModelItem';

export default ModelItem; 