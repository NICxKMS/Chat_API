const {
  ProviderOpenAI,
  ProviderAnthropicA,
  ProviderGemini,
  ProviderOther,
  ProviderOpenrouter,
  SeriesClaude3,
  TypeO,
  Type35,
  Type4,
  Type45,
  TypeStandard,
  TypeEmbedding,
  TypeImage,
  CapVision,
} = require("./constants");
const { PatternMatcher } = require("./patternMatcher");
const { ContextResolver } = require("./contextResolver");
const { DefaultModels } = require("./defaultModels");

class ModelClassifier {
  constructor() {
    this.patterns = new PatternMatcher();
    this.context = new ContextResolver();
    this.defaults = new DefaultModels();
  }

  ClassifyModel(modelID, providerHint) {
    const modelLower = (modelID || "").toLowerCase();
    let metadata;
    if (this.isImageGenerationModel(modelLower)) {
      metadata = this.createImageGenerationMetadata(modelLower, providerHint);
    } else if (this.isEmbeddingModel(modelLower)) {
      metadata = this.createEmbeddingModelMetadata(modelLower, providerHint);
    } else {
      metadata = this.buildStandardModelMetadata(modelLower, providerHint);
    }
    return metadata;
  }

  createImageGenerationMetadata(modelName, providerHint) {
    return {
      Provider: this.determineProvider(modelName, providerHint),
      Series: TypeImage,
      Type: TypeImage,
      Variant: "Image Generation",
      Capabilities: [TypeImage],
      IsMultimodal: false,
    };
  }

  createEmbeddingModelMetadata(modelName, providerHint) {
    return {
      Provider: this.determineProvider(modelName, providerHint),
      Series: TypeEmbedding,
      Type: TypeEmbedding,
      Variant: "Embedding",
      Capabilities: ["embedding"],
      IsMultimodal: false,
    };
  }

  buildStandardModelMetadata(modelName, providerHint) {
    const metadata = {
      Provider: this.determineProvider(modelName, providerHint),
      Capabilities: [],
    };

    metadata.Series = this.determineSeries(modelName, metadata.Provider);
    metadata.Type = this.determineType(modelName, metadata.Provider, metadata.Series);
    metadata.Variant = this.determineVariant(modelName, metadata.Provider, metadata.Series);
    metadata.Context = this.GetContextSize(modelName);
    metadata.Capabilities = this.detectCapabilities(modelName, metadata.Provider, metadata.Series);
    metadata.IsMultimodal = this.isMultimodal(modelName, metadata.Capabilities, metadata.Series);
    metadata.IsExperimental = this.isExperimental(modelName);
    return metadata;
  }

  determineProvider(modelName, providerHint) {
    if (providerHint) {
      const providerLower = providerHint.toLowerCase();
      const provider = this.patterns.matchProviderByName(providerLower);
      if (provider) return provider;
    }
    if ((modelName || "").includes("/")) {
      const parts = modelName.split("/", 2);
      const potentialProvider = (parts[0] || "").toLowerCase();
      const provider = this.patterns.matchProviderByName(potentialProvider);
      if (provider) return provider;
    }
    const provider = this.patterns.matchProviderByPattern(modelName);
    if (provider) return provider;
    return ProviderOther;
  }

  determineSeries(modelName, provider) {
    switch (provider) {
      case ProviderOpenAI:
        if (modelName[0] === "o") return "O";
        if (modelName[0] === "g") return "GPT";
        if (modelName[0] === "d") return "DALL-E";
        break;
      case ProviderAnthropicA:
        {
          const series = this.patterns.matchClaudeVersion(modelName);
          if (series) return series;
        }
        break;
      case ProviderGemini:
        return this.patterns.matchGeminiVersion(modelName);
    }
    const series = this.patterns.matchSeriesByPattern(modelName);
    if (series) return series;
    return "General";
  }

  determineType(modelName, provider, series) {
    const m = modelName.toLowerCase();
    switch (provider) {
      case ProviderOpenAI:
        return this.patterns.matchOpenAIType(m);
      case ProviderAnthropicA:
        return this.patterns.matchAnthropicType(m);
      case ProviderGemini:
        return this.patterns.matchGeminiType(m);
    }
    const t = this.patterns.matchTypeByPattern(m);
    if (t) return t;
    return TypeStandard;
  }

  determineVariant(modelName, provider, series) {
    const m = modelName.toLowerCase();
    switch (provider) {
      case ProviderOpenAI: {
        const v = this.patterns.matchOpenAIVariant(m);
        if (v) return v;
        break;
      }
      case ProviderAnthropicA: {
        const v = this.patterns.matchAnthropicVariant(m);
        if (v) return v;
        break;
      }
      case ProviderGemini: {
        const v = this.patterns.buildGeminiVariant(m);
        if (v) return v;
        break;
      }
    }
    const variant = extractVersionVariant(modelName, series);
    if (variant) return variant;
    return series;
  }

  detectCapabilities(modelName, provider, series) {
    const caps = {};
    const m = modelName.toLowerCase();
    const modelType = this.determineType(m, provider, series);
    this.patterns.addCapabilities(caps, modelType, m, provider, series);
    caps["chat"] = true;
    const result = Object.keys(caps);
    result.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return result;
  }

  isEmbeddingModel(modelName) {
    const m = modelName.toLowerCase();
    return m.includes("embedding") || m.includes("embed") || m.includes("text-embedding");
  }

  isImageGenerationModel(modelName) {
    const m = modelName.toLowerCase();
    return m.includes("dall-e") || m.includes("image") || m.includes("midjourney") || m.includes("stable-diffusion");
  }

  isMultimodal(modelName, capabilities, series) {
    if (capabilities && capabilities.includes(CapVision)) return true;
    const m = modelName.toLowerCase();
    const type = this.determineType(m, this.determineProvider(m, ""), series);
    if (type === Type4 || type === Type45 || type === TypeO || series === SeriesClaude3 || (series && series.includes("Gemini"))) return true;
    return m.includes("vision") || m.includes("multimodal");
  }

  isExperimental(modelName) {
    const m = modelName.toLowerCase();
    return m.includes("experimental") || m.includes("preview") || m.includes("alpha") || m.includes("beta");
  }

  IsDefaultModelName(modelName) {
    return this.defaults.IsDefaultModel(modelName) || (modelName || "").toLowerCase().includes("latest");
  }

  GetContextSize(modelName) {
    return this.context.GetContextSize(modelName);
  }

  GetModelHierarchy(modelID, provider) {
    const metadata = this.ClassifyModel(modelID, provider);
    return [metadata.Provider, metadata.Series, metadata.Type, metadata.Variant];
  }

  GetStandardizedVersion(modelName) {
    const m = (modelName || "").toLowerCase();
    if (m.includes("4.5")) return "4.5";
    else if (m.includes("4.0") || m.includes("4o")) return "4.0";
    else if (m.includes("3.7")) return "3.7";
    else if (m.includes("3.5")) return "3.5";
    else if (m.includes("3.0")) return "3.0";
    else if (m.includes("2.5")) return "2.5";
    else if (m.includes("2.0")) return "2.0";
    else if (m.includes("1.5")) return "1.5";
    else if (m.includes("1.0")) return "1.0";
    return "";
  }
}

function NormalizeModelName(modelID, provider) {
  if ((provider || "").toLowerCase() === ProviderOpenrouter) {
    const parts = (modelID || "").split("/", 2);
    if (parts.length === 2) {
      const knownProviders = ["anthropic", "openai", "google", "gemini", "meta-llama", "mistralai"];
      const sub = (parts[0] || "").toLowerCase();
      if (knownProviders.includes(sub)) return parts[1];
    }
  }
  return modelID;
}

function extractVersionVariant(modelName, series) {
  const versionNumbers = ExtractVersionNumbers(modelName);
  if (versionNumbers.length > 0) {
    const versionStr = (modelName || "")
      .split("")
      .map((c) => (/[0-9.]/.test(c) ? c : " "))
      .join("")
      .trim()
      .split(/\s+/)
      .join(".");
    if (versionStr) return `${series} ${versionStr}`;
  }
  return "";
}

function ExtractVersionNumbers(version) {
  const numbers = [];
  let current = "";
  for (const c of version || "") {
    if (c >= "0" && c <= "9") current += c;
    else if (current) {
      numbers.push(parseInt(current, 10));
      current = "";
    }
  }
  if (current) numbers.push(parseInt(current, 10));
  return numbers;
}

function IsNewerVersion(a, b) {
  const dateRe = /^\d{8}$/;
  const parseDate = (s) => (dateRe.test(s) ? new Date(s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8)) : null);
  const aDate = parseDate(a);
  const bDate = parseDate(b);
  if (aDate && bDate) return aDate > bDate;
  const aParts = ExtractVersionNumbers(a);
  const bParts = ExtractVersionNumbers(b);
  if (aParts.length && bParts.length) {
    const minLen = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < minLen; i++) {
      if (aParts[i] !== bParts[i]) return aParts[i] > bParts[i];
    }
    return aParts.length > bParts.length;
  }
  if (aDate) return true;
  if (bDate) return false;
  return a > b;
}

module.exports = {
  ModelClassifier,
  NormalizeModelName,
  ExtractVersionNumbers,
  IsNewerVersion,
};


