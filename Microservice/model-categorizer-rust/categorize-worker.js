// Cloudflare Worker implementing model classification identical to the Rust service (minus gRPC)
// POST /classify expects a JSON body matching LoadedModelList (see src/proto/models.proto)

const PROVIDER_OPENAI = "openai";
const PROVIDER_ANTHROPIC = "anthropic";
const PROVIDER_GEMINI = "gemini";
const PROVIDER_META = "meta";
const PROVIDER_MISTRAL = "mistral";
const PROVIDER_OTHER = "other";
const PROVIDER_OPENROUTER = "openrouter";

const SERIES_CLAUDE3 = "Claude 3";
const SERIES_CLAUDE2 = "Claude 2";
const SERIES_CLAUDE1 = "Claude 1";

const TYPE_O = "O Series";
const TYPE_35 = "GPT 3.5";
const TYPE_4 = "GPT 4";
const TYPE_45 = "GPT 4.5";
const TYPE_MINI = "Mini";
const TYPE_OPUS = "Opus";
const TYPE_SONNET = "Sonnet";
const TYPE_HAIKU = "Haiku";
const TYPE_THINKING = "Thinking";
const TYPE_PRO = "Pro";
const TYPE_GEMMA = "Gemma";
const TYPE_FLASH_LITE = "Flash Lite";
const TYPE_FLASH = "Flash";
const TYPE_VISION = "Vision";
const TYPE_STANDARD = "Standard";
const TYPE_EMBEDDING = "Embedding";
const TYPE_IMAGE = "Image Generation";

const VERSION_10 = "1.0";
const VERSION_15 = "1.5";
const VERSION_20 = "2.0";
const VERSION_25 = "2.5";
const VERSION_30 = "3.0";
const VERSION_35 = "3.5";
const VERSION_37 = "3.7";
const VERSION_40 = "4.0";
const VERSION_45 = "4.5";

const CAP_VISION = "vision";
const CAP_FUNCTION_CALLING = "function-calling";
const CAP_EMBEDDING = "embedding";
const CAP_CHAT = "chat";

class PatternMatcher {
  constructor() {
    this.providerPatterns = new Map([
      [PROVIDER_OPENAI, ["openai", "gpt", "o1", "dall-e"]],
      [PROVIDER_ANTHROPIC, ["anthropic", "claude"]],
      [PROVIDER_GEMINI, ["gemini", "google"]],
      [PROVIDER_META, ["meta", "llama", "meta-llama"]],
      [PROVIDER_MISTRAL, ["mistral", "mixtral"]],
      [PROVIDER_OPENROUTER, ["openrouter"]],
    ]);

    this.seriesPatterns = new Map([
      [SERIES_CLAUDE3, ["claude-3", "claude3", "claude-3.5", "claude-3.7"]],
      [SERIES_CLAUDE2, ["claude-2", "claude2"]],
      [SERIES_CLAUDE1, ["claude-1", "claude1", "claude-instant"]],
      [`Gemini ${VERSION_10}`, ["gemini-1.0", "gemini-1.0-pro"]],
      [`Gemini ${VERSION_15}`, ["gemini-1.5", "gemini-1.5-pro", "gemini-1.5-flash"]],
      [`Gemini ${VERSION_20}`, ["gemini-2.0", "gemini-2.0-pro", "gemini-2.0-flash"]],
      [`Gemini ${VERSION_25}`, ["gemini-2.5", "gemini-2.5-pro", "gemini-2.5-flash"]],
      ["Gemma 2", ["gemma-2"]],
      [TYPE_IMAGE, ["dall-e", "imagen", "midjourney", "stable-diffusion"]],
      [TYPE_EMBEDDING, ["embedding", "text-embedding", "embed"]],
    ]);

    this.typePatterns = new Map([
      [TYPE_O, ["o1", "o3", "o4"]],
      [TYPE_35, ["gpt-3.5", "gpt3.5"]],
      [TYPE_4, ["gpt-4", "gpt4", "gpt-4o"]],
      [TYPE_45, ["gpt-4.5", "gpt4.5"]],
      [TYPE_MINI, ["mini"]],
      [TYPE_OPUS, ["opus"]],
      [TYPE_SONNET, ["sonnet"]],
      [TYPE_HAIKU, ["haiku"]],
      [TYPE_PRO, ["pro"]],
      [TYPE_FLASH_LITE, ["flash-lite"]],
      [TYPE_FLASH, ["flash"]],
      [TYPE_THINKING, ["thinking"]],
      [TYPE_VISION, ["vision", "multimodal"]],
      [TYPE_EMBEDDING, ["embedding", "embed", "tts"]],
    ]);

    this.capabilityPatterns = new Map([
      [CAP_VISION, ["vision", "image", "multimodal"]],
      [CAP_FUNCTION_CALLING, ["function", "tool", "api"]],
      [CAP_EMBEDDING, ["embedding", "embed", "vector"]],
      ["audio", ["whisper", "tts", "speech", "audio"]],
      [CAP_CHAT, ["chat", "conversation", "completion"]],
    ]);
  }

  matchProviderByName(providerName) {
    const lower = (providerName || "").toLowerCase();
    for (const key of this.providerPatterns.keys()) {
      if (lower === key.toLowerCase()) return key;
    }
    return "";
  }

  matchProviderByPattern(modelName) {
    const lower = (modelName || "").toLowerCase();
    for (const [provider, patterns] of this.providerPatterns) {
      for (const pat of patterns) {
        if (lower.includes(pat)) return provider;
      }
    }
    return "";
  }

  matchClaudeVersion(modelName) {
    const lower = (modelName || "").toLowerCase();
    for (const pat of this.seriesPatterns.get(SERIES_CLAUDE3) || []) if (lower.includes(pat)) return SERIES_CLAUDE3;
    for (const pat of this.seriesPatterns.get(SERIES_CLAUDE2) || []) if (lower.includes(pat)) return SERIES_CLAUDE2;
    for (const pat of this.seriesPatterns.get(SERIES_CLAUDE1) || []) if (lower.includes(pat)) return SERIES_CLAUDE1;
    return "";
  }

  matchGeminiVersion(modelName) {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("2.5")) return `Gemini ${VERSION_25}`;
    if (lower.includes("2.0")) return `Gemini ${VERSION_20}`;
    if (lower.includes("1.5")) return `Gemini ${VERSION_15}`;
    return `Gemini ${VERSION_10}`;
  }

  matchSeriesByPattern(modelName) {
    const lower = (modelName || "").toLowerCase();
    for (const [series, patterns] of this.seriesPatterns) {
      for (const pat of patterns) {
        if (lower.includes(pat)) return series;
      }
    }
    return "";
  }

  matchOpenAIType(modelName) {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("mini")) return TYPE_MINI;
    if (lower.includes("o1") || lower.includes("o3")) return TYPE_O;
    if (lower.includes("gpt-4.5")) return TYPE_45;
    if (lower.includes("gpt-4")) return TYPE_4;
    if (lower.includes("gpt-3.5")) return TYPE_35;
    return TYPE_STANDARD;
  }

  matchAnthropicType(modelName) {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("opus")) return TYPE_OPUS;
    if (lower.includes("sonnet")) return TYPE_SONNET;
    if (lower.includes("haiku")) return TYPE_HAIKU;
    return TYPE_STANDARD;
  }

  matchGeminiType(modelName) {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("flash-lite")) return TYPE_FLASH_LITE;
    if (lower.includes("thinking")) return TYPE_THINKING;
    if (lower.includes("flash")) return TYPE_FLASH;
    if (lower.includes("pro")) return TYPE_PRO;
    if (lower.includes("gemma")) return TYPE_GEMMA;
    return TYPE_STANDARD;
  }

  matchTypeByPattern(modelName) {
    const lower = (modelName || "").toLowerCase();
    for (const [typ, patterns] of this.typePatterns) {
      for (const pat of patterns) {
        if (lower.includes(pat)) return typ;
      }
    }
    return "";
  }

  matchOpenAIVariant(modelName) {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("gpt-4.5")) return `GPT-${VERSION_45}`;
    if (lower.includes("gpt-4o-mini")) return "GPT-4o Mini";
    if (lower.includes("gpt-4o")) return "GPT-4o";
    if (lower.includes("gpt-4-turbo")) return "GPT-4 Turbo";
    if (lower.includes("gpt-4-vision")) return "GPT-4 Vision";
    if (lower.includes("o1-mini")) return "O1 Mini";
    if (lower.includes("o1")) return "O1";
    return "";
  }

  matchAnthropicVariant(modelName) {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("claude-3.7")) return `Claude ${VERSION_37}`;
    if (lower.includes("claude-3.5")) return `Claude ${VERSION_35}`;
    if (lower.includes("claude-3")) return `Claude ${VERSION_30}`;
    if (lower.includes("claude-2")) return `Claude ${VERSION_20}`;
    if (lower.includes("claude-instant")) return "Claude Instant";
    return "";
  }

  buildGeminiVariant(modelName) {
    const lower = (modelName || "").toLowerCase();
    const version = lower.includes("2.5") ? VERSION_25 : lower.includes("2.0") ? VERSION_20 : lower.includes("1.5") ? VERSION_15 : lower.includes("1.0") ? VERSION_10 : "";
    const typ = lower.includes("flash-lite") ? TYPE_FLASH_LITE : lower.includes("thinking") ? TYPE_THINKING : lower.includes("flash") ? TYPE_FLASH : lower.includes("pro") ? TYPE_PRO : "";
    if (version && typ) return `Gemini ${version} ${typ}`;
    if (version) return `Gemini ${version}`;
    if (typ) return `Gemini ${typ}`;
    return "";
  }

  addCapabilities(caps, modelType, modelName, provider, series) {
    const lower = (modelName || "").toLowerCase();
    if (
      lower.includes("vision") ||
      lower.includes("multimodal") ||
      [TYPE_4, TYPE_45, TYPE_O].includes(modelType) ||
      series === SERIES_CLAUDE3 ||
      lower.includes("4o") ||
      (series || "").startsWith("Gemini")
    ) {
      caps.set(CAP_VISION, true);
    }
    if ([TYPE_4, TYPE_45, TYPE_35, TYPE_O].includes(modelType) || series === SERIES_CLAUDE3 || (series || "").startsWith("Gemini")) {
      caps.set(CAP_FUNCTION_CALLING, true);
    }
  }
}

class ContextResolver {
  constructor() {
    this.contextSizes = new Map([
      // OpenAI
      ["gpt-4o", 128000],
      ["gpt-4o-mini", 128000],
      ["gpt-4-turbo", 128000],
      ["gpt-4-vision", 128000],
      ["gpt-4-32k", 32768],
      ["gpt-4", 8192],
      ["gpt-4.5", 128000],
      ["gpt-3.5-turbo-16k", 16385],
      ["gpt-3.5-turbo", 4096],
      ["o1", 32768],
      ["o1-mini", 32768],
      // Claude
      ["claude-3-opus", 200000],
      ["claude-3-sonnet", 200000],
      ["claude-3-haiku", 200000],
      ["claude-3.5-sonnet", 200000],
      ["claude-3.7-opus", 200000],
      ["claude-2", 100000],
      ["claude-instant", 100000],
      // Gemini
      ["gemini-1.0-pro", 32768],
      ["gemini-1.5-pro", 1_000_000],
      ["gemini-1.5-flash", 1_000_000],
      ["gemini-2.0-pro", 2_000_000],
      ["gemini-2.0-flash", 1_000_000],
      ["gemini-2.0-flash-lite", 1_000_000],
    ]);
  }

  getContextSize(modelId) {
    const lower = (modelId || "").toLowerCase();
    for (const [model, size] of this.contextSizes) {
      if (lower.includes(model)) return size;
    }
    return this.getContextSizeByFamily(lower);
  }

  getContextSizeByFamily(lower) {
    if (lower.includes("gpt-4.5")) return 128000;
    if (lower.includes("gpt-4")) {
      if (lower.includes("32k")) return 32768;
      if (lower.includes("turbo") || lower.includes("o")) return 128000;
      return 8192;
    }
    if (lower.includes("gpt-3.5")) return lower.includes("16k") ? 16385 : 4096;
    if (lower.includes("claude-3")) return 200000;
    if (lower.includes("claude-2") || lower.includes("claude-instant")) return 100000;
    if (lower.includes("gemini-1.0")) return 32768;
    if (lower.includes("gemini-1.5") || lower.includes("gemini-2.0")) {
      return 1_000_000;
    }
    return 0;
  }
}

class ModelClassifier {
  constructor() {
    this.patterns = new PatternMatcher();
    this.context = new ContextResolver();
  }

  classifyModel(modelId, providerHint) {
    const modelLower = (modelId || "").toLowerCase();
    if (this.isImageGenerationModel(modelLower)) return this.createImageGenerationMetadata(modelLower, providerHint);
    if (this.isEmbeddingModel(modelLower)) return this.createEmbeddingModelMetadata(modelLower, providerHint);
    return this.buildStandardModelMetadata(modelLower, providerHint);
  }

  createImageGenerationMetadata(modelName, providerHint) {
    const provider = this.determineProvider(modelName, providerHint);
    return {
      provider,
      series: TYPE_IMAGE,
      model_type: TYPE_IMAGE,
      variant: "Image Generation",
      context: 0,
      capabilities: [TYPE_IMAGE],
      is_multimodal: false,
      is_experimental: false,
      display_name: modelName,
    };
  }

  createEmbeddingModelMetadata(modelName, providerHint) {
    const provider = this.determineProvider(modelName, providerHint);
    return {
      provider,
      series: TYPE_EMBEDDING,
      model_type: TYPE_EMBEDDING,
      variant: "Embedding",
      context: 0,
      capabilities: [CAP_EMBEDDING],
      is_multimodal: false,
      is_experimental: false,
      display_name: modelName,
    };
  }

  buildStandardModelMetadata(modelName, providerHint) {
    const provider = this.determineProvider(modelName, providerHint);
    const series = this.determineSeries(modelName, provider);
    const model_type = this.determineType(modelName, provider, series);
    const variant = this.determineVariant(modelName, provider, series);
    const context = this.context.getContextSize(modelName);
    const capabilities = this.detectCapabilities(modelName, provider, series);
    const is_multimodal = this.isMultimodal(modelName, capabilities, series);
    const is_experimental = this.isExperimental(modelName);
    return { provider, series, model_type, variant, context, capabilities, is_multimodal, is_experimental, display_name: modelName };
  }

  determineProvider(modelName, providerHint) {
    if (providerHint) {
      const p = this.patterns.matchProviderByName(providerHint.toLowerCase());
      if (p) return p;
    }
    const slashIdx = (modelName || "").indexOf("/");
    if (slashIdx > 0) {
      const pref = modelName.slice(0, slashIdx).toLowerCase();
      const p = this.patterns.matchProviderByName(pref);
      if (p) return p;
    }
    const p = this.patterns.matchProviderByPattern(modelName);
    return p || PROVIDER_OTHER;
  }

  determineSeries(modelName, provider) {
    switch (provider) {
      case PROVIDER_OPENAI: {
        const c0 = (modelName || "").charAt(0);
        if (c0 === "o") return "O";
        if (c0 === "g") return "GPT";
        if (c0 === "d") return "DALL-E";
        break;
      }
      case PROVIDER_ANTHROPIC: {
        const v = this.patterns.matchClaudeVersion(modelName);
        if (v) return v;
        break;
      }
      case PROVIDER_GEMINI:
        return this.patterns.matchGeminiVersion(modelName);
      default:
        break;
    }
    const v = this.patterns.matchSeriesByPattern(modelName);
    return v || "General";
  }

  determineType(modelName, provider, series) {
    switch (provider) {
      case PROVIDER_OPENAI:
        return this.patterns.matchOpenAIType(modelName);
      case PROVIDER_ANTHROPIC:
        return this.patterns.matchAnthropicType(modelName);
      case PROVIDER_GEMINI:
        return this.patterns.matchGeminiType(modelName);
      default:
        break;
    }
    const t = this.patterns.matchTypeByPattern(modelName);
    return t || TYPE_STANDARD;
  }

  determineVariant(modelName, provider, series) {
    switch (provider) {
      case PROVIDER_OPENAI: {
        const v = this.patterns.matchOpenAIVariant(modelName);
        if (v) return v;
        break;
      }
      case PROVIDER_ANTHROPIC: {
        const v = this.patterns.matchAnthropicVariant(modelName);
        if (v) return v;
        break;
      }
      case PROVIDER_GEMINI: {
        const v = this.patterns.buildGeminiVariant(modelName);
        if (v) return v;
        break;
      }
      default:
        break;
    }
    const v = extractVersionVariant(modelName, series);
    return v || series;
  }

  detectCapabilities(modelName, provider, series) {
    const caps = new Map();
    this.patterns.addCapabilities(caps, this.determineType(modelName, provider, series), modelName, provider, series);
    caps.set(CAP_CHAT, true);
    const list = Array.from(caps.entries()).filter(([, v]) => v).map(([k]) => k);
    list.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return list;
  }

  isEmbeddingModel(modelName) {
    const lower = (modelName || "").toLowerCase();
    return lower.includes("embedding") || lower.includes("embed") || lower.includes("text-embedding");
  }

  isImageGenerationModel(modelName) {
    const lower = (modelName || "").toLowerCase();
    return lower.includes("image") || lower.includes("dall-e") || lower.includes("stable-diffusion");
  }

  isMultimodal(modelName, caps, series) {
    return caps.includes(CAP_VISION) || (series || "").includes("Vision");
  }

  isExperimental(modelName) {
    const lower = (modelName || "").toLowerCase();
    return lower.includes("alpha") || lower.includes("beta") || lower.includes("experimental");
  }
}

function extractVersionVariant(modelName, series) {
  const nums = extractVersionNumbers(modelName);
  if (!nums.length) return "";
  return `${series} ${nums.join(".")}`;
}

function extractVersionNumbers(s) {
  const filtered = (s || "").split("").map(c => /[0-9.]/.test(c) ? c : " ").join("");
  return filtered.split(/\s+/).filter(Boolean).map(x => parseInt(x, 10)).filter(n => Number.isFinite(n));
}

function availableClassificationProperties() {
  const props = [
    {
      name: "provider",
      display_name: "Provider",
      description: "The AI provider that offers the model",
      possible_values: [
        "openai", "anthropic", "gemini", "meta", "mistral", "cohere", "openrouter", "other",
      ],
    },
    {
      name: "family",
      display_name: "Model Family",
      description: "The family or generation that the model belongs to",
      possible_values: [
        "GPT-4", "GPT-3.5", "Claude 3", "Claude 2", "Gemini 1.5", "Gemini 1.0", "Llama", "Mistral",
      ],
    },
    {
      name: "type",
      display_name: "Type",
      description: "The specific type or version of the model",
      possible_values: [
        "Vision", "Standard", "Pro", "Flash", "Gemma", "Opus", "Sonnet", "Haiku", "Embedding", "O Series", "GPT 3.5", "GPT 4", "GPT 4.5", "Mini", "Flash Lite", "Thinking", "Image Generation",
      ],
    },
    {
      name: "context_window",
      display_name: "Context Window",
      description: "Grouping based on context window size",
      possible_values: [
        "Small (< 10K)", "Medium (10K-100K)", "Large (100K-200K)", "Very Large (> 200K)",
      ],
    },
    {
      name: "capability",
      display_name: "Capabilities",
      description: "Special model capabilities",
      possible_values: [
        "vision", "function-calling", "embedding", "streaming", "chat", "audio",
      ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    },
  ];
  return props;
}

function categorizeContextWindow(size) {
  if (size >= 0 && size <= 10000) return "Small (< 10K)";
  if (size <= 100000) return "Medium (10K-100K)";
  if (size <= 200000) return "Large (100K-200K)";
  return "Very Large (> 200K)";
}

function sortModels(modelsList) {
  const providerPriority = new Map([
    ["gemini", 0],
    ["openai", 1],
    ["openrouter", 2],
    ["anthropic", 3],
    ["claude", 3],
  ]);
  const geminiTypePriority = new Map([
    [TYPE_FLASH_LITE, 0],
    [TYPE_FLASH, 1],
    [TYPE_PRO, 2],
    [TYPE_THINKING, 3],
    [TYPE_GEMMA, 4],
    [TYPE_STANDARD, 5],
  ]);
  const openaiTypePriority = new Map([
    [TYPE_MINI, 0],
    [TYPE_O, 1],
    [TYPE_45, 2],
    [TYPE_4, 3],
    [TYPE_35, 4],
    ["other", 5],
  ]);
  const claudeTypePriority = new Map([
    [TYPE_SONNET, 0],
    [TYPE_OPUS, 1],
    [TYPE_HAIKU, 2],
    ["other", 3],
  ]);

  modelsList.sort((a, b) => {
    const pa = (a.provider || "").toLowerCase();
    const pb = (b.provider || "").toLowerCase();
    const prA = providerPriority.has(pa) ? providerPriority.get(pa) : 100;
    const prB = providerPriority.has(pb) ? providerPriority.get(pb) : 100;
    if (prA !== prB) return prA - prB;

    const ta = a.model_type || TYPE_STANDARD;
    const tb = b.model_type || TYPE_STANDARD;

    if (pa === "openai" && ta.toLowerCase() === TYPE_MINI.toLowerCase() && tb.toLowerCase() === TYPE_MINI.toLowerCase()) {
      const na = (a.name || a.id || "").toLowerCase();
      const nb = (b.name || b.id || "").toLowerCase();
      const miniPrio = (name) => {
        if (name === "4o-mini" || name === "gpt-4o-mini") return 0;
        if (name === "o1-mini" || name === "gpt-o1-mini") return 1;
        if (name.includes("4o-mini")) return 2;
        if (name.includes("o1-mini")) return 3;
        return 4;
      };
      const ma = miniPrio(na);
      const mb = miniPrio(nb);
      if (ma !== mb) return ma - mb;
      const va = parseFloat((a.version || "").replace(/[^0-9.]/g, "")) || 0.0;
      const vb = parseFloat((b.version || "").replace(/[^0-9.]/g, "")) || 0.0;
      if (Math.abs(va - vb) > Number.EPSILON) return vb - va;
      return na.localeCompare(nb);
    }

    if (pa === "gemini") {
      const ra = geminiTypePriority.has(ta) ? geminiTypePriority.get(ta) : geminiTypePriority.get(TYPE_STANDARD);
      const rb = geminiTypePriority.has(tb) ? geminiTypePriority.get(tb) : geminiTypePriority.get(TYPE_STANDARD);
      if (ra !== rb) return ra - rb;
    } else if (pa === "openai") {
      const ra = openaiTypePriority.has(ta) ? openaiTypePriority.get(ta) : openaiTypePriority.get("other");
      const rb = openaiTypePriority.has(tb) ? openaiTypePriority.get(tb) : openaiTypePriority.get("other");
      if (ra !== rb) return ra - rb;
      if (ta === TYPE_4 && tb === TYPE_4) {
        const na = (a.name || a.id || "").toLowerCase();
        const nb = (b.name || b.id || "").toLowerCase();
        const ba = na === "gpt-4o" || na === "4o";
        const bb = nb === "gpt-4o" || nb === "4o";
        if (ba !== bb) return (bb ? 1 : 0) - (ba ? 1 : 0);
        const va = na.includes("4o") && !na.includes("4o-mini");
        const vb = nb.includes("4o") && !nb.includes("4o-mini");
        if (va !== vb) return (vb ? 1 : 0) - (va ? 1 : 0);
      }
      if ((openaiTypePriority.get(ta) || 999) === openaiTypePriority.get("other") && (openaiTypePriority.get(tb) || 999) === openaiTypePriority.get("other")) {
        const la = (a.name || a.id || "").length;
        const lb = (b.name || b.id || "").length;
        return la - lb;
      }
    } else if (pa === "anthropic" || pa === "claude") {
      const ra = claudeTypePriority.has(ta) ? claudeTypePriority.get(ta) : claudeTypePriority.get("other");
      const rb = claudeTypePriority.has(tb) ? claudeTypePriority.get(tb) : claudeTypePriority.get("other");
      if (ra !== rb) return ra - rb;
    }

    const va = parseFloat((a.version || "").replace(/[^0-9.]/g, "")) || 0.0;
    const vb = parseFloat((b.version || "").replace(/[^0-9.]/g, "")) || 0.0;
    if (Math.abs(va - vb) > Number.EPSILON) return vb - va;

    const na = (a.name || a.id || "").toLowerCase();
    const nb = (b.name || b.id || "").toLowerCase();
    return na.localeCompare(nb);
  });
}

function buildModelHierarchy(models) {
  const sorted = models.map(m => ({ ...m }));
  sortModels(sorted);
  const rootGroups = [];
  let providerIdx = null;
  let typeIdx = null;
  let versionIdx = null;

  for (const m of sorted) {
    let provider = m.original_provider || m.provider || "";
    if (!provider) provider = "Other";
    let modelType = m.model_type || TYPE_STANDARD;
    if (!modelType) modelType = TYPE_STANDARD;
    let version = m.variant || "Default";
    if (!version) version = "Default";

    if (
      providerIdx === null ||
      rootGroups[providerIdx].group_value !== provider
    ) {
      rootGroups.push({ group_name: "provider", group_value: provider, models: [], children: [] });
      providerIdx = rootGroups.length - 1;
      typeIdx = null;
      versionIdx = null;
    }
    const pg = rootGroups[providerIdx];

    if (
      typeIdx === null ||
      pg.children[typeIdx].group_value !== modelType
    ) {
      pg.children.push({ group_name: "type", group_value: modelType, models: [], children: [] });
      typeIdx = pg.children.length - 1;
      versionIdx = null;
    }
    const tg = pg.children[typeIdx];

    if (
      versionIdx === null ||
      tg.children[versionIdx].group_value !== version
    ) {
      tg.children.push({ group_name: "version", group_value: version, models: [], children: [] });
      versionIdx = tg.children.length - 1;
    }
    const vg = tg.children[versionIdx];

    vg.models.push(m);
  }

  return rootGroups;
}

function enhanceModelsWithClassifier(models) {
  const classifier = new ModelClassifier();
  const enhanced = [];
  for (const m of models) {
    const clone = { ...m };
    clone.original_provider = m.provider || "";
    const meta = classifier.classifyModel(clone.id, clone.provider || "");
    clone.provider = meta.provider;
    clone.series = meta.series;
    clone.type = undefined; // keep original proto field name mapping
    clone.model_type = meta.model_type; // internal for sorting
    clone.variant = meta.variant;
    if (!clone.context_size || clone.context_size === 0) {
      clone.context_size = meta.context;
    }
    clone.capabilities = meta.capabilities;
    clone.is_multimodal = meta.is_multimodal;
    clone.is_experimental = meta.is_experimental;
    if (!clone.display_name) clone.display_name = meta.display_name;
    enhanced.push(clone);
  }
  return enhanced;
}

function toResponseHierarchicalGroups(groups) {
  // Ensure models conform to proto field names on output
  const mapModel = (m) => ({
    id: m.id || "",
    name: m.name || "",
    context_size: m.context_size || 0,
    max_tokens: m.max_tokens || 0,
    provider: m.provider || "",
    display_name: m.display_name || "",
    description: m.description || "",
    cost_per_token: typeof m.cost_per_token === "number" ? m.cost_per_token : 0,
    capabilities: Array.isArray(m.capabilities) ? m.capabilities : [],
    family: m.family || "",
    type: m.model_type || m.type || "",
    series: m.series || "",
    variant: m.variant || "",
    is_default: !!m.is_default,
    is_multimodal: !!m.is_multimodal,
    is_experimental: !!m.is_experimental,
    version: m.version || "",
    metadata: m.metadata || {},
  });

  const mapGroup = (g) => ({
    group_name: g.group_name,
    group_value: g.group_value,
    models: (g.models || []).map(mapModel),
    children: (g.children || []).map(mapGroup),
  });

  return groups.map(mapGroup);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/classify") {
      try {
        const body = await request.json();
        const models = Array.isArray(body?.models) ? body.models : [];
        const internal = enhanceModelsWithClassifier(models);
        const hierarchicalGroups = buildModelHierarchy(internal);
        const availableProps = availableClassificationProperties();

        const response = {
          classified_groups: [],
          available_properties: availableProps,
          error_message: "",
          hierarchical_groups: toResponseHierarchicalGroups(hierarchicalGroups),
        };
        return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
      } catch (err) {
        const response = {
          classified_groups: [],
          available_properties: availableClassificationProperties(),
          error_message: (err && err.message) ? err.message : "invalid request",
          hierarchical_groups: [],
        };
        return new Response(JSON.stringify(response), { status: 400, headers: { "content-type": "application/json" } });
      }
    }
    return new Response("Not Found", { status: 404 });
  }
};


