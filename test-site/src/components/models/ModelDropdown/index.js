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
  <div className={styles.modelList} role="listbox">
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
 * SearchContainer component for model searching
 */
const SearchContainer = ({ searchTerm, onSearchChange, totalCount }) => (
  <div className={styles.searchContainer}>
    <ModelSearch 
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      resultCount={totalCount} 
    />
  </div>
);

/**
 * ModelSelectionPanel component for selecting models from a filterable list
 */
const ModelSelectionPanel = React.forwardRef(({ 
  isExperimentalModelsEnabled, 
  toggleExperimentalModels, 
  capabilitiesWithCounts, 
  activeCapability, 
  setActiveCapability,
  isLoading,
  groupedModels,
  selectedModel,
  handleSelectModel,
  searchTerm,
  totalCount,
  handleClearSearch 
}, ref) => (
  <div className={styles.modelsContainer} ref={ref}>
    <div className={styles.fixedHeader}>
      <ExperimentalToggle 
        isEnabled={isExperimentalModelsEnabled} 
        onToggle={toggleExperimentalModels} 
      />
      <CapabilityTabs 
        capabilities={capabilitiesWithCounts} 
        activeCapability={activeCapability} 
        onSelectCapability={setActiveCapability} 
      />
    </div>
    
    <div className={styles.scrollableModelList}>
      <ModelList 
        isLoading={isLoading}
        groupedModels={groupedModels}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        searchTerm={searchTerm}
        totalCount={totalCount}
        activeCapability={activeCapability}
        onClearSearch={handleClearSearch}
      />
    </div>
  </div>
));

/**
 * Main ModelSelection component that orchestrates all model selection UI
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
  const modelSelectorRef = useRef(null);
  
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
  
  // Filter and categorize models based on search term and active capability
  const { groupedModels, totalCount } = useMemo(() => {
    if (!processedModels || isLoading || !processedModels[activeCapability]) {
      return { groupedModels: [], totalCount: 0 };
    }
    
    const categoryModels = processedModels[activeCapability];
    let count = 0;
    const groups = [];

    Object.entries(categoryModels).forEach(([provider, typeGroups]) => {
      Object.entries(typeGroups).forEach(([typeGroup, models]) => {
        const filteredModels = models.filter(model => {
          // Skip experimental models if not showing them
          if (model.is_experimental && !showExperimental) {
            return false;
          }
          
          // Filter by search term (case-insensitive)
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const nameMatch = (model.name && model.name.toLowerCase().includes(searchLower)) ||
                             (model.displayName && model.displayName.toLowerCase().includes(searchLower));
            const providerMatch = provider.toLowerCase().includes(searchLower);
            const typeMatch = typeGroup.toLowerCase().includes(searchLower);
            const tagMatch = model.tags && model.tags.some(tag => tag.toLowerCase().includes(searchLower));
            
            if (!(nameMatch || providerMatch || typeMatch || tagMatch)) {
              return false; // Exclude if no field matches the search term
            }
          }
          return true; // Include if no search term or if it matches
        });

        if (filteredModels.length > 0) {
          groups.push({
            provider: provider,
            type: typeGroup,
            models: filteredModels
          });
          count += filteredModels.length;
        }
      });
    });

    return { groupedModels: groups, totalCount: count };

  }, [processedModels, isLoading, activeCapability, showExperimental, searchTerm]);
  
  // Prepare capabilities for tabs, including counts
  const capabilitiesWithCounts = useMemo(() => {
    const caps = {};
    if (processedModels) {
      Object.keys(processedModels).forEach(cap => {
        let modelCount = 0;
        if(processedModels[cap]) {
          Object.values(processedModels[cap]).forEach(provider => {
            Object.values(provider).forEach(typeGroup => {
              modelCount += typeGroup.filter(model => !(model.is_experimental && !showExperimental)).length;
            });
          });
        }
        caps[cap] = modelCount > 0 ? [{length: modelCount}] : []; // Store count info simply
      });
    }
    return caps;
  }, [processedModels, showExperimental]);


  return (
    <div className={styles.modelSelectionContainer}>
      {/* Current model display */}
      <SelectedModelDisplay selectedModel={selectedModel} />

      {/* Search container */}
      <SearchContainer 
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        totalCount={totalCount}
      />
      
      {/* Model selection list panel */}
      <ModelSelectionPanel
        ref={modelSelectorRef}
        isExperimentalModelsEnabled={isExperimentalModelsEnabled}
        toggleExperimentalModels={toggleExperimentalModels}
        capabilitiesWithCounts={capabilitiesWithCounts}
        activeCapability={activeCapability}
        setActiveCapability={setActiveCapability}
        isLoading={isLoading}
        groupedModels={groupedModels}
        selectedModel={selectedModel}
        handleSelectModel={handleSelectModel}
        searchTerm={searchTerm}
        totalCount={totalCount}
        handleClearSearch={handleClearSearch}
      />
    </div>
  );
};

export default ModelSelection; 