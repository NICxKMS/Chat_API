import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from './ApiContext';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Cache expiry time in milliseconds (5 minutes)
const CACHE_EXPIRY_TIME = 5 * 60 * 1000;

// Create model context
const ModelContext = createContext();

// Custom hook for using model context
export const useModel = () => {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
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
  
  // Filter state
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
  
  // Sort models based on provider-specific rules
  const sortModelsByProvider = useCallback((provider, models) => {
    if (!models || !Array.isArray(models)) return [];
    
    const providerLower = provider.toLowerCase();
    
    // OpenAI sorting logic
    if (providerLower === 'openai') {
      return models.sort((a, b) => {
        // Mini comes before O series
        const aIsMini = a.name.toLowerCase().includes('mini');
        const bIsMini = b.name.toLowerCase().includes('mini');
        
        if (aIsMini && !bIsMini) return -1;
        if (!aIsMini && bIsMini) return 1;
        
        // Shorter names come first
        return a.name.length - b.name.length;
      });
    }
    
    // Gemini sorting logic
    if (providerLower === 'gemini') {
      return models.sort((a, b) => {
        // 'latest' versions first
        const aIsLatest = a.version.toLowerCase().includes('latest');
        const bIsLatest = b.version.toLowerCase().includes('latest');
        
        if (aIsLatest && !bIsLatest) return -1;
        if (!aIsLatest && bIsLatest) return 1;
        
        // Sort by version descending
        return b.version.localeCompare(a.version);
      });
    }
    
    // Anthropic sorting logic
    if (providerLower === 'anthropic') {
      return models.sort((a, b) => {
        const modelTiers = {
          'sonnet': 1,
          'opus': 2,
          'haiku': 3
        };
        
        // Get model tiers from name
        const getModelTier = (model) => {
          const nameLower = model.name.toLowerCase();
          for (const [tier, value] of Object.entries(modelTiers)) {
            if (nameLower.includes(tier)) return value;
          }
          return 999; // Unknown tier
        };
        
        const aTier = getModelTier(a);
        const bTier = getModelTier(b);
        
        return aTier - bTier;
      });
    }
    
    // Default sorting for other providers
    return models.sort((a, b) => a.name.localeCompare(b.name));
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
              groupingKey: model.type || groupingKey, // Use model.family if present, fallback to type
              is_experimental: model.is_experimental,
              is_multimodal: model.is_multimodal,
              capabilities: model.capabilities,
              // Get family and series directly from the model
              family: model.family || type, // Fallback to type if family is missing
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
          
          // --- Start: Simplified Sorting Logic within Version Group ---
          // Get all categories populated by models in this version group
          const populatedCategories = new Set();
          if (versionGroup.models && Array.isArray(versionGroup.models)) {
            versionGroup.models.forEach(model => {
               let category = 'Chat';
               if (model.type && model.type.toLowerCase() === 'image generation') {
                 category = 'Image';
               } else if (model.type && model.type.toLowerCase() === 'embedding') {
                  category = 'Embedding';
               } else if (model.capabilities && model.capabilities.includes('embedding')) {
                  category = 'Embedding';
               } else if (model.capabilities && model.capabilities.includes('Image Generation')) {
                 category = 'Image';
               }
               populatedCategories.add(category);
            });
          }

          // Sort models within each relevant category/provider/groupingKey combination
          populatedCategories.forEach(category => {
            // Iterate through the grouping keys actually populated within this category/provider
             if (processedModels[category]?.[provider]) {
               // Use the type keys (e.g., 'GPT 4', 'GPT 3.5') instead of groupingKey
               Object.keys(processedModels[category][provider]).forEach(currentTypeKey => { 
                   // Check if this specific group was populated by the current versionGroup's models
                   // We need to filter the models in the group to see if any came from this versionGroup iteration.
                   // A simpler approach might be to sort *after* all models are processed, but let's try adapting this.

                   // Find the models just added in *this* iteration for sorting
                   const modelsToSort = processedModels[category][provider][currentTypeKey].filter(pm => 
                      versionGroup.models.some(m => m.id === pm.id)
                   );

                   // Only sort if there are models from this iteration in the group
                   if (modelsToSort.length > 0) {
                      // Sort the *entire* group, as models from different versions might be in the same group now
                      processedModels[category][provider][currentTypeKey] = 
                         sortModelsByProvider(
                           provider, 
                           processedModels[category][provider][currentTypeKey] // Sort the whole group based on its type key
                         );
                   }
                });
             }
          });
           // --- End: Simplified Sorting Logic within Version Group ---
        });
      });
    });
    
    return {
      allModels,
      processedModels,
      experimentalModels
    };
  }, [normalizeModelName, sortModelsByProvider]);
  
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
    setSelectedModel(model);
  }, []);
  
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
  }, [apiStatus.online, apiUrl, cacheModels, getCachedModels, processModels, selectedModel]);
  
  // Fetch models when API comes online
  useEffect(() => {
    if (apiStatus.online) {
      fetchModels();
    }
  }, [apiStatus.online, fetchModels]);
  
  // Context value
  const value = {
    allModels,
    processedModels,
    experimentalModels,
    selectedModel,
    isLoading,
    error,
    showExperimental,
    modelFilter,
    isExperimentalModelsEnabled: showExperimental,
    toggleExperimentalModels: () => setShowExperimental(prev => !prev),
    setShowExperimental,
    updateCategoryFilter,
    updateSearchFilter,
    selectModel,
    refreshModels: fetchModels
  };
  
  return (
    <ModelContext.Provider value={value}>
      {children}
    </ModelContext.Provider>
  );
}; 