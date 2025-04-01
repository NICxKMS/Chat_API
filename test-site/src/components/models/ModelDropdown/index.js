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
 * Compare model names for proper version-aware sorting
 * This handles numeric parts of model names properly (o1, 4o, etc.)
 */
function compareModelNames(a, b) {
  // Special case for numbered models like o1-mini vs 4o-mini
  const aName = a.name || '';
  const bName = b.name || '';
  const aProvider = (a.provider || '').toLowerCase();
  const bProvider = (b.provider || '').toLowerCase();
  
  // Extract version numbers if they exist
  const aVersion = parseFloat(a.version || '0');
  const bVersion = parseFloat(b.version || '0');
  
  // Specialized provider-specific sorting
  
  // 1. Gemini type priority: flash lite > flash > pro > thinking > gemma > standard
  if (aProvider === 'gemini' && bProvider === 'gemini') {
    // For Gemini models, sort by type priority first, then by version
    const aNameLower = aName.toLowerCase();
    const bNameLower = bName.toLowerCase();
    
    // Define Gemini type priority (lower index = higher priority)
    const geminiPriority = ['flash lite', 'flash', 'pro', 'thinking', 'gemma'];
    
    // Find the priority of each model type
    let aPriority = 999; // Default low priority
    let bPriority = 999;
    
    // Find the highest priority match for each model
    for (let i = 0; i < geminiPriority.length; i++) {
      const typeKeyword = geminiPriority[i];
      // Use indexOf for fast checking
      if (aNameLower.indexOf(typeKeyword) !== -1 && i < aPriority) {
        aPriority = i;
      }
      if (bNameLower.indexOf(typeKeyword) !== -1 && i < bPriority) {
        bPriority = i;
      }
    }
    
    // If types have different priorities, sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority; // Lower index means higher priority
    }
    
    // If types have the same priority, sort by version (higher first)
    if (aVersion && bVersion && aVersion !== bVersion) {
      return bVersion - aVersion;
    }
    
    return aName.localeCompare(bName);
  }
  
  // 2. OpenAI type priority: mini > o-series > higher GPT versions
  if (aProvider === 'openai' && bProvider === 'openai') {
    const aNameLower = aName.toLowerCase();
    const bNameLower = bName.toLowerCase();
    
    // First check for GPT models
    const aIsGPT = aNameLower.indexOf('gpt') !== -1;
    const bIsGPT = bNameLower.indexOf('gpt') !== -1;
    
    // If both are GPT models, sort by version (higher first)
    if (aIsGPT && bIsGPT) {
      // Extract numbers after "GPT-" like 3.5, 4, etc. using character checks
      let aNum = 0;
      let bNum = 0;
      
      // Fast version number extraction
      const aGptVersionMatch = aNameLower.match(/gpt-?(\d+\.?\d*)/i);
      const bGptVersionMatch = bNameLower.match(/gpt-?(\d+\.?\d*)/i);
      
      if (aGptVersionMatch) aNum = parseFloat(aGptVersionMatch[1]);
      if (bGptVersionMatch) bNum = parseFloat(bGptVersionMatch[1]);
      
      if (aNum !== bNum) {
        return bNum - aNum; // Higher version first
      }
    }
    
    // Check for mini models - they have higher priority
    const aIsMini = aNameLower.indexOf('mini') !== -1;
    const bIsMini = bNameLower.indexOf('mini') !== -1;
    
    if (aIsMini && !bIsMini) return -1; // Mini has higher priority
    if (!aIsMini && bIsMini) return 1;
    
    // Check for o-series models
    const aIsOSeries = aNameLower.indexOf('-o') !== -1 || aNameLower.startsWith('o');
    const bIsOSeries = bNameLower.indexOf('-o') !== -1 || bNameLower.startsWith('o');
    
    // Sort o-series vs non-o-series
    if (aIsOSeries && !bIsOSeries) return -1; // o-series has higher priority
    if (!aIsOSeries && bIsOSeries) return 1;
    
    // Within o-series, check for numbering (4o vs o1)
    if (aIsOSeries && bIsOSeries) {
      const aStartsWithO = aNameLower.startsWith('o');
      const bStartsWithO = bNameLower.startsWith('o');
      const aStartsWithDigit = /^\d/.test(aNameLower);
      const bStartsWithDigit = /^\d/.test(bNameLower);
      
      if (aStartsWithDigit && !bStartsWithDigit) return -1; // 4o before o1
      if (!aStartsWithDigit && bStartsWithDigit) return 1;
    }
    
    return aName.localeCompare(bName);
  }
  
  // 3. Anthropic/Claude priority: sonnet > opus > haiku
  if ((aProvider === 'anthropic' || aNameLower.indexOf('claude') !== -1) && 
      (bProvider === 'anthropic' || bNameLower.indexOf('claude') !== -1)) {
    const aNameLower = aName.toLowerCase();
    const bNameLower = bName.toLowerCase();
    
    // Define Claude type priority
    const claudePriority = ['sonnet', 'opus', 'haiku'];
    
    // Find the priority of each model
    let aPriority = 999;
    let bPriority = 999;
    
    for (let i = 0; i < claudePriority.length; i++) {
      if (aNameLower.indexOf(claudePriority[i]) !== -1) {
        aPriority = i;
      }
      if (bNameLower.indexOf(claudePriority[i]) !== -1) {
        bPriority = i;
      }
    }
    
    // If different types, sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority; // Lower index = higher priority
    }
    
    // If same type, sort by version if available
    const aMatch = aNameLower.match(/claude-?(\d+\.?\d*)/i);
    const bMatch = bNameLower.match(/claude-?(\d+\.?\d*)/i);
    
    if (aMatch && bMatch) {
      const aNum = parseFloat(aMatch[1]);
      const bNum = parseFloat(bMatch[1]);
      if (aNum !== bNum) {
        return bNum - aNum; // Higher version first
      }
    }
    
    return aNameLower.localeCompare(bNameLower);
  }
  
  // 4. Generic model comparison for other providers
  
  // If both have explicit versions, compare by version first
  if (aVersion && bVersion && aVersion !== bVersion) {
    return bVersion - aVersion; // Higher versions first
  }
  
  // Type-based sorting for model families not covered above
  const aType = (a.type || '').toLowerCase();
  const bType = (b.type || '').toLowerCase();
  
  // If we can infer types from the model object and they're different
  if (aType && bType && aType !== bType) {
    // Pro models get priority
    if (aType.indexOf('pro') !== -1) return -1;
    if (bType.indexOf('pro') !== -1) return 1;
    
    // Then fast/flash models
    if (aType.indexOf('fast') !== -1 || aType.indexOf('flash') !== -1) return -1;
    if (bType.indexOf('fast') !== -1 || bType.indexOf('flash') !== -1) return 1;
  }
  
  // Default to name-based comparison if everything else is equal
  return aName.localeCompare(bName);
}

/**
 * Check if a term matches a model's type information
 * This is faster than checking all fields
 */
function isTypeMatch(model, searchLower) {
  // Fast checks for common type patterns (without using regex)
  const type = model.type || '';
  
  // Direct type match (highest priority)
  if (fastSearch(type, searchLower)) {
    return true;
  }
  
  // Check for common model type patterns
  const checkPatterns = ['gpt', 'pro', 'flash', 'thinking', 'claude', 'stable', 'dall'];
  
  for (let i = 0; i < checkPatterns.length; i++) {
    // Only do the slow check if the search term starts with this pattern
    // This is much faster than checking full model name for every pattern
    if (searchLower.indexOf(checkPatterns[i]) === 0) {
      // If we find the pattern in the model name, it's a type match
      if (model.name && model.name.toLowerCase().indexOf(checkPatterns[i]) !== -1) {
        return true;
      }
    }
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
    
    // Track models that match by type for prioritization
    const typeMatchModels = {
      'Chat': [],
      'Image': [],
      'Embedding': []
    };
    
    // First pass: organize models by capability
    Object.entries(processedModels).forEach(([categoryName, providers]) => {
      Object.entries(providers).forEach(([providerName, typeGroups]) => {
        Object.entries(typeGroups).forEach(([typeGroupName, models]) => {
          // Filter models
                   const filteredModels = models.filter(model => {
            // Experimental filter - fast boolean check
                     if (model.is_experimental && !showExperimental) return false;
                     
            // Always include if no search term
            if (!searchTerm) return true;
            
            // Check type match first (prioritized)
            // if (isTypeMatch(model, searchLower)) {
            //   model._typeMatch = true; // Mark as type match for sorting
            //   return true;
            // }
            
            // Then check other fields
                       return (
              fastSearch(model.name, searchLower) ||
              fastSearch(model.provider, searchLower) ||
              (model.family && fastSearch(model.family, searchLower)) ||
              (model.series && fastSearch(model.series, searchLower)) || 
              (model.groupingKey && fastSearch(model.groupingKey, searchLower)) ||
              (model.id && fastSearch(model.id, searchLower))
            );
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
              
              // Add model data
              const modelData = {
                ...model,
                categoryName,
                providerName,
                typeGroupName
              };
              
              // Separate type matches from other matches
              if (searchTerm && model._typeMatch) {
                typeMatchModels[category].push(modelData);
              } else {
                capabilities[category].push(modelData);
              }
            });
          }
        });
      });
    });

    // Merge type matches at the beginning of each category
    Object.keys(capabilities).forEach(capability => {
      // First sort type matches by name
      typeMatchModels[capability].sort((a, b) => {
        // First sort by provider
        if (a.providerName !== b.providerName) {
          return a.providerName < b.providerName ? -1 : 1;
        }
        // Then by type group
        if (a.typeGroupName !== b.typeGroupName) {
          return a.typeGroupName < b.typeGroupName ? -1 : 1;
        }
        // Then by version-aware model sorting
        return compareModelNames(a, b);
      });
      
      // Then sort other matches using the same advanced sorting
      capabilities[capability].sort((a, b) => {
        // First sort by provider
        if (a.providerName !== b.providerName) {
          return a.providerName < b.providerName ? -1 : 1;
        }
        // Then by type group
        if (a.typeGroupName !== b.typeGroupName) {
          return a.typeGroupName < b.typeGroupName ? -1 : 1;
        }
        // Then by version-aware model sorting
        return compareModelNames(a, b);
      });
      
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