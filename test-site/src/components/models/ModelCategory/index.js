import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import ModelItem from '../ModelItem';
import styles from './ModelCategory.module.css';

/**
 * Component for displaying a category group (Chat, Image, Embedding)
 * Contains nested providers and their models.
 * @param {Object} props - Component props
 * @param {string} props.categoryName - Name of the category (e.g., "Chat")
 * @param {Array} props.providers - Array of provider objects for this category
 * @param {Function} props.onSelectModel - Function to handle model selection
 * @param {string} props.selectedModelId - ID of the currently selected model
 * @param {string} props.searchTerm - Current search term (used by ModelItem)
 * @param {boolean} props.showExperimental - Whether experimental models are shown (used by ModelItem)
 * @returns {JSX.Element|null} - Rendered component or null if category is empty
 */
const ModelCategory = ({ 
  categoryName, 
  providers, // Changed from category object to providers array
  onSelectModel, 
  selectedModelId, 
  searchTerm, // Keep for ModelItem
  showExperimental // Keep for ModelItem
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  // Calculate total model count for this category (already filtered in parent)
  const totalModelsInCategory = providers.reduce((count, provider) => 
    provider.typeGroups.reduce((groupCount, group) => groupCount + group.models.length, count)
  , 0);

  // If no models in this category after filtering in parent, don't render
  if (totalModelsInCategory === 0) {
    return null;
  }
  
  return (
    <div className={styles.category}>
      {/* Category Header */}
      <div 
        className={styles.categoryHeader}
        onClick={toggleExpanded}
        role="button" // Add role for accessibility
        tabIndex={0} // Add tabIndex for accessibility
        aria-expanded={isExpanded}
        aria-controls={`category-content-${categoryName.toLowerCase()}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(); }} // Keyboard accessibility
      >
        <h4 className={styles.categoryName}>
          {categoryName}
          <span className={styles.modelCount}>
            {/* Display total count for the category */}
            {totalModelsInCategory}
          </span>
        </h4>
        
        <button 
          className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''}`}
          aria-label={isExpanded ? `Collapse ${categoryName}` : `Expand ${categoryName}`}
          aria-hidden="true" // Hide from screen readers as header is controllable
          tabIndex={-1} // Remove from tab order
        >
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 12 12" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={styles.expandIcon}
            aria-hidden="true"
          >
            <path 
              d="M6 9L2 5h8L6 9z" 
              fill="currentColor" 
            />
          </svg>
        </button>
      </div>
      
      {/* Category Content (Providers -> Type Groups -> Models) */}
      {isExpanded && (
        <div 
           id={`category-content-${categoryName.toLowerCase()}`} 
           className={styles.categoryContent}
        >
          {providers.map(({ providerName, typeGroups }) => (
            <div key={providerName} className={styles.providerGroup}>
              <h5 className={styles.providerName}>{providerName}</h5>
              {typeGroups.map(({ typeGroupName, models }) => (
                <div key={`${providerName}-${typeGroupName}`} className={styles.typeGroup}>
                   {/* Optionally display typeGroupName if needed, or just list models */}
                   <h6 className={styles.typeGroupName}>{typeGroupName}</h6> 
                   <div className={styles.modelsList}>
                     {models.map(model => (
                       <ModelItem
                         key={model.id}
                         model={model}
                         isSelected={model.id === selectedModelId}
                         onSelect={() => onSelectModel(model)}
                         // Pass search term and experimental flag down to ModelItem for highlighting/display logic
                         searchTerm={searchTerm}
                         showExperimental={showExperimental}
                       />
                     ))}
                   </div>
                 </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

ModelCategory.propTypes = {
  // Updated prop types
  categoryName: PropTypes.string.isRequired,
  providers: PropTypes.arrayOf(PropTypes.shape({
    providerName: PropTypes.string.isRequired,
    typeGroups: PropTypes.arrayOf(PropTypes.shape({
      typeGroupName: PropTypes.string.isRequired,
      models: PropTypes.array.isRequired
    })).isRequired
  })).isRequired,
  onSelectModel: PropTypes.func.isRequired,
  selectedModelId: PropTypes.string,
  searchTerm: PropTypes.string,
  showExperimental: PropTypes.bool
};

export default ModelCategory; 