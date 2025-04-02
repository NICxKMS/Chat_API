import React, { 
  useEffect, 
  useRef, 
  useCallback, 
  useMemo, 
  useState
} from 'react';
import { useModel, useModelFilter } from '../../../contexts/ModelContext';
import ModelItem from '../ModelItem';
import ModelSearch from '../ModelSearch';
import styles from './ModelDropdown.module.css';

/**
 * SelectedModelDisplay component showing the currently selected model
 */
const SelectedModelDisplay = React.memo(({ selectedModel }) => (
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
));

/**
 * ExperimentalToggle component for showing/hiding experimental models
 */
const ExperimentalToggle = React.memo(({ isEnabled, onToggle }) => (
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
));

/**
 * CapabilityTabs component for selecting model categories
 */
const CapabilityTabs = React.memo(({ capabilities, activeCapability, onSelectCapability }) => {
  const tabsRef = useRef(null);
  
  // Scroll the selected tab into view when it changes
  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`.${styles.active}`);
      if (activeTab) {
        // Calculate position to center the tab in the container
        const container = tabsRef.current;
        const containerWidth = container.offsetWidth;
        const tabWidth = activeTab.offsetWidth;
        const tabLeft = activeTab.offsetLeft;
        
        // Center the tab
        const scrollPosition = tabLeft - (containerWidth / 2) + (tabWidth / 2);
        container.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
      }
    }
  }, [activeCapability]);
  
  return (
    <div className={styles.capabilityTabs} ref={tabsRef}>
      {Object.keys(capabilities).map(capability => (
        <button
          key={capability}
          className={`${styles.capabilityTab} ${activeCapability === capability ? styles.active : ''}`}
          onClick={() => onSelectCapability(capability)}
        >
          {capability}
          <span> ({capabilities[capability]})</span>
        </button>
      ))}
    </div>
  );
});

/**
 * ModelList component showing the filtered and grouped models
 */
const ModelList = React.memo(({ isLoading, groupedModels, selectedModel, onSelectModel, searchTerm, totalCount, activeCapability, onClearSearch }) => (
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
            <span className={styles.modelCount}>({group.models.length})</span>
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
));

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
 * SearchContainer component for model searching
 */
const SearchContainer = React.memo(({ searchTerm, onSearchChange, totalCount }) => (
  <div className={styles.searchContainer}>
    <ModelSearch 
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      resultCount={totalCount} 
    />
  </div>
));

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

// Helper function to format provider name
const formatProviderName = (provider) => {
  if (!provider) return '';
  // Simple title case, handle AI
  return provider
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/ai/gi, 'AI');
};

// Helper function to check if model should be included
const shouldIncludeModel = (model, showExperimental, searchTerm, provider, formattedProvider, typeGroup) => {
  if (!model) return false;
  if (model.is_experimental && !showExperimental) {
    return false;
  }
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = model.name?.toLowerCase().includes(searchLower) || model.displayName?.toLowerCase().includes(searchLower);
    const providerMatch = provider?.toLowerCase().includes(searchLower) || formattedProvider?.toLowerCase().includes(searchLower);
    const typeMatch = typeGroup?.toLowerCase().includes(searchLower);
    const tagMatch = model.tags && model.tags.some(tag => tag?.toLowerCase().includes(searchLower));

    if (!(nameMatch || providerMatch || typeMatch || tagMatch)) {
      return false;
    }
  }
  return true;
};

/**
 * Main ModelSelection component that orchestrates all model selection UI
 * @returns {JSX.Element} - Rendered component
 */
const ModelSelection = () => {
  // Split context usage between model data and filter functionality
  const { 
    processedModels, 
    selectedModel, 
    selectModel, 
    isExperimentalModelsEnabled,
    toggleExperimentalModels,
    showExperimental,
    isLoading
  } = useModel();
  
  // Use the filter context for search-related functionality
  const {
    modelFilter,
    updateSearchFilter
  } = useModelFilter();
  
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
  
  // Get current search term from context or local state
  const currentSearchTerm = useMemo(() => {
    return modelFilter?.search || searchTerm;
  }, [modelFilter, searchTerm]);
  
  // Filter and categorize models based on search term and active capability
  const { groupedModels, totalCount } = useMemo(() => {
    if (!processedModels || isLoading || !processedModels[activeCapability]) {
      return { groupedModels: [], totalCount: 0 };
    }
    
    const categoryModels = processedModels[activeCapability];
    let count = 0;
    const groups = [];

    Object.entries(categoryModels).forEach(([provider, typeGroups]) => {
      // Format the provider name once per provider group
      const formattedProvider = formatProviderName(provider);
      
      Object.entries(typeGroups).forEach(([typeGroup, models]) => {
        const filteredModels = models.filter(model => 
          shouldIncludeModel(model, showExperimental, currentSearchTerm, provider, formattedProvider, typeGroup)
        );

        if (filteredModels.length > 0) {
          groups.push({
            provider: formattedProvider, // Use the formatted provider name
            type: typeGroup,
            models: filteredModels
          });
          count += filteredModels.length;
        }
      });
    });

    return { groupedModels: groups, totalCount: count };

  }, [processedModels, isLoading, activeCapability, showExperimental, currentSearchTerm]);
  
  // Prepare capabilities for tabs, including counts
  const capabilitiesWithCounts = useMemo(() => {
    const caps = {};
    if (processedModels) {
      Object.keys(processedModels).forEach(cap => {
        let modelCount = 0;
        if(processedModels[cap]) {
          Object.entries(processedModels[cap]).forEach(([provider, typeGroups]) => {
            // Format provider name consistently here too
            const formattedProvider = formatProviderName(provider);
            
            Object.entries(typeGroups).forEach(([typeGroup, models]) => {
              // Apply the same filtering as in the groupedModels calculation using the shared function
              const filteredCount = models.filter(model => 
                shouldIncludeModel(model, showExperimental, currentSearchTerm, provider, formattedProvider, typeGroup)
              ).length;
              
              modelCount += filteredCount;
            });
          });
        }
        caps[cap] = modelCount;
      });
    }
    return caps;
  }, [processedModels, showExperimental, currentSearchTerm]);

  // Sync local search term with context when modelFilter changes
  useEffect(() => {
    if (modelFilter?.search !== searchTerm) {
      setSearchTerm(modelFilter?.search || '');
    }
  }, [modelFilter, searchTerm]);

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