processModels(hierarchicalGroups) {
  if (!hierarchicalGroups || !Array.isArray(hierarchicalGroups)) {
    console.error('Invalid hierarchical model data received');
    return { Chat: [], Image: [], Embedding: [] };
  }
  
  console.log('Processing pre-classified hierarchical models...');
  
  // Pre-allocate all arrays and objects
  const structured = { Chat: {}, Image: {}, Embedding: {} };
  this.allModels = [];
  this.experimentalModels = [];

  const processGroup = (group, currentProvider, currentType) => {
    const groupName = group.group_name;
    const groupValue = group.group_value;

    // Update context information
    if (groupName === 'provider') {
      currentProvider = groupValue;
    }
    if (groupName === 'type') {
      currentType = groupValue;
    }

    // Process models directly attached to this group (expected at version level)
    if (group.models && group.models.length > 0) {
      for (let i = 0; i < group.models.length; i++) {
        const model = group.models[i];
        if (!model || !model.id) continue; // Skip invalid models

        // Use the category directly from the model or determine from capabilities
        let categoryName;
        if (model.type === 'Image Generation' || 
            (model.capabilities && model.capabilities.includes('Image Generation'))) {
          categoryName = 'Image'; 
        } else if (model.type === 'Embedding' || 
            (model.capabilities && model.capabilities.includes('embedding'))) {
          categoryName = 'Embedding';
        } else {
          categoryName = 'Chat'; // Default to Chat
        }
        
        // Skip embedding models unless specifically configured to show them
        if (categoryName === 'Embedding' && !this.includeEmbeddings) {
          continue;
        }
        
        // Use the pre-classified experimental flag directly
        const isExperimental = model.is_experimental === true;
        
        // Get display name or normalize it if not provided
        const displayName = model.display_name || this.normalizeModelName(model);
        
        // Use the pre-classified model type directly
        const type = model.type || currentType || 'Standard';
        
        // Use group value as groupingKey (already classified in hierarchy)
        const groupingKey = currentType || 'General Models';

        const processedModel = {
          id: model.id,
          name: model.name || model.id,
          provider: currentProvider || model.provider || 'UnknownProvider',
          category: categoryName,
          type: type,
          family: model.family || 'Unknown Family',
          series: model.series || 'Unknown Series',
          variant: model.variant || 'Default',
          groupingKey: groupingKey,
          displayName: displayName,
          isExperimental: isExperimental,
          isMultimodal: model.is_multimodal || (model.capabilities || []).includes('vision') || false,
          capabilities: model.capabilities || [],
          contextSize: model.context_size || 0,
          version: model.version || ''
        };

        // Add to structured data
        if (!structured[categoryName][processedModel.provider]) {
          structured[categoryName][processedModel.provider] = {};
        }
        if (!structured[categoryName][processedModel.provider][processedModel.groupingKey]) {
          structured[categoryName][processedModel.provider][processedModel.groupingKey] = [];
        }
        structured[categoryName][processedModel.provider][processedModel.groupingKey].push(processedModel);

        // Add to flat lists
        this.allModels.push(processedModel);
        if (processedModel.isExperimental) {
          this.experimentalModels.push(processedModel);
        }
      }
    }

    // Recursively process children
    if (group.children && group.children.length > 0) {
      for (let i = 0; i < group.children.length; i++) {
        processGroup(group.children[i], currentProvider, currentType);
      }
    }
  };

  // Start processing from the root (provider) groups
  hierarchicalGroups.forEach(rootGroup => processGroup(rootGroup, null, null));

  // Convert the structured map into the final array format expected by rendering
  const finalStructure = { Chat: [], Image: [], Embedding: [] };
  
  Object.keys(structured).forEach(catName => {
    const providers = structured[catName];
    // Don't sort provider names, use them in the order they're already in
    const providerNames = Object.keys(providers);

    providerNames.forEach(provName => {
      const groups = providers[provName];
      // Don't sort group names, use them in the order they're already in
      const groupNames = Object.keys(groups);

      const groupsList = [];
      for (let i = 0; i < groupNames.length; i++) {
        const groupName = groupNames[i];
        const models = groups[groupName];
        if (models.length > 0) {
          // Don't sort models, keep them in the original order
          groupsList.push({ name: groupName, models: models });
        }
      }

      if (groupsList.length > 0) {
        finalStructure[catName].push({ name: provName, families: groupsList });
      }
    });
  });

  return finalStructure;
} 