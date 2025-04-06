import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { selectedModel } from './models';

// Default API settings
const DEFAULT_API_SETTINGS = {
  endpointUrl: '/api/chat',
  apiKey: '', // Should be stored securely
  authToken: '', // For authentication with the backend
  temperature: 0.7,
  maxTokens: null, // Default to model's max tokens if null
  useStreamingApi: true,
  systemPrompt: 'You are a helpful assistant.',
  requestTimeout: 60000, // 60 seconds
  customHeaders: {}
};

// Create API settings store
function createApiStore() {
  // Load settings from localStorage if available
  let initialSettings = DEFAULT_API_SETTINGS;
  
  if (browser) {
    try {
      const savedSettings = localStorage.getItem('apiSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Don't load the API key from localStorage in a production environment
        // This is just for the development convenience
        initialSettings = {
          ...DEFAULT_API_SETTINGS,
          ...parsed,
          apiKey: process.env.NODE_ENV === 'production' ? '' : (parsed.apiKey || '')
        };
      }
    } catch (error) {
      console.error('Error loading API settings from localStorage:', error);
    }
  }
  
  const { subscribe, set, update } = writable({
    ...initialSettings,
    isLoading: false,
    error: null
  });
  
  return {
    subscribe,
    
    // Update a single API setting
    updateSetting: (key, value) => {
      update(state => {
        const newState = { ...state, [key]: value };
        
        // Save to localStorage (except in certain cases)
        if (browser && key !== 'isLoading' && key !== 'error') {
          try {
            // Create a version of the state without sensitive or temporary data
            const stateToSave = { ...newState };
            delete stateToSave.isLoading;
            delete stateToSave.error;
            // In production, don't save sensitive data to localStorage
            if (process.env.NODE_ENV === 'production') {
              delete stateToSave.apiKey;
              delete stateToSave.authToken;
            }
            
            localStorage.setItem('apiSettings', JSON.stringify(stateToSave));
          } catch (error) {
            console.error('Error saving API settings to localStorage:', error);
          }
        }
        
        return newState;
      });
    },
    
    // Update multiple API settings at once
    updateSettings: (newSettings) => {
      update(state => {
        const newState = { ...state, ...newSettings };
        
        // Save to localStorage
        if (browser) {
          try {
            // Create a version of the state without sensitive or temporary data
            const stateToSave = { ...newState };
            delete stateToSave.isLoading;
            delete stateToSave.error;
            // In production, don't save sensitive data to localStorage
            if (process.env.NODE_ENV === 'production') {
              delete stateToSave.apiKey;
              delete stateToSave.authToken;
            }
            
            localStorage.setItem('apiSettings', JSON.stringify(stateToSave));
          } catch (error) {
            console.error('Error saving API settings to localStorage:', error);
          }
        }
        
        return newState;
      });
    },
    
    // Set loading state
    setLoading: (isLoading) => {
      update(state => ({ ...state, isLoading }));
    },
    
    // Set error state
    setError: (error) => {
      update(state => ({ ...state, error: typeof error === 'string' ? error : error.message }));
    },
    
    // Clear error state
    clearError: () => {
      update(state => ({ ...state, error: null }));
    },
    
    // Reset API settings to defaults
    resetSettings: () => {
      update(state => {
        const newState = { 
          ...DEFAULT_API_SETTINGS,
          isLoading: state.isLoading,
          error: null
        };
        
        if (browser) {
          try {
            localStorage.removeItem('apiSettings');
          } catch (error) {
            console.error('Error removing API settings from localStorage:', error);
          }
        }
        
        return newState;
      });
    }
  };
}

// Create and export the API store
export const apiStore = createApiStore();

// Derived store for effective API settings including model-specific adjustments
export const effectiveApiSettings = derived(
  [apiStore, selectedModel],
  ([$apiStore, $selectedModel]) => {
    // Calculate effective max tokens based on model limits
    const effectiveMaxTokens = $apiStore.maxTokens || $selectedModel.maxTokens;
    
    // Adjust API endpoint based on provider if needed
    let endpointUrl = $apiStore.endpointUrl;
    if ($selectedModel.provider === 'anthropic') {
      endpointUrl = '/api/chat/anthropic';
    } else if ($selectedModel.provider === 'openai') {
      endpointUrl = '/api/chat/openai';
    }
    
    return {
      ...$apiStore,
      maxTokens: effectiveMaxTokens,
      endpointUrl
    };
  }
);