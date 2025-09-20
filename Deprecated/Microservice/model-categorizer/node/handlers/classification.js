const { ModelClassifier } = require("../classifiers/classifier");

// Property constants
const PropertyProvider = "provider";
const PropertyFamily = "family";
const PropertyType = "type";
const PropertySeries = "series";
const PropertyVariant = "variant";
const PropertyCapability = "capability";
const PropertyContextWindow = "context_window";
const PropertyMultimodal = "multimodal";

// Default properties
const DefaultClassificationProperties = [PropertyProvider, PropertyFamily, PropertyType, PropertyCapability];

// Standard context sizes (used only for Gemini in applyModelMetadata)
const StandardContextSizes = {
  "gemini-1.5-pro": 1000000,
  "gemini-1.5-pro-latest": 1000000,
  "gemini-1.5-flash": 1000000,
  "gemini-1.5-flash-latest": 1000000,
  "gemini-1.0-pro": 32768,
  "gemini-1.0-pro-vision": 32768,
  "gemini-1.0-pro-vision-latest": 32768,
  "gemini-2.0-pro": 1000000,
  "gemini-2.0-flash": 1000000,
  "gemini-2.5-pro": 1000000,
};

// Available classification properties (mirror Go)
function AvailableClassificationProperties() {
  const properties = [
    {
      name: "provider",
      display_name: "Provider",
      description: "The AI provider that offers the model",
      possible_values: ["openai", "anthropic", "gemini", "meta", "mistral", "cohere", "openrouter", "other"],
    },
    {
      name: "family",
      display_name: "Model Family",
      description: "The family or generation that the model belongs to",
      possible_values: ["GPT-4", "GPT-3.5", "Claude 3", "Claude 2", "Gemini 1.5", "Gemini 1.0", "Llama", "Mistral"],
    },
    {
      name: "type",
      display_name: "Model Type",
      description: "The specific type or version of the model",
      possible_values: [
        "Vision",
        "Standard",
        "Pro",
        "Flash",
        "Gemma",
        "Opus",
        "Sonnet",
        "Haiku",
        "Embedding",
        "O Series",
        "GPT 3.5",
        "GPT 4",
        "GPT 4.5",
        "Mini",
        "Flash Lite",
        "Thinking",
        "Image Generation",
      ],
    },
    {
      name: "context_window",
      display_name: "Context Window",
      description: "Grouping based on context window size",
      possible_values: ["Small (< 10K)", "Medium (10K-100K)", "Large (100K-200K)", "Very Large (> 200K)"],
    },
    {
      name: "capability",
      display_name: "Capabilities",
      description: "Special model capabilities",
      possible_values: ["vision", "function-calling", "embedding", "streaming", "chat", "audio"].sort(),
    },
  ];
  return properties;
}

class ModelClassificationHandler {
  constructor({ enableLogging = false } = {}) {
    this.enableLogging = enableLogging;
    this.classifier = new ModelClassifier();
  }

  classifyModels(loadedModelList) {
    const internalModels = convertProtoModelsToInternal(loadedModelList.models || []);
    const result = {
      available_properties: convertToProtoProperties(AvailableClassificationProperties()),
      hierarchical_groups: [],
    };
    const enhancedModels = this.enhanceModels(internalModels);
    const rootGroups = this.buildModelHierarchy(enhancedModels);
    for (const group of rootGroups) {
      const protoGroup = convertInternalHierarchicalGroupToProto(group);
      result.hierarchical_groups.push(protoGroup);
    }
    return result;
  }

  classifyModelsWithCriteria(loadedModelList, criteria) {
    const result = {
      available_properties: convertToProtoProperties(AvailableClassificationProperties()),
      classified_groups: [],
      hierarchical_groups: [],
    };

    const modelsList = convertProtoModelsToInternal(loadedModelList.models || []);
    const properties = (criteria && criteria.properties && criteria.properties.length) ? criteria.properties : DefaultClassificationProperties;

    const filteredModels = this.filterModelsByCriteria(modelsList, criteria || {});
    const enhancedModels = this.enhanceModels(filteredModels);

    let useHierarchical = true;
    if (criteria && criteria.hierarchical === false) useHierarchical = false;

    if (useHierarchical) {
      const rootGroups = this.buildModelHierarchy(enhancedModels);
      for (const group of rootGroups) {
        result.hierarchical_groups.push(convertInternalHierarchicalGroupToProto(group));
      }
    } else {
      for (const property of properties) {
        const groups = this.classifyModelsByProperty(enhancedModels, property);
        result.classified_groups.push(...groups);
      }
    }
    return result;
  }

  enhanceModels(modelsList) {
    for (let i = 0; i < modelsList.length; i++) {
      const model = modelsList[i];
      const metadata = this.classifier.ClassifyModel(model.ID, model.Provider);
      this.applyModelMetadata(model, metadata);
    }
    return modelsList;
  }

  applyModelMetadata(model, metadata) {
    const originalProvider = model.OriginalProvider;
    model.Provider = metadata.Provider;
    model.OriginalProvider = originalProvider;
    model.Family = metadata.Series;
    model.Type = metadata.Type;
    model.Series = metadata.Series;
    model.Variant = metadata.Variant;
    const capabilities = metadata.Capabilities || [];
    capabilities.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    model.Capabilities = capabilities;
    if (!model.Version || model.Version.length === 0) {
      const standardizedVersion = this.classifier.GetStandardizedVersion(model.ID);
      if (standardizedVersion) model.Version = standardizedVersion;
    }
    const idLower = (model.ID || "").toLowerCase();
    model.IsMultimodal = !!(metadata.IsMultimodal || containsAny(model.Capabilities, ["vision", "multimodal"]) || idLower.includes("vision") || idLower.includes("gpt-4") || idLower.includes("claude-3") || idLower.includes("gemini"));
    model.IsExperimental = !!(metadata.IsExperimental || idLower.includes("preview") || idLower.includes("experimental"));
    model.IsDefault = !!this.classifier.IsDefaultModelName(model.ID);
    if (!model.DisplayName || model.DisplayName.length === 0) {
      if (metadata.DisplayName && metadata.DisplayName.length > 0) model.DisplayName = metadata.DisplayName;
      else model.DisplayName = (model.ID || "").replaceAll("-", " ");
    }
    if ((model.Provider || "").toLowerCase() === "gemini" || idLower.includes("gemini")) {
      if (!model.ContextSize && model.ID) {
        if (StandardContextSizes[model.ID] !== undefined) model.ContextSize = StandardContextSizes[model.ID];
        else if (metadata.Context > 0) model.ContextSize = metadata.Context | 0;
      }
    }
  }

  classifyModelsByProperty(modelsList, property) {
    const groups = [];
    const propertyGroups = {};
    for (const model of modelsList) {
      let propertyValue = "";
      switch (property) {
        case PropertyProvider:
          propertyValue = model.Provider; break;
        case PropertyFamily:
          propertyValue = model.Family; break;
        case PropertyType:
          propertyValue = model.Type; break;
        case PropertySeries:
          propertyValue = model.Series; break;
        case PropertyVariant:
          propertyValue = model.Variant; break;
        case PropertyCapability:
          for (const capability of model.Capabilities || []) {
            if (capability && capability.length) {
              if (!propertyGroups[capability]) propertyGroups[capability] = [];
              propertyGroups[capability].push(model);
            }
          }
          continue;
        case PropertyContextWindow:
          propertyValue = this.categorizeContextWindow(model.ContextSize | 0); break;
        case PropertyMultimodal:
          propertyValue = this.boolToYesNo(!!model.IsMultimodal); break;
        default:
          continue;
      }
      if (propertyValue && propertyValue.length) {
        if (!propertyGroups[propertyValue]) propertyGroups[propertyValue] = [];
        propertyGroups[propertyValue].push(model);
      }
    }
    for (const [value, modelGroup] of Object.entries(propertyGroups)) {
      groups.push({
        property_name: property,
        property_value: value,
        models: convertInternalModelsToProto(modelGroup),
      });
    }
    if (property === PropertyCapability) {
      groups.sort((a, b) => a.property_value.toLowerCase().localeCompare(b.property_value.toLowerCase()));
    }
    return groups;
  }

  categorizeContextWindow(size) {
    if (size <= 10000) return "Small (< 10K)";
    else if (size <= 100000) return "Medium (10K-100K)";
    else if (size <= 200000) return "Large (100K-200K)";
    return "Very Large (> 200K)";
  }

  boolToYesNo(value) {
    return value ? "Yes" : "No";
  }

  filterModelsByCriteria(modelsList, criteria) {
    const result = [];
    for (const model of modelsList) {
      if ((criteria.min_context_size | 0) > 0 && (model.ContextSize | 0) < (criteria.min_context_size | 0)) continue;
      if (!criteria.include_experimental && model.IsExperimental) continue;
      if (!criteria.include_deprecated) {
        const deprecated = model.Metadata && model.Metadata["deprecated"];
        if (deprecated === "true") continue;
      }
      result.push(model);
    }
    return result;
  }

  sortModels(modelsList) {
    const providerPriority = { gemini: 0, openai: 1, anthropic: 2, claude: 2 };
    const geminiTypePriority = { "Flash Lite": 0, Flash: 1, Pro: 2, Thinking: 3, Gemma: 4, Standard: 5 };
    const openaiTypePriority = { Mini: 0, "O Series": 1, "GPT 4.5": 2, "GPT 4": 3, "GPT 3.5": 4, other: 5 };
    const claudeTypePriority = { Sonnet: 0, Opus: 1, Haiku: 2, other: 3 };

    const infos = modelsList.map((model) => {
      const lowerName = (model.Name || "").toLowerCase();
      const provider = (model.Provider || "").toLowerCase();
      let modelType = model.Type;
      let versionNum = 0.0;
      if (model.Version && model.Version.length) {
        const versionStr = (model.Version || "").split("").filter((r) => /[0-9.]/.test(r)).join("");
        const parsed = parseFloat(versionStr);
        if (!Number.isNaN(parsed)) versionNum = parsed;
      }
      if (provider === "openai") {
        if (lowerName.includes("mini")) modelType = "Mini";
        else if (lowerName[0] === "o") modelType = "O Series";
      }
      return { model, lowerName, provider, modelType, version: model.Version, versionNum };
    });

    infos.sort((ia, ib) => {
      const a = ia, b = ib;
      let pa = providerPriority[a.provider];
      let pb = providerPriority[b.provider];
      if (!(a.provider in providerPriority)) pa = 100;
      if (!(b.provider in providerPriority)) pb = 100;
      if (pa !== pb) return pa - pb;

      switch (a.provider) {
        case "gemini": {
          let ta = geminiTypePriority[a.modelType];
          let tb = geminiTypePriority[b.modelType];
          if (!(a.modelType in geminiTypePriority)) ta = geminiTypePriority["Standard"];
          if (!(b.modelType in geminiTypePriority)) tb = geminiTypePriority["Standard"];
          if (ta !== tb) return ta - tb;
          break;
        }
        case "openai": {
          if (a.modelType.toLowerCase() === "mini" && b.modelType.toLowerCase() === "mini") {
            let priorityA, priorityB;
            if (a.lowerName === "4o-mini" || a.lowerName === "gpt-4o-mini") priorityA = 0;
            else if (a.lowerName === "o1-mini" || a.lowerName === "gpt-o1-mini") priorityA = 1;
            else if (a.lowerName.includes("4o-mini")) priorityA = 2;
            else if (a.lowerName.includes("o1-mini")) priorityA = 3;
            else priorityA = 4;

            if (b.lowerName === "4o-mini" || b.lowerName === "gpt-4o-mini") priorityB = 0;
            else if (b.lowerName === "o1-mini" || b.lowerName === "gpt-o1-mini") priorityB = 1;
            else if (b.lowerName.includes("4o-mini")) priorityB = 2;
            else if (b.lowerName.includes("o1-mini")) priorityB = 3;
            else priorityB = 4;

            if (priorityA !== priorityB) return priorityA - priorityB;
            if (a.versionNum !== b.versionNum) return b.versionNum - a.versionNum;
            return a.lowerName.localeCompare(b.lowerName);
          }

          let ta = openaiTypePriority[a.modelType];
          let tb = openaiTypePriority[b.modelType];
          if (!(a.modelType in openaiTypePriority)) ta = openaiTypePriority.other;
          if (!(b.modelType in openaiTypePriority)) tb = openaiTypePriority.other;
          if (ta !== tb) return ta - tb;

          if (a.modelType === "GPT 4" && b.modelType === "GPT 4") {
            const aIs4o = a.lowerName.includes("4o") && !a.lowerName.includes("4o-mini");
            const bIs4o = b.lowerName.includes("4o") && !b.lowerName.includes("4o-mini");
            const aIsBase4o = a.lowerName === "gpt-4o" || a.lowerName === "4o";
            const bIsBase4o = b.lowerName === "gpt-4o" || b.lowerName === "4o";
            if (aIsBase4o && !bIsBase4o) return -1;
            if (!aIsBase4o && bIsBase4o) return 1;
            if (aIs4o && !bIs4o) return -1;
            if (!aIs4o && bIs4o) return 1;
          }

          if (ta === openaiTypePriority.other && tb === openaiTypePriority.other) {
            return a.lowerName.length - b.lowerName.length;
          }
          break;
        }
        case "anthropic":
        case "claude": {
          let ta = claudeTypePriority[a.modelType];
          let tb = claudeTypePriority[b.modelType];
          if (!(a.modelType in claudeTypePriority)) ta = claudeTypePriority.other;
          if (!(b.modelType in claudeTypePriority)) tb = claudeTypePriority.other;
          if (ta !== tb) return ta - tb;
          break;
        }
      }

      if (a.versionNum !== b.versionNum) return b.versionNum - a.versionNum;
      return a.lowerName.localeCompare(b.lowerName);
    });

    for (let i = 0; i < infos.length; i++) modelsList[i] = infos[i].model;
  }

  buildModelHierarchy(modelsList) {
    this.sortModels(modelsList);
    const rootGroups = [];
    if (modelsList.length === 0) return rootGroups;

    let currentProviderGroup = null;
    let currentTypeGroup = null;
    let currentVersionGroup = null;

    for (let i = 0; i < modelsList.length; i++) {
      const model = modelsList[i];
      let provider = model.OriginalProvider;
      if (!provider || provider.length === 0) {
        provider = model.Provider || "Other";
      }
      let modelType = model.Type || "Standard";
      let version = model.Variant || "Default";

      if (i === 0 || !currentProviderGroup || provider !== currentProviderGroup.group_value) {
        currentProviderGroup = { group_name: "provider", group_value: provider, children: [] };
        rootGroups.push(currentProviderGroup);
        currentTypeGroup = null;
        currentVersionGroup = null;
      }

      if (!currentTypeGroup || modelType !== currentTypeGroup.group_value) {
        currentTypeGroup = { group_name: "type", group_value: modelType, children: [] };
        currentProviderGroup.children.push(currentTypeGroup);
        currentVersionGroup = null;
      }

      if (!currentVersionGroup || version !== currentVersionGroup.group_value) {
        currentVersionGroup = { group_name: "version", group_value: version, models: [] };
        currentTypeGroup.children.push(currentVersionGroup);
      }

      currentVersionGroup.models.push(model);
    }
    return rootGroups;
  }
}

// Helpers
function convertProtoModelsToInternal(protoModels) {
  const result = [];
  for (const p of protoModels) {
    result.push({
      ID: p.id,
      Name: p.name,
      ContextSize: p.context_size | 0,
      MaxTokens: p.max_tokens | 0,
      Provider: p.provider,
      OriginalProvider: p.provider,
      DisplayName: p.display_name,
      Description: p.description,
      CostPerToken: p.cost_per_token || 0,
      Capabilities: Array.isArray(p.capabilities) ? [...p.capabilities] : [],
      Family: p.family,
      Type: p.type,
      Series: p.series,
      Variant: p.variant,
      IsDefault: !!p.is_default,
      IsMultimodal: !!p.is_multimodal,
      IsExperimental: !!p.is_experimental,
      Version: p.version,
      Metadata: p.metadata || {},
    });
  }
  return result;
}

function convertInternalModelsToProto(internalModels) {
  const result = [];
  for (const m of internalModels) {
    result.push({
      id: m.ID,
      name: m.Name,
      context_size: m.ContextSize | 0,
      max_tokens: m.MaxTokens | 0,
      provider: m.Provider,
      display_name: m.DisplayName,
      description: m.Description,
      cost_per_token: m.CostPerToken || 0,
      capabilities: m.Capabilities || [],
      family: m.Family,
      type: m.Type,
      series: m.Series,
      variant: m.Variant,
      is_default: !!m.IsDefault,
      is_multimodal: !!m.IsMultimodal,
      is_experimental: !!m.IsExperimental,
      version: m.Version,
      metadata: m.Metadata || {},
    });
  }
  return result;
}

function convertToProtoProperties(properties) {
  return properties.map((p) => ({
    name: p.name,
    display_name: p.display_name,
    description: p.description,
    possible_values: p.possible_values || [],
  }));
}

function convertInternalHierarchicalGroupToProto(internalGroup) {
  const protoModels = convertInternalModelsToProto(internalGroup.Models || internalGroup.models || []);
  const protoGroup = {
    group_name: internalGroup.GroupName || internalGroup.group_name,
    group_value: internalGroup.GroupValue || internalGroup.group_value,
    models: protoModels,
    children: [],
  };
  const children = internalGroup.Children || internalGroup.children || [];
  for (const child of children) protoGroup.children.push(convertInternalHierarchicalGroupToProto(child));
  return protoGroup;
}

function containsAny(slice, values) {
  for (const item of slice || []) {
    for (const v of values) if (item === v) return true;
  }
  return false;
}

module.exports = {
  ModelClassificationHandler,
  DefaultClassificationProperties,
  AvailableClassificationProperties,
};


