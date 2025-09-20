const {
  ProviderOpenAI,
  ProviderAnthropicA,
  ProviderGemini,
  ProviderMeta,
  ProviderMistral,
  SeriesClaude3,
  SeriesClaude2,
  SeriesClaude1,
  TypeO,
  Type35,
  Type4,
  Type45,
  TypeMini,
  TypeOpus,
  TypeSonnet,
  TypeHaiku,
  TypePro,
  TypeFlashLite,
  TypeFlash,
  TypeThinking,
  TypeGemma,
  TypeVision,
  TypeEmbedding,
  CapVision,
  CapFunctionCalling,
  CapChat,
  Version10,
  Version15,
  Version20,
  Version25,
} = require("./constants");

class PatternMatcher {
  constructor() {
    this.providerPatterns = {
      [ProviderOpenAI]: ["openai", "gpt", "o1", "dall-e"],
      [ProviderAnthropicA]: ["anthropic", "claude"],
      [ProviderGemini]: ["gemini", "google"],
      [ProviderMeta]: ["meta", "llama", "meta-llama"],
      [ProviderMistral]: ["mistral", "mixtral"],
    };

    this.seriesPatterns = {
      [SeriesClaude3]: ["claude-3", "claude3", "claude-3.5", "claude-3.7"],
      [SeriesClaude2]: ["claude-2", "claude2"],
      [SeriesClaude1]: ["claude-1", "claude1", "claude-instant"],
      ["Gemini " + Version10]: ["gemini-1.0", "gemini-1.0-pro"],
      ["Gemini " + Version15]: ["gemini-1.5", "gemini-1.5-pro", "gemini-1.5-flash"],
      ["Gemini " + Version20]: ["gemini-2.0", "gemini-2.0-pro", "gemini-2.0-flash"],
      ["Gemini " + Version25]: ["gemini-2.5", "gemini-2.5-pro", "gemini-2.5-flash"],
      "Gemma 2": ["gemma-2"],
      TypeImage: ["dall-e", "imagen", "midjourney", "stable-diffusion"],
      [TypeEmbedding]: ["embedding", "text-embedding", "embed"],
    };

    this.typePatterns = {
      [TypeO]: ["o1", "o3"],
      [Type35]: ["gpt-3.5", "gpt3.5"],
      [Type4]: ["gpt-4", "gpt4", "gpt-4o"],
      [Type45]: ["gpt-4.5", "gpt4.5"],
      [TypeMini]: ["mini"],
      [TypeOpus]: ["opus"],
      [TypeSonnet]: ["sonnet"],
      [TypeHaiku]: ["haiku"],
      [TypePro]: ["pro"],
      [TypeFlashLite]: ["flash-lite"],
      [TypeFlash]: ["flash"],
      [TypeThinking]: ["thinking"],
      [TypeVision]: ["vision", "multimodal"],
      [TypeEmbedding]: ["embedding", "embed", "tts"],
    };

    this.capabilityPatterns = {
      [CapVision]: ["vision", "image", "multimodal"],
      [CapFunctionCalling]: ["function", "tool", "api"],
      [TypeEmbedding]: ["embedding", "embed", "vector"],
      audio: ["whisper", "tts", "speech", "audio"],
      [CapChat]: ["chat", "conversation", "completion"],
    };
  }

  matchProviderByName(providerName) {
    for (const provider of Object.keys(this.providerPatterns)) {
      if (providerName === provider.toLowerCase()) return provider;
    }
    return "";
  }

  matchProviderByPattern(modelName) {
    const modelLower = modelName.toLowerCase();
    for (const [provider, patterns] of Object.entries(this.providerPatterns)) {
      for (const pattern of patterns) {
        if (modelLower.includes(pattern)) return provider;
      }
    }
    return "";
  }

  matchClaudeVersion(modelName) {
    const modelLower = modelName.toLowerCase();
    for (const pattern of this.seriesPatterns[SeriesClaude3]) {
      if (modelLower.includes(pattern)) return SeriesClaude3;
    }
    for (const pattern of this.seriesPatterns[SeriesClaude2]) {
      if (modelLower.includes(pattern)) return SeriesClaude2;
    }
    for (const pattern of this.seriesPatterns[SeriesClaude1]) {
      if (modelLower.includes(pattern)) return SeriesClaude1;
    }
    return "";
  }

  matchGeminiVersion(modelName) {
    const modelLower = modelName.toLowerCase();
    if (modelLower.includes("2.5")) return "Gemini " + Version25;
    if (modelLower.includes("2.0")) return "Gemini " + Version20;
    if (modelLower.includes("1.5")) return "Gemini " + Version15;
    return "Gemini " + Version10;
  }

  matchSeriesByPattern(modelName) {
    const modelLower = modelName.toLowerCase();
    for (const [series, patterns] of Object.entries(this.seriesPatterns)) {
      for (const pattern of patterns) {
        if (modelLower.includes(pattern)) return series;
      }
    }
    return "";
  }

  matchOpenAIType(modelName) {
    const modelLower = modelName.toLowerCase();
    if (modelLower.includes("mini")) return TypeMini;
    if (modelLower.includes("o1") || modelLower.includes("o3")) return TypeO;
    if (modelLower.includes("gpt-4.5") || modelLower.includes("gpt4.5")) return Type45;
    if (modelLower.includes("gpt-4") || modelLower.includes("gpt4")) return Type4;
    if (modelLower.includes("gpt-3.5") || modelLower.includes("gpt3.5")) return Type35;
    return TypeStandard;
  }

  matchAnthropicType(modelName) {
    const m = modelName.toLowerCase();
    if (m.includes("opus")) return TypeOpus;
    if (m.includes("sonnet")) return TypeSonnet;
    if (m.includes("haiku")) return TypeHaiku;
    return TypeStandard;
  }

  matchGeminiType(modelName) {
    const m = modelName.toLowerCase();
    if (m.includes("flash-lite") || m.includes("flash lite")) return TypeFlashLite;
    if (m.includes("thinking")) return TypeThinking;
    if (m.includes("flash")) return TypeFlash;
    if (m.includes("pro")) return TypePro;
    if (m.includes("gemma")) return TypeGemma;
    return TypeStandard;
  }

  matchTypeByPattern(modelName) {
    for (const [type, patterns] of Object.entries(this.typePatterns)) {
      for (const pattern of patterns) {
        if (modelName.includes(pattern)) return type;
      }
    }
    return "";
  }

  matchOpenAIVariant(modelName) {
    const m = modelName.toLowerCase();
    if (m.includes("gpt-4.5")) return "GPT-" + Version45; // match Go mapping
    if (m.includes("gpt-4o-mini")) return "GPT-4o Mini";
    if (m.includes("gpt-4o")) return "GPT-4o";
    if (m.includes("gpt-4-turbo")) return "GPT-4 Turbo";
    if (m.includes("gpt-4-vision")) return "GPT-4 Vision";
    if (m.includes("o1-mini")) return "O1 Mini";
    if (m.includes("o1")) return "O1";
    return "";
  }

  matchAnthropicVariant(modelName) {
    const m = modelName.toLowerCase();
    if (m.includes("claude-3.7")) return "Claude " + Version37;
    if (m.includes("claude-3.5")) return "Claude " + Version35;
    if (m.includes("claude-3")) return "Claude " + Version30;
    if (m.includes("claude-2")) return "Claude " + Version20;
    if (m.includes("claude-instant")) return "Claude Instant";
    return "";
  }

  buildGeminiVariant(modelName) {
    const m = modelName.toLowerCase();
    let version = "";
    if (m.includes("2.5")) version = Version25;
    else if (m.includes("2.0")) version = Version20;
    else if (m.includes("1.5")) version = Version15;
    else if (m.includes("1.0")) version = Version10;

    let type = "";
    if (m.includes("flash-lite") || m.includes("flash lite")) type = TypeFlashLite;
    else if (m.includes("thinking")) type = TypeThinking;
    else if (m.includes("flash")) type = TypeFlash;
    else if (m.includes("pro")) type = TypePro;

    if (version && type) return `Gemini ${version} ${type}`;
    if (version) return `Gemini ${version}`;
    if (type) return `Gemini ${type}`;
    return "";
  }

  addCapabilities(capabilities, modelType, modelName, provider, series) {
    const m = modelName.toLowerCase();
    if (
      m.includes("vision") ||
      m.includes("multimodal") ||
      modelType === Type4 ||
      modelType === Type45 ||
      modelType === TypeO ||
      series === SeriesClaude3 ||
      m.includes("4o") ||
      (series && series.includes("Gemini"))
    ) {
      capabilities[CapVision] = true;
    }

    if (
      modelType === Type4 ||
      modelType === Type45 ||
      modelType === Type35 ||
      modelType === TypeO ||
      series === SeriesClaude3 ||
      (series && series.includes("Gemini"))
    ) {
      capabilities[CapFunctionCalling] = true;
    }
  }
}

module.exports = { PatternMatcher };


