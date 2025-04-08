import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from './ApiContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAuth } from './AuthContext';

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
  const { apiUrl } = useApi();
  const { idToken, isAuthenticated } = useAuth();
  
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
      cache.processedModels &&
      cache.experimentalModels
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
        experimentalModels: cache.experimentalModels,
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
  
  // Process hierarchical model groups (Restored)
  const processModels = useCallback((data) => {
    if (!data || !data.hierarchical_groups) {
      console.error('Invalid hierarchical model data format received:', data);
      throw new Error('Invalid model data format');
    }
    
    const allModels = [];
    const experimentalModels = [];
    const processedModels = {}; // Structure: { Category: { Provider: { Type: [Model] } } }
    
    data.hierarchical_groups.forEach(providerGroup => {
      const provider = providerGroup.group_value;
      
      if (!providerGroup.children || !Array.isArray(providerGroup.children)) return;

      providerGroup.children.forEach(typeGroup => {
        const type = typeGroup.group_value; 

        if (!typeGroup.children || !Array.isArray(typeGroup.children)) return;
        
        typeGroup.children.forEach(versionGroup => {
          const version = versionGroup.group_value; 
          
          if (!versionGroup.models || !Array.isArray(versionGroup.models)) return;

          versionGroup.models.forEach(model => {
            // Determine category (simplified assumption, adjust if needed)
            let category = 'Chat';
            if (model.type && model.type.toLowerCase().includes('image')) {
              category = 'Image';
            } else if (model.type && model.type.toLowerCase().includes('embedding')) {
               category = 'Embedding';
            }
            
            const processedModel = {
              id: model.id,
              name: model.name || model.display_name || normalizeModelName(model), 
              provider,
              type: model.type || type,
              version: model.version || version,
              category,
              is_experimental: model.is_experimental,
              is_multimodal: model.is_multimodal,
              capabilities: model.capabilities,
              family: model.family || type, 
              series: model.series || version
            };
            
            allModels.push(processedModel);
            
            if (model.is_experimental) {
              experimentalModels.push(processedModel);
            }
            
            if (!processedModels[category]) processedModels[category] = {};
            if (!processedModels[category][provider]) processedModels[category][provider] = {};
            if (!processedModels[category][provider][type]) processedModels[category][provider][type] = [];
            processedModels[category][provider][type].push(processedModel);
          });
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
    setIsLoading(true);
    setError(null);
    
    // Check cache first
    const cachedData = getCachedModels();
    if (cachedData) {
      console.log("Loading models from valid cache.");
      setAllModels(cachedData.allModels);
      setProcessedModels(cachedData.processedModels);
      setExperimentalModels(cachedData.experimentalModels);
      // Restore previous logic: select first model if none selected
      if (!selectedModel && cachedData.allModels.length > 0) {
        setSelectedModel(cachedData.allModels[0]);
        }
        setIsLoading(false);
      return; // Don't fetch if cache is valid
    }

    console.log("Fetching models from API...");
    try {
      // Prepare request headers conditionally
      const headers = {
        'Accept': 'application/json'
      };
      if (isAuthenticated && idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // Construct URL safely
      const modelsUrl = new URL('/api/models/classified', apiUrl).toString();
      const response = await fetch(modelsUrl, { headers });
      console.log('Models response:', response);
      
      if (!response.ok) {
        let errorMsg = `Error fetching models: ${response.status}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      const data = await response.json();

      // Process the fetched data using the new function
      const { allModels: fetchedAllModels, processedModels: fetchedProcessedModels, experimentalModels: fetchedExperimentalModels } = processModels(data);
      
      setAllModels(fetchedAllModels);
      setProcessedModels(fetchedProcessedModels);
      setExperimentalModels(fetchedExperimentalModels);

      // Cache the newly fetched data
      cacheModels({
        allModels: fetchedAllModels,
        processedModels: fetchedProcessedModels,
        experimentalModels: fetchedExperimentalModels
      });
      
      // Restore previous logic: Select first model if none selected
      if (!selectedModel && fetchedAllModels.length > 0) {
        setSelectedModel(fetchedAllModels[0]);
      }
      
    } catch (err) {
      console.error('Failed to fetch or process models:', err);
      setError(err.message || 'Failed to load model data');
      // Attempt to load from potentially expired cache as a last resort?
    } finally {
      setIsLoading(false);
    }
  }, [
    apiUrl, 
    getCachedModels, 
    cacheModels, 
    processModels, 
    normalizeModelName,
    selectedModel,
    isAuthenticated, 
    idToken
  ]);
  
  // Fetch models on initial mount
  useEffect(() => {
    fetchModels();
    // Run only once on mount, or when fetchModels function reference changes
    // (which it shouldn't unless dependencies like apiUrl change)
  }, [fetchModels]);
  
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