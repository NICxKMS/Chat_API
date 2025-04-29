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
  <div className={styles.ModelDropdown__selectedModelContainer}>
    <div className={styles.ModelDropdown__selectedModelLabel}>Current Model:</div>
    <div className={styles.ModelDropdown__selectedModelInfo}>
      <h3 className={styles.ModelDropdown__modelName}>
        {selectedModel ? selectedModel.name : 'No model selected'}
      </h3>
      {selectedModel && (
        <p className={styles.ModelDropdown__modelDescription}>
          {selectedModel.provider ? `${selectedModel.provider} - ${selectedModel.type}` : 'Model details unavailable'}
        </p>
      )}
    </div>
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
      const activeTab = tabsRef.current.querySelector(`.${styles['ModelDropdown__capabilityTab--active']}`);
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
    <div className={styles.ModelDropdown__capabilityTabs} ref={tabsRef}>
      {Object.keys(capabilities).map(capability => (
        <button
          key={capability}
          className={`${styles.ModelDropdown__capabilityTab} ${activeCapability === capability ? styles['ModelDropdown__capabilityTab--active'] : ''}`}
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
  <div className={styles.ModelDropdown__modelList} role="listbox">
    {isLoading ? (
      <div className={styles.ModelDropdown__loading}>Loading models...</div>
    ) : groupedModels && Object.keys(groupedModels).length > 0 ? (
      groupedModels.map((group) => (
        <div key={`${group.provider}-${group.type}`}>
          <div className={styles.ModelDropdown__providerTypeHeader}>
            <span className={styles.ModelDropdown__providerName}>{group.provider}</span>
            <span className={styles.ModelDropdown__providerTypeSeparator}>→</span>
            <span className={styles.ModelDropdown__typeLabel}>{group.type}</span>
            <span className={styles.modelCount}>({group.models.length})</span>
          </div>
          
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
        <div className={styles.ModelDropdown__noResults}>
          No models found matching "{searchTerm}"
          <button 
            className={styles.ModelDropdown__clearSearch}
            onClick={onClearSearch}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className={styles.ModelDropdown__noResults}>
          No {activeCapability.toLowerCase()} models available
        </div>
      )
    )}
  </div>
));

/**
 * SearchContainer component for model searching
 */
const SearchContainer = React.memo(({ searchTerm, onSearchChange, totalCount }) => (
  <div className={styles.ModelDropdown__searchContainer}>
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
  <div className={styles.ModelDropdown__modelsContainer} ref={ref}>
    <div className={styles.ModelDropdown__fixedHeader}>
      <CapabilityTabs 
        capabilities={capabilitiesWithCounts} 
        activeCapability={activeCapability} 
        onSelectCapability={setActiveCapability} 
      />
    </div>
    
    <div className={styles.ModelDropdown__scrollableModelList}>
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

// ExperimentalToggle component is not currently used, commented out
// const ExperimentalToggle = React.memo(({ isEnabled, onToggle }) => (
//   <div className={styles.experimentalToggle}>
//     <label className={styles.toggleLabel}>
//       <input
//         type="checkbox"
//         checked={isEnabled}
//         onChange={onToggle}
//         className={styles.toggleInput}
//       />
//       <span className={styles.toggleTrack}>
//         <span className={styles.toggleThumb} />
//       </span>
//       <span className={styles.toggleText}>Show experimental models</span>
//     </label>
//   </div>
// ));

/**
 * Main ModelSelection component that orchestrates all model selection UI
 * @returns {JSX.Element} - Rendered component
 */
const ModelSelection = () => {
  const { 
    processedModels, 
    selectedModel, 
    isLoading, 
    selectModel, 
    showExperimental,
    toggleExperimentalModels
  } = useModel();
  
  const {
    modelFilter,
    updateSearchFilter
  } = useModelFilter();
  
  const [activeCapability, setActiveCapability] = useState('Chat');
  const panelRef = useRef(null);
  
  const handleSelectModel = useCallback((model) => {
    selectModel(model);
  }, [selectModel]);
  
  // Handle search input changes
  const handleSearchChange = useCallback((searchValue) => {
    if (typeof searchValue === 'string') {
      updateSearchFilter(searchValue);
    } else {
      console.warn('Invalid search value in ModelDropdown handleSearchChange');
    }
  }, [updateSearchFilter]);

  // Handle clearing search
  const handleClearSearch = useCallback(() => {
    updateSearchFilter('');
  }, [updateSearchFilter]);
  
  const capabilitiesWithCounts = useMemo(() => {
    const counts = {};
    if (processedModels) {
      Object.keys(processedModels).forEach(category => {
        counts[category] = Object.values(processedModels[category])
          .flatMap(providerGroups => Object.values(providerGroups))
          .flat()
          .filter(model => shouldIncludeModel(model, showExperimental, modelFilter.search, model.provider, formatProviderName(model.provider), model.type))
          .length;
      });
    }
    return counts;
  }, [processedModels, showExperimental, modelFilter.search]);

  const groupedModels = useMemo(() => {
    if (!processedModels || !processedModels[activeCapability]) {
      return [];
    }
    
    const modelsInCategory = processedModels[activeCapability];
    const groups = [];

    Object.entries(modelsInCategory).forEach(([provider, typeGroups]) => {
      const formattedProvider = formatProviderName(provider);
      Object.entries(typeGroups).forEach(([type, models]) => {
        const filteredGroupModels = models.filter(model =>
          shouldIncludeModel(model, showExperimental, modelFilter.search, provider, formattedProvider, type)
        );
        if (filteredGroupModels.length > 0) {
          groups.push({
            provider: formattedProvider,
            type: type,
            models: filteredGroupModels
          });
        }
      });
    });

    return groups;
  }, [processedModels, activeCapability, showExperimental, modelFilter.search]);

  const totalModelCount = useMemo(() => {
    return groupedModels.reduce((count, group) => count + group.models.length, 0);
  }, [groupedModels]);

  return (
    <div className={styles.modelSelectionContainer}>
      <SelectedModelDisplay selectedModel={selectedModel} />
      <SearchContainer 
        searchTerm={modelFilter.search}
        onSearchChange={handleSearchChange}
        totalCount={totalModelCount} 
      />
      <ModelSelectionPanel
        ref={panelRef}
        isExperimentalModelsEnabled={showExperimental}
        toggleExperimentalModels={toggleExperimentalModels}
        capabilitiesWithCounts={capabilitiesWithCounts}
        activeCapability={activeCapability}
        setActiveCapability={setActiveCapability}
        isLoading={isLoading}
        groupedModels={groupedModels}
        selectedModel={selectedModel}
        handleSelectModel={handleSelectModel}
        searchTerm={modelFilter.search}
        totalCount={totalModelCount}
        handleClearSearch={handleClearSearch}
      />
    </div>
  );
};

export default ModelSelection; 