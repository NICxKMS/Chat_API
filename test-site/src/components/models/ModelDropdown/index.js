import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useModel } from '../../../contexts/ModelContext';
import ModelItem from '../ModelItem';
import ModelSearch from '../ModelSearch';
import styles from './ModelDropdown.module.css';

/**
 * SelectedModelDisplay component showing the currently selected model
 */
const SelectedModelDisplay = ({ selectedModel }) => (
  <div className={styles.selectedModelContainer}>
    <div className={styles.selectedModelLabel}>Current Model:</div>
    <div className={styles.selectedModelInfo}>
      <h3 className={styles.modelName}>
        {selectedModel ? selectedModel.name : 'No model selected'}
      </h3>
      {selectedModel && (
        <p className={styles.modelDescription}>
          {selectedModel.provider ? `${selectedModel.provider} - ${selectedModel.type}` : 'Model details unavailable'}
        </p>
      )}
    </div>
  </div>
);

/**
 * ExperimentalToggle component for showing/hiding experimental models
 */
const ExperimentalToggle = ({ isEnabled, onToggle }) => (
  <div className={styles.experimentalToggle}>
    <label className={styles.toggleLabel}>
      <input 
        type="checkbox" 
        checked={isEnabled}
        onChange={onToggle}
        className={styles.toggleInput}
      />
      <span className={styles.toggleTrack}>
        <span className={styles.toggleThumb} />
      </span>
      <span className={styles.toggleText}>Show experimental models</span>
    </label>
  </div>
);

/**
 * CapabilityTabs component for selecting model categories
 */
const CapabilityTabs = ({ capabilities, activeCapability, onSelectCapability }) => (
  <div className={styles.capabilityTabs}>
    {Object.keys(capabilities).map(capability => (
      <button
        key={capability}
        className={`${styles.capabilityTab} ${activeCapability === capability ? styles.active : ''}`}
        onClick={() => onSelectCapability(capability)}
      >
        {capability}
        {capabilities[capability]?.length > 0 && (
          <span> ({capabilities[capability].length})</span>
        )}
      </button>
    ))}
  </div>
);

/**
 * ModelList component showing the filtered and grouped models
 */
const ModelList = ({ isLoading, groupedModels, selectedModel, onSelectModel, searchTerm, totalCount, activeCapability, onClearSearch }) => (
  <div className={styles.modelList}>
    {isLoading ? (
      <div className={styles.loading}>Loading models...</div>
    ) : groupedModels.length > 0 ? (
      groupedModels.map((group) => (
        <div key={`${group.provider}-${group.type}`}>
          {/* Provider/Type header */}
          <div className={styles.providerTypeHeader}>
            <span className={styles.providerName}>{group.provider}</span>
            <span className={styles.providerTypeSeparator}>→</span>
            <span className={styles.typeLabel}>{group.type}</span>
          </div>
          
          {/* Models in this group */}
          {group.models.map(model => (
            <ModelItem
              key={model.id}
              model={model}
              selected={selectedModel?.id === model.id}
              onClick={onSelectModel}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      ))
    ) : (
      searchTerm && totalCount === 0 ? (
        <div className={styles.noResults}>
          No models found matching "{searchTerm}"
          <button 
            className={styles.clearSearch}
            onClick={onClearSearch}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className={styles.noResults}>
          No {activeCapability.toLowerCase()} models available
        </div>
      )
    )}
  </div>
);

/**
 * Fast string search function that uses direct character comparison
 * Much faster than toLowerCase().includes() for short searches
 */
function fastSearch(haystack, needle) {
  if (!haystack || !needle) return false;
  
  // Convert search to lowercase once
  const searchLower = needle.toLowerCase();
  const searchLen = searchLower.length;
  const targetLen = haystack.length;
  
  if (searchLen === 0 || searchLen > targetLen) return false;
  
  // Fast direct character comparison loop
  for (let i = 0; i <= targetLen - searchLen; i++) {
    let found = true;
    for (let j = 0; j < searchLen; j++) {
      // Convert haystack char to lowercase on the fly (faster than converting the whole string)
      const haystackChar = haystack.charCodeAt(i + j);
      const lowerChar = haystackChar >= 65 && haystackChar <= 90 
        ? haystackChar + 32 // A-Z -> a-z by adding 32 to ASCII code
        : haystackChar;
      
      if (lowerChar !== searchLower.charCodeAt(j)) {
        found = false;
        break;
      }
    }
    if (found) return true;
  }
  
  return false;
}

/**
 * Helper function to determine if a model matches the search term by type
 */
function isTypeMatch(model, searchLower) {
  if (!searchLower || !model) return false;
  
  // Check if search term directly matches any type information
  if (model.typeGroupName && model.typeGroupName.toLowerCase().includes(searchLower)) return true;
  if (model.type && model.type.toLowerCase().includes(searchLower)) return true;
  
  return false;
}

/**
 * Main ModelSelection component that contains all model selection UI
 * @returns {JSX.Element} - Rendered component
 */
const ModelSelection = () => {
  const { 
    processedModels, 
    selectedModel, 
    selectModel, 
    isExperimentalModelsEnabled,
    toggleExperimentalModels,
    showExperimental,
    updateSearchFilter,
    isLoading
  } = useModel();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCapability, setActiveCapability] = useState('Chat');
  
  // Handle selecting a model
  const handleSelectModel = useCallback((model) => {
    selectModel(model);
    setSearchTerm('');
    updateSearchFilter('');
  }, [selectModel, updateSearchFilter]);
  
  // Handle search term change
  const handleSearchChange = useCallback((term) => {
    setSearchTerm(term);
    updateSearchFilter(term);
  }, [updateSearchFilter]);
  
  // Clear search handler
  const handleClearSearch = useCallback(() => {
          setSearchTerm('');
          updateSearchFilter('');
  }, [updateSearchFilter]);
  
  // Filter and categorize models based on search term
  const filteredAndCategorizedModels = useMemo(() => {
    if (!processedModels || isLoading) {
      return { capabilities: { Chat: [], Image: [], Embedding: [] }, totalCount: 0 };
    }
    
    const typeMatchModels = { Chat: [], Image: [], Embedding: [] };
    const capabilities = { Chat: [], Image: [], Embedding: [] };
    let totalCount = 0;

    // Convert the nested processedModels object structure to a flat array of models
    const flatModels = [];
    Object.entries(processedModels).forEach(([category, providers]) => {
      Object.entries(providers).forEach(([provider, typeGroups]) => {
        Object.entries(typeGroups).forEach(([typeGroup, models]) => {
          models.forEach(model => {
            // Add additional properties needed for display
            flatModels.push({
              ...model,
              category,
              providerName: provider,
              typeGroupName: typeGroup
            });
          });
        });
      });
    });
    
    // Now process the flat array of models
    flatModels.forEach(model => {
      // Skip experimental models if not showing them
      if (model.is_experimental && !showExperimental) {
        return;
      }
      
      // Search implementation (fast path for empty search)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        
        // If direct type match, prioritize in results
        if (isTypeMatch(model, searchLower)) {
          typeMatchModels[model.category].push(model);
          totalCount++;
          return;
        }
        
        // Otherwise check other fields
        const nameMatch = (model.name && model.name.toLowerCase().includes(searchLower)) ||
                         (model.displayName && model.displayName.toLowerCase().includes(searchLower));
        
        const providerMatch = model.providerName && model.providerName.toLowerCase().includes(searchLower);
        
        const descriptionMatch = model.description && model.description.toLowerCase().includes(searchLower);
        
        // Include if any field matches
        if (nameMatch || providerMatch || descriptionMatch) {
          capabilities[model.category].push(model);
          totalCount++;
        }
      } else {
        // No search term, include all models
        capabilities[model.category].push(model);
        totalCount++;
      }
    });

    // Merge type matches at the beginning of each category
    Object.keys(capabilities).forEach(capability => {
      // Don't sort, keep type matches in their original order
      
      // Don't sort other matches either, keep original order
      
      // Prepend type matches to the capability array
      capabilities[capability] = [...typeMatchModels[capability], ...capabilities[capability]];
    });

    return { capabilities, totalCount };
  }, [processedModels, searchTerm, showExperimental, isLoading]);

  const { capabilities, totalCount: filteredModelCount } = filteredAndCategorizedModels;

  // Group models by provider and type for the active capability
  const groupedModels = useMemo(() => {
    if (!capabilities || !capabilities[activeCapability]) {
      return [];
    }

    const models = capabilities[activeCapability];
    const groups = [];
    
    let currentProvider = null;
    let currentType = null;
    let currentGroup = null;
    
    models.forEach(model => {
      // Start a new group when provider or type changes - use direct identity comparison
      if (currentProvider !== model.providerName || currentType !== model.typeGroupName) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        
        currentProvider = model.providerName;
        currentType = model.typeGroupName;
        currentGroup = {
          provider: currentProvider,
          type: currentType,
          models: []
        };
      }
      
      currentGroup.models.push(model);
    });
    
    // Add the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }
    
    return groups;
  }, [capabilities, activeCapability]);

  // --- End Filtering Logic ---
  
  return (
    <div className={styles.modelSelectionContainer}>
      {/* 1. Selected model display */}
      <SelectedModelDisplay selectedModel={selectedModel} />
      
      {/* 2. Search container */}
      <div className={styles.searchContainer}>
          <ModelSearch 
            searchTerm={searchTerm} 
            onSearchChange={handleSearchChange} 
            resultCount={filteredModelCount}
          />
      </div>
          
      {/* 3. Models container */}
      <div className={styles.modelsContainer}>
        {/* Fixed header with experimental toggle and tabs */}
        <div className={styles.fixedHeader}>
          {/* Experimental toggle */}
          <ExperimentalToggle 
            isEnabled={isExperimentalModelsEnabled}
            onToggle={toggleExperimentalModels}
          />
          
          {/* Capability tabs */}
          <CapabilityTabs 
            capabilities={capabilities}
            activeCapability={activeCapability}
            onSelectCapability={setActiveCapability}
          />
        </div>
        
        {/* Scrollable model list */}
        <div className={styles.scrollableModelList}>
          <ModelList 
            isLoading={isLoading}
            groupedModels={groupedModels}
            selectedModel={selectedModel}
                   onSelectModel={handleSelectModel}
                   searchTerm={searchTerm} 
            totalCount={filteredModelCount}
            activeCapability={activeCapability}
            onClearSearch={handleClearSearch}
          />
        </div>
      </div>
    </div>
  );
};

export default ModelSelection; 