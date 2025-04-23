import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './ModelCategory.module.css';
import ModelItem from '../ModelItem';

// --- Sub-component for Type Group (e.g., GPT 4, Flash) ---
const TypeGroup = ({ typeGroupName, models, onSelectModel, selectedModelId, searchTerm, showExperimental }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);
  const modelCount = models.length;

  if (modelCount === 0) return null;

  const typeGroupId = typeGroupName.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className={styles.typeGroup}>
      <div
        className={styles.typeGroupHeader} // Use distinct style if needed
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`type-content-${typeGroupId}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(); }}
      >
        <h6 className={styles.typeGroupName}>
          {typeGroupName}
          <span className={styles.modelCount}>{modelCount}</span>
        </h6>
        <button 
          className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''}`}
          aria-label={isExpanded ? `Collapse ${typeGroupName}` : `Expand ${typeGroupName}`}
          aria-hidden="true"
          tabIndex={-1}
        >
          {/* Re-using the same SVG arrow */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.expandIcon} aria-hidden="true">
            <path d="M6 9L2 5h8L6 9z" fill="currentColor" />
          </svg>
        </button>
      </div>
      {isExpanded && (
        <div id={`type-content-${typeGroupId}`} className={styles.modelsList}>
          {models.map(model => (
            <ModelItem
              key={model.id}
              model={model}
              selected={model.id === selectedModelId}
              onClick={() => onSelectModel(model)}
              searchTerm={searchTerm}
              showExperimental={showExperimental}
            />
          ))}
        </div>
      )}
    </div>
  );
};

TypeGroup.propTypes = {
  typeGroupName: PropTypes.string.isRequired,
  models: PropTypes.array.isRequired,
  onSelectModel: PropTypes.func.isRequired,
  selectedModelId: PropTypes.string,
  searchTerm: PropTypes.string,
  showExperimental: PropTypes.bool
};

// --- Sub-component for Provider Group (e.g., openai, gemini) ---
const ProviderGroup = ({ providerName, typeGroups, onSelectModel, selectedModelId, searchTerm, showExperimental }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

  // Calculate total model count for this provider
  const totalModelsInProvider = typeGroups.reduce((count, group) => count + group.models.length, 0);
  if (totalModelsInProvider === 0) return null;

  // Don't sort type groups, use them in the order they're received
  let sortedTypeGroups = [...typeGroups];

  const providerGroupId = providerName.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className={styles.providerGroup}>
       <div
          className={styles.providerHeader}
          onClick={toggleExpanded}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-controls={`provider-content-${providerGroupId}`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(); }}
       >
         <h5 className={styles.providerName}>
           {providerName}
           <span className={styles.modelCount}>{totalModelsInProvider}</span>
         </h5>
          <button 
             className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''}`}
             aria-label={isExpanded ? `Collapse ${providerName}` : `Expand ${providerName}`}
             aria-hidden="true"
             tabIndex={-1}
          >
             {/* Re-using the same SVG arrow */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.expandIcon} aria-hidden="true">
               <path d="M6 9L2 5h8L6 9z" fill="currentColor" />
            </svg>
          </button>
       </div>
      {isExpanded && (
        <div id={`provider-content-${providerGroupId}`} className={styles.providerContent}>
          {sortedTypeGroups.map(({ typeGroupName, models }) => (
            <TypeGroup
              key={typeGroupName}
              typeGroupName={typeGroupName}
              models={models}
              onSelectModel={onSelectModel}
              selectedModelId={selectedModelId}
              searchTerm={searchTerm}
              showExperimental={showExperimental}
            />
          ))}
        </div>
      )}
    </div>
  );
};

ProviderGroup.propTypes = {
  providerName: PropTypes.string.isRequired,
  typeGroups: PropTypes.array.isRequired, // Array content checked by TypeGroup's props
  onSelectModel: PropTypes.func.isRequired,
  selectedModelId: PropTypes.string,
  searchTerm: PropTypes.string,
  showExperimental: PropTypes.bool
};


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
  providers, 
  onSelectModel, 
  selectedModelId, 
  searchTerm, 
  showExperimental 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);
  
  // Calculate total model count for this category
  const totalModelsInCategory = providers.reduce((count, provider) => 
    provider.typeGroups.reduce((groupCount, group) => groupCount + group.models.length, count)
  , 0);

  if (totalModelsInCategory === 0) {
    return null;
  }

  const categoryId = categoryName.replace(/\s+/g, '-').toLowerCase();
  
  return (
    <div className={styles.category}>
      {/* Category Header - Remains collapsible */}
      <div 
        className={styles.categoryHeader}
        onClick={toggleExpanded}
        role="button" 
        tabIndex={0} 
        aria-expanded={isExpanded}
        aria-controls={`category-content-${categoryId}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(); }} 
      >
        <h4 className={styles.categoryName}>
          {categoryName}
          <span className={styles.modelCount}>{totalModelsInCategory}</span>
        </h4>
        <button 
          className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''}`}
          aria-label={isExpanded ? `Collapse ${categoryName}` : `Expand ${categoryName}`}
          aria-hidden="true" 
          tabIndex={-1} 
        >
          {/* SVG Icon */} 
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.expandIcon} aria-hidden="true">
            <path d="M6 9L2 5h8L6 9z" fill="currentColor" />
          </svg>
        </button>
      </div>
      
      {/* Category Content - Render ProviderGroup components */}
      {isExpanded && (
        <div 
           id={`category-content-${categoryId}`} 
           className={styles.categoryContent}
        >
          {providers.map(({ providerName, typeGroups }) => (
            // Use the new ProviderGroup component here
            <ProviderGroup
               key={providerName}
               providerName={providerName}
               typeGroups={typeGroups} // Pass the unsorted groups; sorting happens inside ProviderGroup
               onSelectModel={onSelectModel}
               selectedModelId={selectedModelId}
               searchTerm={searchTerm}
               showExperimental={showExperimental}
            />
          ))}
        </div>
      )}
    </div>
  );
};

ModelCategory.propTypes = {
  // Props remain the same as ProviderGroup now handles the inner details
  categoryName: PropTypes.string.isRequired,
  providers: PropTypes.arrayOf(PropTypes.shape({
    providerName: PropTypes.string.isRequired,
    typeGroups: PropTypes.array.isRequired // Further validation done by sub-components
  })).isRequired,
  onSelectModel: PropTypes.func.isRequired,
  selectedModelId: PropTypes.string,
  searchTerm: PropTypes.string,
  showExperimental: PropTypes.bool
};

export default ModelCategory; 