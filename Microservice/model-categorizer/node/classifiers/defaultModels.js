class DefaultModels {
  constructor() {
    this.defaultModels = {
      "gpt-3.5-turbo": true,
      "gpt-4": true,
      "gpt-4o": true,
      "claude-3-sonnet": true,
      "claude-3-opus": true,
      "gemini-1.5-pro": true,
      "gemini-1.5-flash": true,
      "gemini-2.0-pro": true,
    };
  }

  IsDefaultModel(modelID) {
    if (this.defaultModels[modelID]) return true;
    const lower = (modelID || "").toLowerCase();
    for (const key of Object.keys(this.defaultModels)) {
      if (lower === key.toLowerCase()) return true;
    }
    return false;
  }
}

module.exports = { DefaultModels };


