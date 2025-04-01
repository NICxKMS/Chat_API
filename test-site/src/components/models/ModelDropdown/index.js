import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useModel } from '../../../contexts/ModelContext';
import ModelItem from '../ModelItem';
import ModelCategory from '../ModelCategory';
import ModelSearch from '../ModelSearch';
import styles from './ModelDropdown.module.css';

/**
 * Model selection dropdown component
 * @returns {JSX.Element} - Rendered component
 */
const ModelDropdown = () => {
  const { 
    processedModels, 
    selectedModel, 
    selectModel, 
    isExperimentalModelsEnabled,
    toggleExperimentalModels,
    modelFilter, 
    showExperimental,
    updateSearchFilter,
    isLoading
  } = useModel();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  
  // Toggle dropdown open/closed
  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
    
    // Clear search term when closing
    if (isOpen) {
      setSearchTerm('');
      updateSearchFilter('');
    }
  };
  
  // Handle selecting a model
  const handleSelectModel = useCallback((model) => {
    selectModel(model);
    setIsOpen(false);
    setSearchTerm('');
    updateSearchFilter('');
  }, [selectModel, updateSearchFilter]);
  
  // Handle search term change
  const handleSearchChange = useCallback((term) => {
    setSearchTerm(term);
    updateSearchFilter(term);
  }, [updateSearchFilter]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        if (isOpen) {
          setSearchTerm('');
          updateSearchFilter('');
        }
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, updateSearchFilter]);
  
  // --- Filtering Logic --- 
  const filteredAndCategorizedModels = useMemo(() => {
    if (isLoading || !processedModels) {
      return { categories: [], totalCount: 0 };
    }

    let totalCount = 0;
    const categories = Object.entries(processedModels)
      .map(([categoryName, providers]) => {
         // Filter providers within the category
         const filteredProviders = Object.entries(providers)
           .map(([providerName, typeGroups]) => {
              // Filter type groups within the provider
              const filteredTypeGroups = Object.entries(typeGroups)
                .map(([typeGroupName, models]) => {
                   // Filter models within the type group
                   const filteredModels = models.filter(model => {
                     // Experimental filter
                     if (model.is_experimental && !showExperimental) return false;
                     
                     // Search filter (apply to various fields)
                     if (searchTerm) {
                       const searchLower = searchTerm.toLowerCase();
                       return (
                         model.name.toLowerCase().includes(searchLower) ||
                         model.provider.toLowerCase().includes(searchLower) ||
                         (model.family && model.family.toLowerCase().includes(searchLower)) ||
                         (model.series && model.series.toLowerCase().includes(searchLower)) || 
                         (model.groupingKey && model.groupingKey.toLowerCase().includes(searchLower)) ||
                         (model.id && model.id.toLowerCase().includes(searchLower))
                       );
                     }
                     return true; // Keep if no search term
                   });

                   // Only include the type group if it has models after filtering
                   if (filteredModels.length > 0) {
                     totalCount += filteredModels.length;
                     return { typeGroupName, models: filteredModels };
                   }
                   return null;
                })
                .filter(Boolean); // Remove null entries (empty groups)

              // Only include the provider if it has type groups after filtering
              if (filteredTypeGroups.length > 0) {
                 return { providerName, typeGroups: filteredTypeGroups };
              }
              return null;
           })
           .filter(Boolean); // Remove null entries (empty providers)

         // Only include the category if it has providers after filtering
         if (filteredProviders.length > 0) {
           return { categoryName, providers: filteredProviders };
         }
         return null;
      })
      .filter(Boolean); // Remove null entries (empty categories)

    return { categories, totalCount };

  }, [processedModels, searchTerm, showExperimental, isLoading]);

  const { categories: displayCategories, totalCount: filteredModelCount } = filteredAndCategorizedModels;

  // --- End Filtering Logic ---
  
  return (
    <div ref={dropdownRef} className={styles.modelDropdown}>
      {/* Selected model display */}
      <div className={styles.selectedModel} onClick={toggleDropdown}>
        <div className={styles.modelInfo}>
          <h3 className={styles.modelName}>
            {selectedModel ? selectedModel.name : 'Select a model'}
          </h3>
          {selectedModel && (
            <p className={styles.modelDescription}>
              {selectedModel.provider ? `${selectedModel.provider} - ${selectedModel.family}` : 'Model details unavailable'}
            </p>
          )}
        </div>
        
        <div className={`${styles.dropdownArrow} ${isOpen ? styles.open : ''}`}>
          <svg 
            width="14" 
            height="8" 
            viewBox="0 0 14 8" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path 
              d="M1 1L7 7L13 1" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              stroke="currentColor" 
            />
          </svg>
        </div>
      </div>
      
      {/* Dropdown content */}
      {isOpen && (
        <div className={styles.dropdownContent}>
          {/* Search input */}
          <ModelSearch 
            searchTerm={searchTerm} 
            onSearchChange={handleSearchChange} 
            resultCount={filteredModelCount}
          />
          
          {/* Experimental toggle */}
          <div className={styles.experimentalToggle}>
            <label className={styles.toggleLabel}>
              <input 
                type="checkbox" 
                checked={isExperimentalModelsEnabled}
                onChange={toggleExperimentalModels}
                className={styles.toggleInput}
              />
              <span className={styles.toggleTrack}>
                <span className={styles.toggleThumb} />
              </span>
              <span className={styles.toggleText}>Show experimental models</span>
            </label>
          </div>
          
          {/* Model categories */}
          <div className={styles.modelList}>
            {isLoading ? (
              <div className={styles.loading}>Loading models...</div>
            ) : displayCategories.length > 0 ? (
               displayCategories.map(({ categoryName, providers }) => (
                 <ModelCategory 
                   key={categoryName} 
                   categoryName={categoryName}
                   providers={providers}
                   onSelectModel={handleSelectModel}
                   selectedModelId={selectedModel?.id}
                   searchTerm={searchTerm} 
                   showExperimental={showExperimental}
                 />
               ))
            ) : (
              searchTerm && filteredModelCount === 0 && (
                 <div className={styles.noResults}>
                   No models found matching "{searchTerm}"
                   <button 
                     className={styles.clearSearch} 
                     onClick={() => { setSearchTerm(''); updateSearchFilter(''); }}
                   >
                     Clear search
                   </button>
                 </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelDropdown; 