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

// Define the registry of models with their metadata
const MODEL_REGISTRY = {
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
 * @param {Object} modelsByProvider - Object mapping provider names to their models
 * @param {boolean} includeExperimental - Whether to include experimental models
 * @returns {Object} Structured model hierarchy for UI rendering
 */
export function categorizeModels(
  modelsByProvider,
  includeExperimental = false
) {
  const structuredModels = {};

  // Process each provider's models
  for (const [provider, providerData] of Object.entries(modelsByProvider)) {
    // Skip providers with errors or no models
    if (providerData.error || !providerData.models || providerData.models.length === 0) {
      continue;
    }

    const providerName = normalizeProviderName(provider);
    structuredModels[providerName] = {};

    // First group models by family
    const modelsByFamily = groupModelsByFamily(providerData.models, provider);

    // Then for each family, group models by type
    for (const [family, models] of Object.entries(modelsByFamily)) {
      structuredModels[providerName][family] = groupModelsByType(models, provider);
    }
  }

  return structuredModels;
}

/**
 * Get metadata for a specific model
 * 
 * @param {string} modelName - Name of the model
 * @param {string} providerName - Name of the provider
 * @returns {Object} Model metadata
 */
function getModelMetadata(modelName, providerName) {
  const provider = MODEL_REGISTRY[providerName];
  
  if (provider && provider[modelName]) {
    return provider[modelName];
  }
  
  // Use fallback heuristic detection for unknown models
  return {
    family: determineModelFamily(modelName, providerName),
    type: determineModelType(modelName, providerName),
    capabilities: [],
    isExperimental: modelName.includes('preview') || modelName.includes('beta') || modelName.includes('dev')
  };
}

/**
 * Group models by family
 * 
 * @param {string[]} models - List of model names
 * @param {string} providerName - Name of the provider
 * @returns {Object} Models grouped by family
 */
function groupModelsByFamily(models, providerName) {
  const modelsByFamily = {};
  
  for (const model of models) {
    const family = determineModelFamily(model, providerName);
    
    if (!modelsByFamily[family]) {
      modelsByFamily[family] = [];
    }
    
    modelsByFamily[family].push(model);
  }
  
  return modelsByFamily;
}

/**
 * Group models by type
 * 
 * @param {string[]} models - List of model names
 * @param {string} providerName - Name of the provider
 * @returns {Object} Models grouped by type
 */
function groupModelsByType(models, providerName) {
  const modelsByType = {};
  
  // First pass: group models by type
  for (const model of models) {
    const type = determineModelType(model, providerName);
    
    if (!modelsByType[type]) {
      modelsByType[type] = {
        latest: null,
        other_versions: []
      };
    }
    
    // Add model to the appropriate type
    if (modelsByType[type].latest === null) {
      modelsByType[type].latest = model;
    } else if (isNewerVersion(model, modelsByType[type].latest, providerName)) {
      // If this model is newer than current latest, update latest
      modelsByType[type].other_versions.push(modelsByType[type].latest);
      modelsByType[type].latest = model;
    } else {
      // Otherwise add to other versions
      modelsByType[type].other_versions.push(model);
    }
  }
  
  // Sort other versions in reverse chronological order (newest first)
  for (const type in modelsByType) {
    modelsByType[type].other_versions.sort((a, b) => 
      isNewerVersion(a, b, providerName) ? -1 : 1
    );
  }
  
  return modelsByType;
}

/**
 * Determine the family of a model based on its name
 * 
 * @param {string} model - Model name
 * @param {string} providerName - Provider name
 * @returns {string} Model family
 */
function determineModelFamily(model, providerName) {
  // Try to get family from registry
  const metadata = getModelMetadata(model, providerName);
  if (metadata && metadata.family) {
    return metadata.family;
  }
  
  // Fallback: Heuristic detection based on model name
  if (providerName === 'openai') {
    if (model.startsWith('gpt-4o')) return 'GPT-4';
    if (model.startsWith('gpt-4')) return 'GPT-4';
    if (model.startsWith('gpt-3.5')) return 'GPT-3.5';
    if (model.startsWith('gpt-3')) return 'GPT-3';
    if (model.startsWith('davinci')) return 'GPT-3';
    if (model.startsWith('curie')) return 'GPT-3';
    if (model.startsWith('babbage')) return 'GPT-3';
    if (model.startsWith('ada')) return 'GPT-3';
    if (model.startsWith('text-embedding')) return 'Embeddings';
    if (model.startsWith('text-moderation')) return 'Moderation';
    if (model.startsWith('dall-e')) return 'DALL-E';
    if (model.startsWith('whisper')) return 'Whisper';
  } 
  else if (providerName === 'anthropic') {
    if (model.startsWith('claude-3')) return 'Claude 3';
    if (model.startsWith('claude-2')) return 'Claude 2';
    if (model.startsWith('claude-1') || model.startsWith('claude-instant')) return 'Claude 1';
    if (model.startsWith('claude-')) return 'Claude';
  } 
  else if (providerName === 'gemini') {
    if (model.startsWith('gemini-1.5')) return 'Gemini 1.5';
    if (model.startsWith('gemini-1.0')) return 'Gemini 1.0';
    if (model.startsWith('gemini-pro')) return 'Gemini 1.0';
    if (model.startsWith('gemini-')) return 'Gemini';
  }
  else if (providerName === 'cohere') {
    if (model.startsWith('command')) return 'Command';
    if (model.startsWith('embed')) return 'Embed';
  }
  
  // Generic fallback for unknown models
  return capitalizeFirstLetter(providerName);
}

/**
 * Determine the type of a model based on its name
 * 
 * @param {string} model - Model name
 * @param {string} providerName - Provider name
 * @returns {string} Model type
 */
function determineModelType(model, providerName) {
  // Try to get type from registry
  const metadata = getModelMetadata(model, providerName);
  if (metadata && metadata.type) {
    return metadata.type;
  }
  
  // Fallback: Heuristic detection based on model name
  // OpenAI models
  if (providerName === 'openai') {
    if (model === 'gpt-4o') return 'GPT-4o';
    if (model === 'gpt-4o-mini') return 'GPT-4o Mini';
    if (model.includes('vision')) return 'Vision';
    if (model.includes('turbo')) {
      if (model.includes('16k')) return 'Turbo 16K';
      if (model.includes('32k')) return 'Turbo 32K';
      return 'Turbo';
    }
    if (model.includes('-32k')) return '32K Context';
    if (model.includes('-16k')) return '16K Context';
    if (model.includes('preview')) return 'Preview';
    if (model.includes('small')) return 'Small';
    if (model.includes('large')) return 'Large';
    if (model.includes('medium')) return 'Medium';
    if (model.includes('text-embedding')) return 'Embedding';
    if (model.includes('text-moderation')) return 'Moderation';
    if (model.includes('whisper')) return 'Speech';
    if (model.includes('dall-e')) return 'Image';
    
    // Standard GPT models without qualifiers
    if (model === 'gpt-4') return 'Standard';
    if (model === 'gpt-3.5-turbo') return 'Standard';
    
    // Legacy completion models
    if (model.endsWith('-001')) return 'Legacy 001';
    if (model.endsWith('-002')) return 'Legacy 002';
    if (model.endsWith('-003')) return 'Legacy 003';
  }
  
  // Anthropic models
  else if (providerName === 'anthropic') {
    if (model.includes('opus')) return 'Opus';
    if (model.includes('sonnet')) return 'Sonnet';
    if (model.includes('haiku')) return 'Haiku';
    if (model.includes('instant')) return 'Instant';
    
    // Extract version for Claude 2/1 without other identifiers
    const versionMatch = model.match(/claude-(\d+(\.\d+)?)/i);
    if (versionMatch) {
      return `Claude ${versionMatch[1]}`;
    }
  }
  
  // Gemini models
  else if (providerName === 'gemini') {
    if (model.includes('flash')) return 'Flash';
    if (model.includes('pro')) return 'Pro';
    if (model.includes('ultra')) return 'Ultra';
    if (model.includes('nano')) return 'Nano';
    if (model.includes('vision')) return 'Vision';
  }
  
  // Cohere models
  else if (providerName === 'cohere') {
    if (model.includes('command')) {
      if (model.includes('light')) return 'Command Light';
      return 'Command';
    }
    if (model.includes('embed')) {
      if (model.includes('english')) return 'Embed English';
      if (model.includes('multilingual')) return 'Embed Multilingual';
      return 'Embed';
    }
  }
  
  // Generic fallback: use the full model name
  return model;
}

/**
 * Determine if model1 is a newer version than model2
 * 
 * @param {string} model1 - First model to compare
 * @param {string|null} model2 - Second model to compare
 * @param {string} providerName - Provider name
 * @returns {boolean} Whether model1 is newer than model2
 */
function isNewerVersion(model1, model2, providerName) {
  if (!model2) return true;
  
  // Get metadata for both models
  const meta1 = getModelMetadata(model1, providerName);
  const meta2 = getModelMetadata(model2, providerName);
  
  // If we have release dates, use them
  if (meta1.releaseDate && meta2.releaseDate) {
    return meta1.releaseDate > meta2.releaseDate;
  }
  
  // If we have version strings, compare them
  if (meta1.version && meta2.version) {
    return meta1.version > meta2.version;
  }
  
  // OpenAI specific logic
  if (providerName === 'openai') {
    // GPT-4 is newer than 3.5
    if (model1.includes('gpt-4') && model2.includes('gpt-3')) return true;
    if (model1.includes('gpt-3') && model2.includes('gpt-4')) return false;
    
    // o models are newer than non-o models
    if (model1.includes('gpt-4o') && model2.includes('gpt-4') && !model2.includes('gpt-4o')) return true;
    if (model2.includes('gpt-4o') && model1.includes('gpt-4') && !model1.includes('gpt-4o')) return false;
    
    // GPT-4o mini is newer than GPT-4o
    if (model1.includes('gpt-4o-mini') && model2 === 'gpt-4o') return true;
    if (model2.includes('gpt-4o-mini') && model1 === 'gpt-4o') return false;
    
    // turbo models are newer
    if (model1.includes('turbo') && !model2.includes('turbo')) return true;
    if (model2.includes('turbo') && !model1.includes('turbo')) return false;
    
    // Higher context window models
    if (model1.includes('32k') && !model2.includes('32k')) return true;
    if (model2.includes('32k') && !model1.includes('32k')) return false;
    
    if (model1.includes('16k') && !model2.includes('16k') && !model2.includes('32k')) return true;
    if (model2.includes('16k') && !model1.includes('16k') && !model1.includes('32k')) return false;
    
    // Preview models are typically newer
    if (model1.includes('preview') && !model2.includes('preview')) return true;
    if (model2.includes('preview') && !model1.includes('preview')) return false;
    
    // Compare date codes in model names (YYYYMMDD format)
    const dateRegex = /(\d{8})/;
    const date1Match = model1.match(dateRegex);
    const date2Match = model2.match(dateRegex);
    
    if (date1Match && date2Match) {
      return date1Match[1] > date2Match[1];
    }
    
    // Extract any version numbers (e.g., 001, 002, 003)
    const versionRegex = /-(\d{3})$/;
    const version1Match = model1.match(versionRegex);
    const version2Match = model2.match(versionRegex);
    
    if (version1Match && version2Match) {
      return parseInt(version1Match[1]) > parseInt(version2Match[1]);
    }
  }
  
  // Anthropic specific logic
  else if (providerName === 'anthropic') {
    // Claude 3 is newer than Claude 2, etc.
    if (model1.includes('claude-3') && !model2.includes('claude-3')) return true;
    if (model2.includes('claude-3') && !model1.includes('claude-3')) return false;
    
    if (model1.includes('claude-2') && model2.includes('claude-1')) return true;
    if (model2.includes('claude-2') && model1.includes('claude-1')) return false;
    
    // Opus > Sonnet > Haiku for Claude 3
    if (model1.includes('opus') && (model2.includes('sonnet') || model2.includes('haiku'))) return true;
    if (model2.includes('opus') && (model1.includes('sonnet') || model1.includes('haiku'))) return false;
    if (model1.includes('sonnet') && model2.includes('haiku')) return true;
    if (model2.includes('sonnet') && model1.includes('haiku')) return false;
    
    // Date codes in model IDs (YYYYMMDD format)
    const dateRegex = /(\d{8})/;
    const date1Match = model1.match(dateRegex);
    const date2Match = model2.match(dateRegex);
    
    if (date1Match && date2Match) {
      return date1Match[1] > date2Match[1];
    }
  }
  
  // Gemini specific logic
  else if (providerName === 'gemini') {
    // Gemini 1.5 > Gemini 1.0
    if (model1.includes('gemini-1.5') && model2.includes('gemini-1.0')) return true;
    if (model2.includes('gemini-1.5') && model1.includes('gemini-1.0')) return false;
    
    // Pro > Flash > Nano
    if (model1.includes('pro') && model2.includes('flash')) return true;
    if (model2.includes('pro') && model1.includes('flash')) return false;
    
    // Extract version numbers like "gemini-1.5" -> 1.5
    const versionRegex = /gemini-(\d+\.\d+)/;
    const version1Match = model1.match(versionRegex);
    const version2Match = model2.match(versionRegex);
    
    if (version1Match && version2Match) {
      return parseFloat(version1Match[1]) > parseFloat(version2Match[1]);
    }
  }
  
  // Default comparison: alphabetical (not ideal but a fallback)
  return model1 > model2;
}

/**
 * Normalize provider name for consistency
 * 
 * @param {string} providerName - Raw provider name
 * @returns {string} Normalized provider name
 */
function normalizeProviderName(providerName) {
  if (!providerName) return 'Unknown';
  
  // Convert to lowercase for comparison
  const lowerName = providerName.toLowerCase();
  
  // Map specific provider names to standardized formats
  const providerMap = {
    'openai': 'OpenAI',
    'google': 'Google',
    'gemini': 'Google',
    'anthropic': 'Anthropic',
    'claude': 'Anthropic',
    'mistral': 'Mistral AI',
    'mistralai': 'Mistral AI',
    'cohere': 'Cohere',
    'azure': 'Azure',
    'openrouter': 'OpenRouter',
    'huggingface': 'Hugging Face',
    'huggingfacehub': 'Hugging Face',
    'anyscale': 'Anyscale',
    'replicate': 'Replicate',
    'together': 'Together AI',
    'togetherai': 'Together AI'
  };
  
  return providerMap[lowerName] || capitalizeFirstLetter(providerName);
}

/**
 * Capitalize the first letter of a string
 * 
 * @param {string} string - Input string
 * @returns {string} String with first letter capitalized
 */
function capitalizeFirstLetter(string) {
  if (!string || string.length === 0) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Register a new model or update an existing one
 * 
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {Object} metadata - Model metadata
 */
export function registerModel(provider, model, metadata) {
  // Create provider entry if it doesn't exist
  if (!MODEL_REGISTRY[provider]) {
    MODEL_REGISTRY[provider] = {};
  }
  
  // Add or update model entry
  MODEL_REGISTRY[provider][model] = {
    ...metadata,
    // Ensure these fields exist
    family: metadata.family || determineModelFamily(model, provider),
    type: metadata.type || determineModelType(model, provider),
    capabilities: metadata.capabilities || []
  };
}

/**
 * Get capabilities of a specific model
 * 
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @returns {string[]} Array of capabilities
 */
export function getModelCapabilities(provider, model) {
  try {
    const metadata = getModelMetadata(model, provider);
    return metadata.capabilities || [];
  } catch (error) {
    console.error(`Error getting model capabilities: ${error.message}`);
    return [];
  }
}

export default {
  categorizeModels,
  registerModel,
  getModelCapabilities
}; 