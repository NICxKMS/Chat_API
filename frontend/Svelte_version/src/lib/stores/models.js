import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Define available models
const AVAILABLE_MODELS = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'The most powerful OpenAI model for complex tasks',
    maxTokens: 8192,
    provider: 'openai'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and efficient OpenAI model for most tasks',
    maxTokens: 4096,
    provider: 'openai'
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Anthropic\'s most powerful model for complex reasoning',
    maxTokens: 200000,
    provider: 'anthropic'
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    description: 'Balanced quality and speed from Anthropic',
    maxTokens: 200000,
    provider: 'anthropic'
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fast and efficient model from Anthropic',
    maxTokens: 200000,
    provider: 'anthropic'
  }
];

// Initialize models store
function createModelsStore() {
  // Get default model from localStorage or use first available model
  let initialModelId = AVAILABLE_MODELS[0].id;
  
  if (browser) {
    const savedModelId = localStorage.getItem('selectedModel');
    if (savedModelId && AVAILABLE_MODELS.some(model => model.id === savedModelId)) {
      initialModelId = savedModelId;
    }
  }
  
  const { subscribe, set, update } = writable({
    availableModels: AVAILABLE_MODELS,
    selectedModelId: initialModelId,
    isLoading: false,
    error: null
  });
  
  return {
    subscribe,
    
    // Select a model
    selectModel: (modelId) => {
      update(state => {
        // Verify model exists
        if (!state.availableModels.some(model => model.id === modelId)) {
          return {
            ...state,
            error: `Model with ID '${modelId}' not found`
          };
        }
        
        // Save to localStorage
        if (browser) {
          localStorage.setItem('selectedModel', modelId);
        }
        
        return {
          ...state,
          selectedModelId: modelId,
          error: null
        };
      });
    },
    
    // Add custom models (e.g., from an API)
    addModels: (newModels) => {
      update(state => {
        // Filter out duplicates by ID
        const existingIds = new Set(state.availableModels.map(m => m.id));
        const filteredNewModels = newModels.filter(m => !existingIds.has(m.id));
        
        return {
          ...state,
          availableModels: [...state.availableModels, ...filteredNewModels]
        };
      });
    },
    
    // Set loading state
    setLoading: (isLoading) => {
      update(state => ({ ...state, isLoading }));
    },
    
    // Set error state
    setError: (error) => {
      update(state => ({ ...state, error }));
    },
    
    // Clear error state
    clearError: () => {
      update(state => ({ ...state, error: null }));
    }
  };
}

// Create and export the models store
export const modelsStore = createModelsStore();

// Derived store for the currently selected model object
export const selectedModel = derived(
  modelsStore,
  $modelsStore => $modelsStore.availableModels.find(
    model => model.id === $modelsStore.selectedModelId
  ) || $modelsStore.availableModels[0]
);

// Derived store for providers
export const modelProviders = derived(
  modelsStore,
  $modelsStore => {
    const providers = new Set($modelsStore.availableModels.map(model => model.provider));
    return Array.from(providers);
  }
);

// Derived store for models grouped by provider
export const modelsByProvider = derived(
  modelsStore,
  $modelsStore => {
    const grouped = {};
    
    $modelsStore.availableModels.forEach(model => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    });
    
    return grouped;
  }
);