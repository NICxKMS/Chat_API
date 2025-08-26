class ContextResolver {
  constructor() {
    this.contextSizes = {
      // OpenAI
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "gpt-4-turbo": 128000,
      "gpt-4-vision": 128000,
      "gpt-4-32k": 32768,
      "gpt-4": 8192,
      "gpt-4.5": 128000,
      "gpt-3.5-turbo-16k": 16385,
      "gpt-3.5-turbo": 4096,
      "o1": 32768,
      "o1-mini": 32768,

      // Claude
      "claude-3-opus": 200000,
      "claude-3-sonnet": 200000,
      "claude-3-haiku": 200000,
      "claude-3.5-sonnet": 200000,
      "claude-3.7-opus": 200000,
      "claude-2": 100000,
      "claude-instant": 100000,

      // Gemini
      "gemini-1.0-pro": 32768,
      "gemini-1.5-pro": 1000000,
      "gemini-1.5-flash": 1000000,
      "gemini-2.0-pro": 2000000,
      "gemini-2.0-flash": 1000000,
      "gemini-2.0-flash-lite": 1000000,
    };
  }

  GetContextSize(modelID) {
    const modelLower = (modelID || "").toLowerCase();
    for (const [model, size] of Object.entries(this.contextSizes)) {
      if (modelLower.includes(model)) return size;
    }
    return this.getContextSizeByFamily(modelLower);
  }

  getContextSizeByFamily(modelLower) {
    if (modelLower.includes("gpt-4.5")) return 128000;
    if (modelLower.includes("gpt-4")) {
      if (modelLower.includes("32k")) return 32768;
      if (modelLower.includes("turbo") || modelLower.includes("o")) return 128000;
      return 8192;
    }
    if (modelLower.includes("gpt-3.5")) {
      if (modelLower.includes("16k")) return 16385;
      return 4096;
    }
    if (modelLower.includes("claude-3")) return 200000;
    if (modelLower.includes("claude-2") || modelLower.includes("claude-instant")) return 100000;
    if (modelLower.includes("gemini-1.0")) return 32768;
    if (modelLower.includes("gemini-1.5") || modelLower.includes("gemini-2.0")) return 1000000;
    return 0;
  }
}

module.exports = { ContextResolver };


