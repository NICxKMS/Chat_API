import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApi } from './ApiContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAuth } from './AuthContext';
import { useCacheToggle } from '../hooks/useCacheToggle';
import { useToast } from './ToastContext';
import { useLoading } from './LoadingContext';

// Cache expiry time in milliseconds (5 days)
const CACHE_EXPIRY_TIME = 5 * 24 * 60 * 60 * 1000;

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
  const { cacheEnabled } = useCacheToggle();
  const { apiUrl } = useApi();
  const { idToken } = useAuth();
  const { showToast } = useToast();
  
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
  
  // Sync with global loading context
  const [, startModelsLoading, stopModelsLoading] = useLoading('models');
  useEffect(() => {
    if (isLoading) startModelsLoading();
    else stopModelsLoading();
  }, [isLoading, startModelsLoading, stopModelsLoading]);
  
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
  
  // Fetch models from API, optionally using auth token or override token
  const fetchModels = useCallback(async (authRequired = false, overrideToken = null) => {
    setIsLoading(true);
    setError(null);
    
    console.log(`Fetching models from API (auth: ${authRequired})...`);
    try {
      const headers = { 'Accept': 'application/json' };
      if (authRequired) {
        // Prefer overrideToken (cached) over current idToken
        const tokenToUse = overrideToken || idToken;
        if (tokenToUse) {
          headers['Authorization'] = `Bearer ${tokenToUse}`;
        }
      }
      const modelsUrl = new URL('/api/models/classified', apiUrl).toString();
      const response = await fetch(modelsUrl, { headers });
      console.log('Models response:', response);
      
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
          showToast({ type: 'error', message: msg.error });
        } else {
          const {
            allModels: fetchedAllModels,
            processedModels: fetchedProcessedModels,
            experimentalModels: fetchedExperimentalModels
          } = msg;
          if (cacheEnabled) {
            const rawPrev = localStorage.getItem('modelDropdownCache');
            let prevCache;
            try { prevCache = JSON.parse(rawPrev); } catch { prevCache = null; }
            const changed = !prevCache ||
              JSON.stringify(prevCache.allModels) !== JSON.stringify(fetchedAllModels) ||
              JSON.stringify(prevCache.processedModels) !== JSON.stringify(fetchedProcessedModels) ||
              JSON.stringify(prevCache.experimentalModels) !== JSON.stringify(fetchedExperimentalModels);
            if (changed) {
              setAllModels(fetchedAllModels);
              setProcessedModels(fetchedProcessedModels);
              setExperimentalModels(fetchedExperimentalModels);
              cacheModels({ allModels: fetchedAllModels, processedModels: fetchedProcessedModels, experimentalModels: fetchedExperimentalModels });
            }
          } else {
            setAllModels(fetchedAllModels);
            setProcessedModels(fetchedProcessedModels);
            setExperimentalModels(fetchedExperimentalModels);
          }
          // Initial model selection moved to a separate useEffect
        }
        setIsLoading(false);
        worker.terminate();
      };
      worker.onerror = (err) => {
        console.error('[ModelContext] Worker unexpected error:', err);
        setError(err.message);
        showToast({ type: 'error', message: err.message });
        setIsLoading(false);
        worker.terminate();
      };
    } catch (err) {
      console.error('Failed to fetch or process models:', err);
      setError(err.message || 'Failed to load model data');
      showToast({ type: 'error', message: err.message || 'Failed to load model data' });
      // Attempt to load from potentially expired cache as a last resort?
    }
  }, [apiUrl, cacheModels, idToken, cacheEnabled, showToast]);
  
  // Initial fetch once on mount
  const initialFetchDoneRef = useRef(false);
  // track if we've already fetched models with authentication
  const didAuthFetchRef = useRef(false);

  useEffect(() => {
    if (!initialFetchDoneRef.current) {
      if (cacheEnabled) {
        const rawCache = localStorage.getItem('modelDropdownCache');
        let parsedCache;
        try { parsedCache = JSON.parse(rawCache); } catch { parsedCache = null; }
        if (parsedCache && window.isCacheValid(parsedCache)) {
          setAllModels(parsedCache.allModels);
          setProcessedModels(parsedCache.processedModels);
          setExperimentalModels(parsedCache.experimentalModels);
          setIsLoading(false);
        }
      }
      let cachedToken = null;
      try { cachedToken = localStorage.getItem('idToken'); } catch {}
      if (cachedToken) {
        // initial authenticated fetch
        didAuthFetchRef.current = true;
        fetchModels(true, cachedToken);
      } else {
        // initial unauthenticated fetch
        fetchModels(false);
      }
      initialFetchDoneRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After login, fetch authenticated models
  useEffect(() => {
    // only fetch once after obtaining idToken if not already done
    if (initialFetchDoneRef.current && idToken && !didAuthFetchRef.current) {
      didAuthFetchRef.current = true;
      fetchModels(true);
    }
  }, [idToken, fetchModels]);
  
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