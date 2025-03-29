/**
 * Model Categorizer Utility
 * 
 * Organizes AI models from multiple providers into a structured multi-level dropdown format.
 * 
 * - Level 1: Provider (OpenAI, Google, Anthropic, etc.)
 * - Level 2: Model Type (Pro, Flash, Turbo, Vision, etc.)
 * - Level 3: Best Model (Latest/Best Version Per Type)
 * - Level 4: Other Versions (Optional submenu of older versions)
 */

/**
 * Categorize models into a structured hierarchy for dropdown menus
 * 
 * @param {Object} modelsByProvider - Object mapping provider names to their models
 * @returns {Object} Structured model hierarchy for UI rendering
 */
function categorizeModels(modelsByProvider) {
  const structuredModels = {};

  // Process each provider's models
  Object.entries(modelsByProvider).forEach(([providerName, providerData]) => {
    const models = providerData.models || [];
    if (!models.length) return;

    // Initialize provider in the structure
    structuredModels[normalizeProviderName(providerName)] = {};
    
    // Group models by their families/categories
    const modelsByFamily = groupModelsByFamily(models, providerName);
    
    // Process each model family
    Object.entries(modelsByFamily).forEach(([family, familyModels]) => {
      // Group models by their types
      const modelsByType = groupModelsByType(familyModels, providerName);
      
      // Add family to provider
      structuredModels[normalizeProviderName(providerName)][family] = modelsByType;
    });
  });

  return structuredModels;
}

/**
 * Group models by their family/category
 * 
 * @param {Array} models - List of model names
 * @param {String} providerName - Name of the provider
 * @returns {Object} Models grouped by family
 */
function groupModelsByFamily(models, providerName) {
  const modelsByFamily = {};
  
  models.forEach(model => {
    const family = determineModelFamily(model, providerName);
    
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
 * @param {Array} models - List of models in the same family
 * @param {String} providerName - Name of the provider
 * @returns {Object} Models grouped by type with best version identified
 */
function groupModelsByType(models, providerName) {
  const modelsByType = {};
  
  models.forEach(model => {
    const type = determineModelType(model, providerName);
    
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
 * @param {String} model - Model name
 * @param {String} providerName - Provider name
 * @returns {String} Model family name
 */
function determineModelFamily(model, providerName) {
  const lowerModel = model.toLowerCase();
  const lowerProvider = providerName.toLowerCase();
  
  // Google/Gemini models
  if (lowerModel.includes('gemini')) {
    return 'Gemini';
  }
  
  // OpenAI models
  if (lowerProvider === 'openai') {
    if (lowerModel.includes('dall-e')) return 'Image';
    if (lowerModel.includes('embedding')) return 'Embedding';
    if (lowerModel.includes('moderation')) return 'Moderation';
    if (lowerModel.includes('tts')) return 'Speech';
    if (lowerModel.includes('whisper')) return 'Audio';
    return 'Chat';
  }
  
  // Anthropic models
  if (lowerProvider === 'anthropic' || lowerModel.includes('claude')) {
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
  
  // Default to Unknown family
  return 'Other';
}

/**
 * Determine the type of a model within its family
 * 
 * @param {String} model - Model name
 * @param {String} providerName - Provider name
 * @returns {String} Model type
 */
function determineModelType(model, providerName) {
  const lowerModel = model.toLowerCase();
  const lowerProvider = providerName.toLowerCase();
  
  // Google/Gemini models
  if (lowerModel.includes('gemini')) {
    if (lowerModel.includes('pro-vision')) return 'Pro Vision';
    if (lowerModel.includes('pro')) return 'Pro';
    if (lowerModel.includes('flash-thinking')) return 'Flash-Thinking';
    if (lowerModel.includes('flash')) return 'Flash';
    return 'Standard';
  }
  
  // OpenAI models
  if (lowerProvider === 'openai') {
    if (lowerModel.includes('gpt-4-o')) return 'GPT-4o';
    if (lowerModel.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
    if (lowerModel.includes('gpt-4-vision')) return 'GPT-4 Vision';
    if (lowerModel.includes('gpt-4')) return 'GPT-4';
    if (lowerModel.includes('gpt-3.5-turbo')) return 'GPT-3.5 Turbo';
    if (lowerModel.includes('gpt-3.5')) return 'GPT-3.5';
    if (lowerModel.includes('dall-e-3')) return 'DALL-E 3';
    if (lowerModel.includes('dall-e-2')) return 'DALL-E 2';
    if (lowerModel.includes('tts-1-hd')) return 'TTS HD';
    if (lowerModel.includes('tts-1')) return 'TTS Standard';
    if (lowerModel.includes('whisper')) return 'Whisper';
    if (lowerModel.includes('embedding')) return 'Embedding';
    return 'Standard';
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
  
  // For other or unclear models, extract numerical information as type
  const versionMatch = model.match(/\d+(\.\d+)?[b]?/i);
  if (versionMatch) {
    return versionMatch[0];
  }
  
  // OpenRouter typically exposes models with provider/model pattern
  if (lowerProvider === 'openrouter') {
    const parts = model.split('/');
    if (parts.length > 1) {
      // Recursively determine the type using the model part
      return determineModelType(parts[1], parts[0]);
    }
  }
  
  // Default to the full model name as the type
  return model;
}

/**
 * Check if one model version is newer than another
 * 
 * @param {String} model1 - First model to compare
 * @param {String} model2 - Second model to compare
 * @param {String} providerName - Provider name for context
 * @returns {Boolean} True if model1 is newer than model2
 */
function isNewerVersion(model1, model2, providerName) {
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
  
  // If one model has more number components, it's likely newer
  if (allNumbers1.length !== allNumbers2.length) {
    return allNumbers1.length > allNumbers2.length;
  }
  
  // Fallback: alphabetical comparison as a last resort
  return model1.localeCompare(model2) > 0;
}

/**
 * Normalize provider names for consistent display
 * 
 * @param {String} providerName - Raw provider name
 * @returns {String} Normalized provider name
 */
function normalizeProviderName(providerName) {
  const lowerName = providerName.toLowerCase();
  
  // Map of lowercase provider names to their display versions
  const providerNameMap = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'gemini': 'Gemini',
    'google': 'Gemini', // Map 'google' to 'Gemini' for consistency
    'mistral': 'Mistral',
    'cohere': 'Cohere',
    'openrouter': 'OpenRouter',
    'meta': 'Meta'
  };
  
  // Return mapped name or capitalized version if not in map
  return providerNameMap[lowerName] || capitalizeFirstLetter(providerName);
}

/**
 * Capitalize the first letter of a string
 * 
 * @param {String} string - String to capitalize
 * @returns {String} Capitalized string
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
  categorizeModels,
  determineModelFamily,
  determineModelType,
  isNewerVersion
}; 