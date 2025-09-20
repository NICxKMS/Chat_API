// Runtime-agnostic configuration loader. Pass an env-like object when on Workers.

export function loadConfig(env = typeof process !== "undefined" ? process.env : {}) {
  const get = (k, d = undefined) => (env[k] !== undefined ? env[k] : d);

  return {
    environment: get("NODE_ENV", "development"),
    logLevel: get("LOG_LEVEL", "debug"),
    defaultProvider: get("DEFAULT_PROVIDER"),
    useClassificationService: get("USE_CLASSIFICATION_SERVICE", "true") !== "false",
    cache: {
      enabled: get("CACHE_ENABLED", "true") !== "false",
      ttl: parseInt(get("CACHE_TTL", "300"), 10)
    },
    providers: {
      openai: {
        apiKey: get("OPENAI_API_KEY"),
        baseUrl: get("OPENAI_BASE_URL"),
        defaultModel: get("OPENAI_DEFAULT_MODEL", "gpt-3.5-turbo"),
      },
      anthropic: {
        apiKey: get("ANTHROPIC_API_KEY"),
        baseUrl: get("ANTHROPIC_BASE_URL"),
        defaultModel: get("ANTHROPIC_DEFAULT_MODEL", "claude-3-haiku"),
      },
      gemini: {
        apiKey: get("GEMINI_API_KEY") || get("GOOGLE_API_KEY"),
        baseUrl: get("GEMINI_BASE_URL"),
        defaultModel: get("GEMINI_DEFAULT_MODEL", "gemini-1.5-flash"),
      },
      openrouter: {
        apiKey: get("OPENROUTER_API_KEY"),
        baseUrl: get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        defaultModel: get("OPENROUTER_DEFAULT_MODEL", ""),
        httpReferer: get("OPENROUTER_HTTP_REFERER"),
        title: get("OPENROUTER_TITLE")
      }
    },
    firebase: {
      projectId: get("FIREBASE_PROJECT_ID"),
    },
    firestoreCache: {
      enabled: get("FIRESTORE_CACHE_ENABLED", "false") !== "false",
      ttlSeconds: parseInt(get("FIRESTORE_CACHE_TTL", "3600"), 10),
    }
  };
}


