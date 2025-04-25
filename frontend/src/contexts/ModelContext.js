import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from './ApiContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAuth } from './AuthContext';

// Cache expiry time in milliseconds (5 minutes)
const CACHE_EXPIRY_TIME = 5*60 * 60 * 1000;

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
  const { idToken } = useAuth();
  
  // State for model data
  const [allModels, setAllModels] = useState([]);
  const [processedModels, setProcessedModels] = useState({});
  const [experimentalModels, setExperimentalModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
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
  
  // Expose isCacheValid function for external access
  useEffect(() => {
    // Skip during server-side rendering
    if (typeof window === 'undefined') return;
    window.isCacheValid = isCacheValid;
    
    return () => {
      delete window.isCacheValid;
    };
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
  }, [selectedModel, setSelectedModel]);
  
  // Fetch models from API
  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    console.log("Fetching models from API...");
    try {
      // For initial load, fetch without auth to avoid Firebase initialization
      // On subsequent loads, use auth token if available
      const headers = {
        'Accept': 'application/json'
      };

      // Only add authorization header if not initial load and token exists
      if (!isInitialLoad && idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // Construct URL safely
      const modelsUrl = new URL('/api/models/classified', apiUrl).toString();
      const response = await fetch(modelsUrl, { headers });
      console.log('Models response:', response);
      
      // After first successful fetch, mark initial load complete
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
      
      if (!response.ok) {
        let errorMsg = `Error fetching models: ${response.status}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      const rawData = await response.json();
      console.log("[ModelContext] Spawning worker for model processing...");
      // Offload model processing to Web Worker
      const worker = new Worker(new URL('../workers/modelProcessor.js', import.meta.url), { type: 'module' });
      worker.postMessage(rawData);
      worker.onmessage = ({ data: msg }) => {
        if (msg.error) {
          console.error('[ModelContext] Worker error:', msg.error);
          setError(msg.error);
        } else {
          const {
            allModels: fetchedAllModels,
            processedModels: fetchedProcessedModels,
            experimentalModels: fetchedExperimentalModels
          } = msg;
          setAllModels(fetchedAllModels);
          setProcessedModels(fetchedProcessedModels);
          setExperimentalModels(fetchedExperimentalModels);
          // Cache the processed results
          cacheModels({
            allModels: fetchedAllModels,
            processedModels: fetchedProcessedModels,
            experimentalModels: fetchedExperimentalModels
          });
          // Initial model selection moved to a separate useEffect
        }
        setIsLoading(false);
        worker.terminate();
      };
      worker.onerror = (err) => {
        console.error('[ModelContext] Worker unexpected error:', err);
        setError(err.message);
        setIsLoading(false);
        worker.terminate();
      };
    } catch (err) {
      console.error('Failed to fetch or process models:', err);
      setError(err.message || 'Failed to load model data');
      // Attempt to load from potentially expired cache as a last resort?
    }
  }, [
    apiUrl,
    cacheModels,
    idToken,
    isInitialLoad
  ]);
  
  // Fetch models on initial mount
  useEffect(() => {
    fetchModels();
    // Run only once on mount, or when fetchModels function reference changes
    // (which it shouldn't unless dependencies like apiUrl change)
  }, [fetchModels]);
  
  // Set initial model after models are loaded
  useEffect(() => {
    // Select first model if none selected and models are loaded
    if (!selectedModel && allModels.length > 0) {
      setSelectedModel(allModels[0]);
    }
  }, [allModels, selectedModel]);
  
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