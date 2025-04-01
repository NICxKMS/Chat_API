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
  
  // --- Filtering Logic --- 
  const filteredAndCategorizedModels = useMemo(() => {
    if (isLoading || !processedModels) {
      return { capabilities: {}, totalCount: 0 };
    }

    let totalCount = 0;
    const capabilities = {
      'Chat': [],
      'Image': [],
      'Embedding': []
    };
    
    // Pre-compute lowercase search term once
    const searchLower = searchTerm ? searchTerm.toLowerCase() : '';
    
    // First pass: organize models by capability
    Object.entries(processedModels).forEach(([categoryName, providers]) => {
      Object.entries(providers).forEach(([providerName, typeGroups]) => {
        Object.entries(typeGroups).forEach(([typeGroupName, models]) => {
          // Filter models
          const filteredModels = models.filter(model => {
            // Experimental filter - fast boolean check
            if (model.is_experimental && !showExperimental) return false;
            
            // Search filter (apply to various fields)
            if (searchTerm) {
              // Use direct character comparison instead of string contains
              return (
                fastSearch(model.name, searchLower) ||
                fastSearch(model.provider, searchLower) ||
                (model.family && fastSearch(model.family, searchLower)) ||
                (model.series && fastSearch(model.series, searchLower)) || 
                (model.groupingKey && fastSearch(model.groupingKey, searchLower)) ||
                (model.id && fastSearch(model.id, searchLower))
              );
            }
            return true; // Keep if no search term
          });

          if (filteredModels.length > 0) {
            totalCount += filteredModels.length;
            
            // Determine model category based on type or capabilities - using fast character checks
            filteredModels.forEach(model => {
              // Default category is Chat unless specified otherwise
              let category = 'Chat';
              
              // Fast category determination using 1st char comparison and type equality
              const firstChar = typeGroupName && typeGroupName[0]?.toLowerCase(); 
              
              // Check if it's an image model - use direct comparison rather than includes()
              if (model.type === 'Image Generation' || 
                  firstChar === 'i' || 
                  firstChar === 'v' || // 'v' for vision
                  (model.capabilities && Array.isArray(model.capabilities) && 
                   model.capabilities.indexOf('Image Generation') !== -1)) {
                category = 'Image';
              } 
              // Check if it's an embedding model
              else if (model.type === 'Embedding' || 
                  firstChar === 'e' ||
                  (model.capabilities && Array.isArray(model.capabilities) && 
                   model.capabilities.indexOf('embedding') !== -1)) {
                category = 'Embedding';
              }
              
              capabilities[category].push({
                ...model,
                categoryName,
                providerName,
                typeGroupName
              });
            });
          }
        });
      });
    });

    // Sort models within each capability
    Object.keys(capabilities).forEach(capability => {
      capabilities[capability].sort((a, b) => {
        // First sort by provider - using direct string comparison
        if (a.providerName !== b.providerName) {
          return a.providerName < b.providerName ? -1 : 1;
        }
        // Then by type group
        if (a.typeGroupName !== b.typeGroupName) {
          return a.typeGroupName < b.typeGroupName ? -1 : 1;
        }
        // Then by name
        return a.name < b.name ? -1 : 1;
      });
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