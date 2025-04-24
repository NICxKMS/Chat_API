/* eslint-disable no-restricted-globals */
// modelProcessor.js
// Web Worker for processing model list data in the background

/**
 * processModels replicates the logic from ModelContext to transform
 * hierarchical_groups into flat arrays and nested maps.
 */
function processModels(data) {
  const allModels = [];
  const experimentalModels = [];
  const processedModels = {};

  // Helper to normalize a model name
  const normalizeModelName = (model) => {
    const name = model.id || '';
    return name.split('/').pop() || name;
  };

  data.hierarchical_groups.forEach(providerGroup => {
    const provider = providerGroup.group_value;
    if (!providerGroup.children) return;

    providerGroup.children.forEach(typeGroup => {
      const type = typeGroup.group_value;
      if (!typeGroup.children) return;

      typeGroup.children.forEach(versionGroup => {
        const version = versionGroup.group_value;
        if (!Array.isArray(versionGroup.models)) return;

        versionGroup.models.forEach(model => {
          let category = 'Chat';
          const t = (model.type || type || '').toLowerCase();
          if (t.includes('image')) category = 'Image';
          else if (t.includes('embedding')) category = 'Embedding';

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
          if (model.is_experimental) experimentalModels.push(processedModel);

          // Build nested map: processedModels[category][provider][type]
          processedModels[category] = processedModels[category] || {};
          processedModels[category][provider] = processedModels[category][provider] || {};
          processedModels[category][provider][type] = processedModels[category][provider][type] || [];
          processedModels[category][provider][type].push(processedModel);
        });
      });
    });
  });

  return { allModels, processedModels, experimentalModels };
}

// Listen for messages from main thread
self.onmessage = ({ data }) => {
  try {
    const result = processModels(data);
    self.postMessage({ ...result });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
}; 