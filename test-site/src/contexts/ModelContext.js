import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from './ApiContext';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Cache expiry time in milliseconds (5 minutes)
const CACHE_EXPIRY_TIME = 5 * 60 * 1000;

// Create separate contexts for models and filtering
const ModelContext = createContext();
const ModelFilterContext = createContext();

// Custom hook for using model context
export const useModel = () => {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
};

// Custom hook for using model filter context
export const useModelFilter = () => {
  const context = useContext(ModelFilterContext);
  if (context === undefined) {
    throw new Error('useModelFilter must be used within a ModelProvider');
  }
  return context;
};

// Model provider component
export const ModelProvider = ({ children }) => {
  const { apiUrl, apiStatus } = useApi();
  
  // State for model data
  const [allModels, setAllModels] = useState([]);
  const [processedModels, setProcessedModels] = useState({});
  const [experimentalModels, setExperimentalModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter state - moved to separate context
  const [showExperimental, setShowExperimental] = useLocalStorage('showExperimental', false);
  const [modelFilter, setModelFilter] = useState({
    search: '',
    categories: {
      'Chat': true,
      'Image': true,
      'Embedding': true
    }
  });
  
  // Check if cache is valid
  const isCacheValid = useCallback((cache) => {
    return (
      cache &&
      cache.timestamp &&
      Date.now() - cache.timestamp < CACHE_EXPIRY_TIME &&
      cache.allModels &&
      cache.processedModels
    );
  }, []);
  
  // Get cached models from localStorage
  const getCachedModels = useCallback(() => {
    try {
      const cacheStr = localStorage.getItem('modelDropdownCache');
      if (!cacheStr) return null;
      
      const cache = JSON.parse(cacheStr);
      if (!isCacheValid(cache)) return null;
      
      return {
        allModels: cache.allModels,
        processedModels: cache.processedModels,
        experimentalModels: cache.experimentalModels || [],
        timestamp: cache.timestamp
      };
    } catch (error) {
      console.error('Error reading model cache:', error);
      return null;
    }
  }, [isCacheValid]);
  
  // Cache models to localStorage
  const cacheModels = useCallback((data) => {
    try {
      const cache = {
        allModels: data.allModels,
        processedModels: data.processedModels,
        experimentalModels: data.experimentalModels,
        timestamp: Date.now()
      };
      
      localStorage.setItem('modelDropdownCache', JSON.stringify(cache));
    } catch (error) {
      console.error('Error caching models:', error);
    }
  }, []);
  
  // Normalize model display name
  const normalizeModelName = useCallback((model) => {
    const name = model.id || '';
    return name.split('/').pop() || name;
  }, []);
  
  // Process hierarchical model groups
  const processModels = useCallback((data) => {
    if (!data || !data.hierarchical_groups) {
      // Keep the existing error check, but maybe log the received data for easier debugging
      console.error('Invalid model data format received:', data); 
      throw new Error('Invalid model data format');
    }
    
    const allModels = [];
    const experimentalModels = [];
    const processedModels = {};
    
    // Process each top-level group (providers)
    data.hierarchical_groups.forEach(providerGroup => {
      // Get provider name from group_value
      const provider = providerGroup.group_value;
      
      // Check if children exist before iterating (safer)
      if (!providerGroup.children || !Array.isArray(providerGroup.children)) return;

      // Iterate through the children of the provider group (these are type groups)
      providerGroup.children.forEach(typeGroup => {
        // Get type name from group_value
        const type = typeGroup.group_value; 
        // Use type as the grouping key since ui_name is gone
        const groupingKey = type; 

        if (!typeGroup.children || !Array.isArray(typeGroup.children)) return;
        
        // Iterate through the children of the type group (these are version groups)
        typeGroup.children.forEach(versionGroup => {
          // Get version name from group_value
          const version = versionGroup.group_value; 
          
          // Check if models exist before iterating
          if (!versionGroup.models || !Array.isArray(versionGroup.models)) return;

          // Process each model in the version group
          versionGroup.models.forEach(model => {
            // Determine category (existing logic seems okay)
            let category = 'Chat';
            // Use model.type directly if available, otherwise check capabilities
            if (model.type && model.type.toLowerCase() === 'image generation') {
              category = 'Image';
            } else if (model.type && model.type.toLowerCase() === 'embedding') {
               category = 'Embedding';
            } else if (model.capabilities && model.capabilities.includes('embedding')) {
               category = 'Embedding';
            } else if (model.capabilities && model.capabilities.includes('Image Generation')) {
              category = 'Image'; // Handle cases where type might not be set but capability is
            }
            
            // Create processed model object using direct properties from model where possible
            const processedModel = {
              id: model.id,
              // Prioritize model.name, fallback to display_name, then normalize id
              name: model.name || model.display_name || normalizeModelName(model), 
              provider, // Use provider from the outer loop
              type: model.type || type, // Prefer model.type if present
              version: model.version || version, // Prefer model.version if present
              category,
              groupingKey: model.type || groupingKey, 
              is_experimental: model.is_experimental,
              is_multimodal: model.is_multimodal,
              capabilities: model.capabilities,
              // Get family and series directly from the model
              family: model.family || type, 
              series: model.series || version // Fallback to version if series is missing
            };
            
            // Add to all models list
            allModels.push(processedModel);
            
            // Add to experimental models if applicable
            if (model.is_experimental) {
              experimentalModels.push(processedModel);
            }
            
            // Add to processed models structure (using the determined category)
            if (!processedModels[category]) {
              processedModels[category] = {};
            }
            
            if (!processedModels[category][provider]) {
              processedModels[category][provider] = {};
            }
            
            // Use the determined type (model.type or typeGroup.group_value) as the grouping key
            const currentTypeKey = processedModel.type; // Use the 'type' field from processedModel
            if (!processedModels[category][provider][currentTypeKey]) {
              processedModels[category][provider][currentTypeKey] = [];
            }
            
            processedModels[category][provider][currentTypeKey].push(processedModel);
          });
          
          // No longer needed - don't sort models, keep them in original order
        });
      });
    });
    
    return {
      allModels,
      processedModels,
      experimentalModels
    };
  }, [normalizeModelName]);
  
  // Update category filter
  const updateCategoryFilter = useCallback((category, isChecked) => {
    setModelFilter(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: isChecked
      }
    }));
  }, []);
  
  // Update search filter
  const updateSearchFilter = useCallback((searchText) => {
    setModelFilter(prev => ({
      ...prev,
      search: searchText
    }));
  }, []);
  
  // Select a model
  const selectModel = useCallback((model) => {
    // Check if the model is actually different to prevent unnecessary updates
    if (selectedModel?.id !== model?.id) { 
    setSelectedModel(model);
    }
  }, [selectedModel]);
  
  // Fetch models from API
  const fetchModels = useCallback(async () => {
    if (!apiStatus.online) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cache = getCachedModels();
      if (cache) {
        setAllModels(cache.allModels);
        setProcessedModels(cache.processedModels);
        setExperimentalModels(cache.experimentalModels);
        
        // Select first model if none selected
        if (!selectedModel && cache.allModels.length > 0) {
          setSelectedModel(cache.allModels[0]);
        }
        
        setIsLoading(false);
        return;
      }
      
      // Fetch from API if no valid cache
      const response = await fetch(`${apiUrl}/models/classified`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('here is the API Response:', data);
      const processed = processModels(data);
      
      setAllModels(processed.allModels);
      setProcessedModels(processed.processedModels);
      setExperimentalModels(processed.experimentalModels);
      
      // Select first model if none selected
      if (!selectedModel && processed.allModels.length > 0) {
        setSelectedModel(processed.allModels[0]);
      }
      
      // Cache the results
      cacheModels(processed);
    } catch (error) {
      console.error('Error fetching models:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiStatus.online, apiUrl, cacheModels, getCachedModels, processModels]);
  
  // Fetch models when API comes online
  useEffect(() => {
    if (apiStatus.online) {
      fetchModels();
    }
  }, [apiStatus.online, fetchModels]);
  
  // Create toggleExperimentalModels callback at the top level
  const toggleExperimentalModels = useCallback(() => {
    setShowExperimental(prev => !prev);
  }, [setShowExperimental]);
  
  // Main model context value - no filter state
  const modelValue = useMemo(() => ({
    allModels,
    processedModels,
    experimentalModels,
    selectedModel,
    isLoading,
    error,
    showExperimental,
    isExperimentalModelsEnabled: showExperimental,
    toggleExperimentalModels,
    setShowExperimental,
    selectModel,
    refreshModels: fetchModels
  }), [
    allModels,
    processedModels,
    experimentalModels,
    selectedModel,
    isLoading,
    error,
    showExperimental,
    toggleExperimentalModels,
    setShowExperimental,
    selectModel,
    fetchModels
  ]);
  
  // Filter context value - only filter-related state
  const filterValue = useMemo(() => ({
    modelFilter,
    updateCategoryFilter,
    updateSearchFilter
  }), [
    modelFilter,
    updateCategoryFilter,
    updateSearchFilter
  ]);
  
  return (
    <ModelContext.Provider value={modelValue}>
      <ModelFilterContext.Provider value={filterValue}>
        {children}
      </ModelFilterContext.Provider>
    </ModelContext.Provider>
  );
}; 