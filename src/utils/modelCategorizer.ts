/**
 * Model Categorizer Utility
 * 
 * Organizes AI models from multiple providers into a structured multi-level dropdown format.
 * 
 * - Level 1: Provider (OpenAI, Google, Anthropic, etc.)
 * - Level 2: Model Family (GPT-4, Gemini-1.5, Claude-3, etc.)
 * - Level 3: Model Type (Flash, Pro, Turbo, etc.)
 * - Level 4: Specific Model Version
 */

// Define TypeScript interfaces for the data structures
interface ProviderModels {
  models: string[];
  defaultModel?: string;
  error?: string;
}

interface ModelsByProvider {
  [providerName: string]: ProviderModels;
}

interface ModelTypeData {
  latest: string | null;
  other_versions: string[];
}

interface ModelsByType {
  [typeName: string]: ModelTypeData;
}

interface ModelsByFamily {
  [familyName: string]: string[];
}

interface StructuredModels {
  [providerName: string]: {
    [familyName: string]: ModelsByType;
  };
}

// Model metadata for consistent categorization
interface ModelMetadata {
  family: string;
  type: string;
  capabilities: string[];
  contextSize?: number;
  releaseDate?: string;
  isExperimental?: boolean;
  generation?: number;
  version?: string;
}

// Registry of known models and their metadata
type ModelRegistry = Record<string, Record<string, ModelMetadata>>;

// Define the registry of models with their metadata
const MODEL_REGISTRY: ModelRegistry = {
  // OpenAI models
  'openai': {
    'gpt-4o': { 
      family: 'GPT-4', 
      type: 'GPT-4o', 
      capabilities: ['vision', 'function-calling'],
      contextSize: 128000,
      releaseDate: '2024-05',
      generation: 4
    },
    'gpt-4o-mini': { 
      family: 'GPT-4', 
      type: 'GPT-4o Mini', 
      capabilities: ['vision', 'function-calling'],
      contextSize: 128000,
      releaseDate: '2024-05',
      generation: 4
    },
    'gpt-4-turbo': { 
      family: 'GPT-4', 
      type: 'Turbo', 
      capabilities: ['function-calling'],
      contextSize: 128000,
      releaseDate: '2023-11',
      generation: 4
    },
    'gpt-4-vision-preview': { 
      family: 'GPT-4', 
      type: 'Vision', 
      capabilities: ['vision'],
      contextSize: 128000,
      releaseDate: '2023-10',
      generation: 4
    },
    'gpt-4': { 
      family: 'GPT-4', 
      type: 'Standard', 
      capabilities: ['function-calling'],
      contextSize: 8192,
      releaseDate: '2023-03',
      generation: 4
    },
    'gpt-4-32k': { 
      family: 'GPT-4', 
      type: '32K Context', 
      capabilities: ['function-calling'],
      contextSize: 32768,
      releaseDate: '2023-03',
      generation: 4
    },
    'gpt-3.5-turbo': { 
      family: 'GPT-3.5', 
      type: 'Turbo', 
      capabilities: ['function-calling'],
      contextSize: 16385,
      releaseDate: '2022-11',
      generation: 3.5
    },
    'gpt-3.5-turbo-16k': { 
      family: 'GPT-3.5', 
      type: 'Turbo 16K', 
      capabilities: ['function-calling'],
      contextSize: 16385,
      releaseDate: '2023-06',
      generation: 3.5
    }
  },
  
  // Gemini models
  'gemini': {
    'gemini-1.5-flash': { 
      family: 'Gemini 1.5', 
      type: 'Flash', 
      capabilities: ['vision', 'function-calling'],
      contextSize: 1000000,
      releaseDate: '2024-02',
      generation: 1.5
    },
    'gemini-1.5-pro': { 
      family: 'Gemini 1.5', 
      type: 'Pro', 
      capabilities: ['vision', 'function-calling'],
      contextSize: 1000000,
      releaseDate: '2024-02',
      generation: 1.5
    },
    'gemini-1.0-pro': { 
      family: 'Gemini 1.0', 
      type: 'Pro', 
      capabilities: ['vision'],
      contextSize: 32768,
      releaseDate: '2023-12',
      generation: 1.0
    }
  },
  
  // Anthropic models
  'anthropic': {
    'claude-3-opus-20240229': { 
      family: 'Claude 3', 
      type: 'Opus', 
      capabilities: ['vision', 'function-calling'],
      contextSize: 200000,
      releaseDate: '2024-02',
      version: '20240229',
      generation: 3
    },
    'claude-3-sonnet-20240229': { 
      family: 'Claude 3', 
      type: 'Sonnet', 
      capabilities: ['vision', 'function-calling'],
      contextSize: 200000,
      releaseDate: '2024-02',
      version: '20240229',
      generation: 3
    },
    'claude-3-haiku-20240307': { 
      family: 'Claude 3', 
      type: 'Haiku', 
      capabilities: ['vision', 'function-calling'],
      contextSize: 200000,
      releaseDate: '2024-03',
      version: '20240307',
      generation: 3
    }
  }
};

/**
 * Categorize models into a structured hierarchy for dropdown menus
 * 
 * @param modelsByProvider - Object mapping provider names to their models
 * @param includeExperimental - Whether to include experimental models
 * @returns Structured model hierarchy for UI rendering
 */
export function categorizeModels(
  modelsByProvider: ModelsByProvider,
  includeExperimental: boolean = false
): StructuredModels {
  const structuredModels: StructuredModels = {};

  // Process each provider's models
  Object.entries(modelsByProvider).forEach(([providerName, providerData]) => {
    const models = providerData.models || [];
    if (!models.length) return;

    const normalizedProviderName = normalizeProviderName(providerName);
    
    // Initialize provider in the structure
    structuredModels[normalizedProviderName] = {};
    
    // Group models by their families/categories
    const modelsByFamily = groupModelsByFamily(models, providerName);
    
    // Process each model family
    Object.entries(modelsByFamily).forEach(([family, familyModels]) => {
      // Group models by their types
      const modelsByType = groupModelsByType(familyModels, providerName);
      
      // Add family to provider
      structuredModels[normalizedProviderName][family] = modelsByType;
    });
  });

  return structuredModels;
}

/**
 * Get metadata for a model, either from registry or by analyzing the name
 * 
 * @param modelName - Model name
 * @param providerName - Provider name
 * @returns Model metadata
 */
function getModelMetadata(modelName: string, providerName: string): ModelMetadata {
  const registry = MODEL_REGISTRY[providerName.toLowerCase()];
  
  // Check if model exists in registry
  if (registry && registry[modelName]) {
    return registry[modelName];
  }
  
  // If not in registry, determine metadata from the model name
  return {
    family: determineModelFamily(modelName, providerName),
    type: determineModelType(modelName, providerName),
    capabilities: [],
    isExperimental: modelName.includes('experimental') || modelName.includes('preview')
  };
}

/**
 * Group models by their family/category
 * 
 * @param models - List of model names
 * @param providerName - Name of the provider
 * @returns Models grouped by family
 */
function groupModelsByFamily(models: string[], providerName: string): ModelsByFamily {
  const modelsByFamily: ModelsByFamily = {};
  
  models.forEach(model => {
    const metadata = getModelMetadata(model, providerName);
    const family = metadata.family;
    
    if (!modelsByFamily[family]) {
      modelsByFamily[family] = [];
    }
    
    modelsByFamily[family].push(model);
  });
  
  return modelsByFamily;
}

/**
 * Group models by their types and find the best version for each type
 * 
 * @param models - List of models in the same family
 * @param providerName - Name of the provider
 * @returns Models grouped by type with best version identified
 */
function groupModelsByType(models: string[], providerName: string): ModelsByType {
  const modelsByType: ModelsByType = {};
  
  models.forEach(model => {
    const metadata = getModelMetadata(model, providerName);
    const type = metadata.type;
    
    if (!modelsByType[type]) {
      modelsByType[type] = {
        latest: null,
        other_versions: []
      };
    }
    
    // Determine if this model is newer than current "latest"
    if (!modelsByType[type].latest || isNewerVersion(model, modelsByType[type].latest, providerName)) {
      // If we already had a "latest", move it to other_versions
      if (modelsByType[type].latest) {
        modelsByType[type].other_versions.push(modelsByType[type].latest);
      }
      modelsByType[type].latest = model;
    } else {
      // This is an older or alternative version
      modelsByType[type].other_versions.push(model);
    }
  });
  
  // Sort other_versions by newest first
  Object.values(modelsByType).forEach(typeData => {
    typeData.other_versions.sort((a, b) => 
      isNewerVersion(a, b, providerName) ? -1 : 1
    );
  });
  
  return modelsByType;
}

/**
 * Determine the family/category of a model
 * 
 * @param model - Model name
 * @param providerName - Provider name
 * @returns Model family name
 */
function determineModelFamily(model: string, providerName: string): string {
  const lowerModel = model.toLowerCase();
  const lowerProvider = providerName.toLowerCase();
  
  // Google/Gemini models
  if (lowerModel.includes('gemini') || lowerProvider === 'gemini') {
    // Check for major versions (1.0, 1.5, 2.0, etc.)
    if (lowerModel.includes('gemini-1.0')) return 'Gemini 1.0';
    if (lowerModel.includes('gemini-1.5')) return 'Gemini 1.5';
    if (lowerModel.includes('gemini-2.0')) return 'Gemini 2.0';
    if (lowerModel.includes('gemini-2.5')) return 'Gemini 2.5';
    if (lowerModel.includes('gemini-3')) return 'Gemini 3.0';
    return 'Gemini';
  }
  
  // OpenAI models
  if (lowerProvider === 'openai') {
    if (lowerModel.includes('gpt-4')) return 'GPT-4';
    if (lowerModel.includes('gpt-3.5')) return 'GPT-3.5';
    if (lowerModel.includes('dall-e')) return 'DALL-E';
    if (lowerModel.includes('embedding')) return 'Embedding';
    if (lowerModel.includes('moderation')) return 'Moderation';
    if (lowerModel.includes('tts')) return 'Speech';
    if (lowerModel.includes('whisper')) return 'Audio';
    if (lowerModel.includes('gpt-')) return lowerModel.split('-')[1].toUpperCase(); // For future GPT versions
    return 'Chat';
  }
  
  // Anthropic models
  if (lowerProvider === 'anthropic' || lowerModel.includes('claude')) {
    if (lowerModel.includes('claude-3')) return 'Claude 3';
    if (lowerModel.includes('claude-2')) return 'Claude 2';
    if (lowerModel.includes('claude-1')) return 'Claude 1';
    return 'Claude';
  }
  
  // Mistral models
  if (lowerModel.includes('mistral')) {
    return 'Mistral';
  }
  
  // Cohere models
  if (lowerModel.includes('cohere') || lowerProvider === 'cohere') {
    if (lowerModel.includes('embed')) return 'Embedding';
    return 'Text';
  }
  
  // Meta/Llama models
  if (lowerModel.includes('llama') || lowerModel.includes('meta/')) {
    return 'Llama';
  }
  
  // OpenRouter typically exposes models with provider/model pattern
  if (lowerProvider === 'openrouter') {
    const parts = model.split('/');
    if (parts.length > 1) {
      // Return the provider part as the family
      return capitalizeFirstLetter(parts[0]);
    }
  }
  
  // Default to Other family
  return 'Other';
}

/**
 * Determine the type of a model within its family
 * 
 * @param model - Model name
 * @param providerName - Provider name
 * @returns Model type
 */
function determineModelType(model: string, providerName: string): string {
  const lowerModel = model.toLowerCase();
  const lowerProvider = providerName.toLowerCase();
  
  // Check if model is in registry
  const registry = MODEL_REGISTRY[lowerProvider];
  if (registry && registry[model]) {
    return registry[model].type;
  }
  
  // Google/Gemini models
  if (lowerModel.includes('gemini')) {
    if (lowerModel.includes('pro-vision')) return 'Pro Vision';
    if (lowerModel.includes('flash-thinking')) return 'Flash Thinking';
    if (lowerModel.includes('flash-lite')) return 'Flash Lite';
    if (lowerModel.includes('flash-8b')) return 'Flash 8B';
    if (lowerModel.includes('flash')) return 'Flash';
    if (lowerModel.includes('pro')) return 'Pro';
    if (lowerModel.includes('embedding')) return 'Embedding';
    if (lowerModel.includes('exp')) return 'Experimental';
    return 'Standard';
  }
  
  // OpenAI models
  if (lowerProvider === 'openai') {
    // GPT-4 family
    if (lowerModel.includes('gpt-4')) {
      if (lowerModel.includes('gpt-4o-mini')) return 'GPT-4o Mini';
      if (lowerModel.includes('gpt-4o')) return 'GPT-4o';
      if (lowerModel.includes('gpt-4-turbo-preview')) return 'Turbo Preview';
      if (lowerModel.includes('gpt-4-turbo')) return 'Turbo';
      if (lowerModel.includes('gpt-4-vision')) return 'Vision';
      if (lowerModel.includes('gpt-4-32k')) return '32K Context';
      return 'Standard';
    }
    
    // GPT-3.5 family
    if (lowerModel.includes('gpt-3.5')) {
      if (lowerModel.includes('gpt-3.5-turbo-16k')) return 'Turbo 16K';
      if (lowerModel.includes('gpt-3.5-turbo-instruct')) return 'Turbo Instruct';
      if (lowerModel.includes('gpt-3.5-turbo')) return 'Turbo';
      return 'Standard';
    }
    
    // Other OpenAI models
    if (lowerModel.includes('dall-e-3')) return 'DALL-E 3';
    if (lowerModel.includes('dall-e-2')) return 'DALL-E 2';
    if (lowerModel.includes('tts-1-hd')) return 'TTS HD';
    if (lowerModel.includes('tts-1')) return 'TTS Standard';
    if (lowerModel.includes('whisper')) return 'Whisper';
    if (lowerModel.includes('text-embedding-3')) return 'Text Embedding 3';
    if (lowerModel.includes('text-embedding-ada')) return 'Ada Embedding';
    return capitalizeFirstLetter(model.split('-').pop() || 'Standard');
  }
  
  // Anthropic models
  if (lowerProvider === 'anthropic' || lowerModel.includes('claude')) {
    if (lowerModel.includes('opus')) return 'Opus';
    if (lowerModel.includes('sonnet')) return 'Sonnet';
    if (lowerModel.includes('haiku')) return 'Haiku';
    if (lowerModel.includes('claude-3')) return 'Claude 3';
    if (lowerModel.includes('claude-2')) return 'Claude 2';
    if (lowerModel.includes('claude-1')) return 'Claude 1';
    if (lowerModel.includes('claude-instant')) return 'Claude Instant';
    return 'Standard';
  }
  
  // Mistral models
  if (lowerModel.includes('mistral')) {
    if (lowerModel.includes('large')) return 'Large';
    if (lowerModel.includes('medium')) return 'Medium';
    if (lowerModel.includes('small')) return 'Small';
    if (lowerModel.includes('8x7b')) return '8x7B';
    if (lowerModel.includes('7b')) return '7B';
    return 'Standard';
  }
  
  // Meta/Llama models
  if (lowerModel.includes('llama') || lowerModel.includes('meta/')) {
    if (lowerModel.includes('code')) return 'Code';
    if (lowerModel.includes('instruct')) return 'Instruct';
    if (lowerModel.includes('70b')) return '70B';
    if (lowerModel.includes('13b')) return '13B';
    if (lowerModel.includes('8b')) return '8B';
    if (lowerModel.includes('7b')) return '7B';
    return 'Standard';
  }
  
  // OpenRouter typically exposes models with provider/model pattern
  if (lowerProvider === 'openrouter') {
    const parts = model.split('/');
    if (parts.length > 1) {
      // Recursively determine the type using the model part
      return determineModelType(parts[1], parts[0]);
    }
  }
  
  // For other or unclear models, extract numerical information as type
  const versionMatch = model.match(/\d+(\.\d+)?[b]?/i);
  if (versionMatch) {
    return versionMatch[0];
  }
  
  // Default to the full model name as the type
  return capitalizeFirstLetter(model.split('-').pop() || 'Standard');
}

/**
 * Check if one model version is newer than another based on metadata or name analysis
 * 
 * @param model1 - First model to compare
 * @param model2 - Second model to compare
 * @param providerName - Provider name for context
 * @returns True if model1 is newer than model2
 */
function isNewerVersion(model1: string, model2: string | null, providerName: string): boolean {
  // If model2 is null, model1 is newer
  if (model2 === null) return true;
  
  // Try to get metadata from registry
  const registry = MODEL_REGISTRY[providerName.toLowerCase()];
  
  if (registry) {
    const meta1 = registry[model1];
    const meta2 = registry[model2];
    
    // If both models are in registry, compare release dates
    if (meta1 && meta2) {
      // Compare release dates if available
      if (meta1.releaseDate && meta2.releaseDate) {
        return meta1.releaseDate > meta2.releaseDate;
      }
      
      // Compare generation numbers if available
      if (meta1.generation !== undefined && meta2.generation !== undefined) {
        if (meta1.generation !== meta2.generation) {
          return meta1.generation > meta2.generation;
        }
      }
      
      // Compare version strings if available
      if (meta1.version && meta2.version) {
        return meta1.version > meta2.version;
      }
    }
  }
  
  // Fall back to heuristic-based comparison
  const lowerModel1 = model1.toLowerCase();
  const lowerModel2 = model2.toLowerCase();
  const lowerProvider = providerName.toLowerCase();
  
  // Special handling for OpenAI models
  if (lowerProvider === 'openai') {
    // GPT-4o is newer than standard GPT-4
    if (lowerModel1.includes('gpt-4o') && !lowerModel2.includes('gpt-4o')) return true;
    if (!lowerModel1.includes('gpt-4o') && lowerModel2.includes('gpt-4o')) return false;
    
    // GPT-4 Turbo is newer than standard GPT-4
    if (lowerModel1.includes('gpt-4-turbo') && !lowerModel2.includes('gpt-4-turbo')) return true;
    if (!lowerModel1.includes('gpt-4-turbo') && lowerModel2.includes('gpt-4-turbo')) return false;
    
    // Higher context versions are considered newer (32k > standard)
    if (lowerModel1.includes('32k') && !lowerModel2.includes('32k')) return true;
    if (!lowerModel1.includes('32k') && lowerModel2.includes('32k')) return false;
    
    if (lowerModel1.includes('16k') && !lowerModel2.includes('16k')) return true;
    if (!lowerModel1.includes('16k') && lowerModel2.includes('16k')) return false;
    
    // Preview models are newer than non-preview
    if (lowerModel1.includes('preview') && !lowerModel2.includes('preview')) return true;
    if (!lowerModel1.includes('preview') && lowerModel2.includes('preview')) return false;
  }
  
  // Special handling for Gemini models
  if (lowerProvider === 'gemini' || lowerModel1.includes('gemini') || lowerModel2.includes('gemini')) {
    // Models with higher version numbers are newer (gemini-2.0 > gemini-1.5)
    if (lowerModel1.includes('gemini-3') && !lowerModel2.includes('gemini-3')) return true;
    if (!lowerModel1.includes('gemini-3') && lowerModel2.includes('gemini-3')) return false;
    
    if (lowerModel1.includes('gemini-2.5') && !lowerModel2.includes('gemini-2.5')) return true;
    if (!lowerModel1.includes('gemini-2.5') && lowerModel2.includes('gemini-2.5')) return false;
    
    if (lowerModel1.includes('gemini-2.0') && !lowerModel2.includes('gemini-2.0')) return true;
    if (!lowerModel1.includes('gemini-2.0') && lowerModel2.includes('gemini-2.0')) return false;
    
    if (lowerModel1.includes('gemini-1.5') && !lowerModel2.includes('gemini-1.5')) return true;
    if (!lowerModel1.includes('gemini-1.5') && lowerModel2.includes('gemini-1.5')) return false;
    
    // Within the same major version, prioritize models
    if (lowerModel1.includes('pro') && !lowerModel2.includes('pro')) return true;
    if (!lowerModel1.includes('pro') && lowerModel2.includes('pro')) return false;
    
    if (lowerModel1.includes('flash') && !lowerModel2.includes('flash')) return true;
    if (!lowerModel1.includes('flash') && lowerModel2.includes('flash')) return false;
  }
  
  // Anthropic Claude models with date-based versioning
  if ((lowerProvider === 'anthropic' || lowerModel1.includes('claude') || lowerModel2.includes('claude'))) {
    // Extract date parts from model IDs
    const dateRegex = /\d{8}/;
    const date1 = lowerModel1.match(dateRegex)?.[0];
    const date2 = lowerModel2.match(dateRegex)?.[0];
    
    if (date1 && date2) {
      return date1 > date2;
    }
  }
  
  // If one has "latest" and the other doesn't, the one with "latest" is newer
  if (model1.includes('-latest') && !model2.includes('-latest')) return true;
  if (!model1.includes('-latest') && model2.includes('-latest')) return false;
  
  // Handle models with explicit version numbers
  const versionPattern = /([\d]+)(?:-([\d]+))?(?:-([\d]+))?/;
  const match1 = model1.match(versionPattern);
  const match2 = model2.match(versionPattern);
  
  if (match1 && match2) {
    // Compare version numbers component by component
    for (let i = 1; i < Math.min(match1.length, match2.length); i++) {
      const num1 = parseInt(match1[i] || '0');
      const num2 = parseInt(match2[i] || '0');
      if (num1 !== num2) return num1 > num2;
    }
  }
  
  // Models with "preview" are considered newer than those without
  if (model1.includes('preview') && !model2.includes('preview')) return true;
  if (!model1.includes('preview') && model2.includes('preview')) return false;
  
  // Models with higher numbers in their names are generally newer
  const allNumbers1 = (model1.match(/\d+/g) || []).map(Number);
  const allNumbers2 = (model2.match(/\d+/g) || []).map(Number);
  
  // Compare each number in sequence
  for (let i = 0; i < Math.min(allNumbers1.length, allNumbers2.length); i++) {
    if (allNumbers1[i] !== allNumbers2[i]) {
      return allNumbers1[i] > allNumbers2[i];
    }
  }
  
  // Fallback: alphabetical comparison as a last resort
  return model1.localeCompare(model2) > 0;
}

/**
 * Normalize provider names for consistent display
 * 
 * @param providerName - Raw provider name
 * @returns Normalized provider name
 */
function normalizeProviderName(providerName: string): string {
  const lowerName = providerName.toLowerCase();
  
  // Map of lowercase provider names to their display versions
  const providerNameMap: Record<string, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'gemini': 'Gemini',
    'google': 'Gemini', // Map 'google' to 'Gemini' for consistency
    'mistral': 'Mistral',
    'cohere': 'Cohere',
    'openrouter': 'OpenRouter',
    'meta': 'Meta',
    'anyscale': 'Anyscale',
    'replicate': 'Replicate',
    'groq': 'Groq',
    'stability': 'Stability AI'
  };
  
  // Return mapped name or capitalized version if not in map
  return providerNameMap[lowerName] || capitalizeFirstLetter(providerName);
}

/**
 * Capitalize the first letter of a string
 * 
 * @param string - String to capitalize
 * @returns Capitalized string
 */
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Add a model to the registry to support dynamic model addition
 * 
 * @param provider - Provider name
 * @param model - Model name
 * @param metadata - Model metadata
 */
export function registerModel(provider: string, model: string, metadata: ModelMetadata): void {
  const lowerProvider = provider.toLowerCase();
  
  // Initialize provider in registry if not exists
  if (!MODEL_REGISTRY[lowerProvider]) {
    MODEL_REGISTRY[lowerProvider] = {};
  }
  
  // Add or update model metadata
  MODEL_REGISTRY[lowerProvider][model] = metadata;
}

/**
 * Get capabilities for a specific model
 * 
 * @param provider - Provider name
 * @param model - Model name
 * @returns Array of capability strings or empty array if not found
 */
export function getModelCapabilities(provider: string, model: string): string[] {
  const metadata = getModelMetadata(model, provider);
  return metadata.capabilities || [];
}

export {
  determineModelFamily,
  determineModelType,
  isNewerVersion,
  getModelMetadata,
  ModelMetadata,
  ModelRegistry 
}; 