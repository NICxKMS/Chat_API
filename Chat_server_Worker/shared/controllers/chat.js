import { chatPayloadSchema } from "../schemas/chat.js";
import { generateKey, get, set } from "../cache.js";

export function createChatController(factory, logger, env) {
  const active = new Map();

  function getProviderAndModel(model) {
    const idx = model.indexOf("/");
    if (idx !== -1) return [model.slice(0, idx), model.slice(idx + 1)];
    // default
    const p = factory.getProvider();
    return [p.name, model];
  }

  return {
    async chatCompletion(body) {
      const parsed = chatPayloadSchema.parse(body);
      const [providerName, modelName] = getProviderAndModel(parsed.model);
      const provider = factory.getProvider(providerName);

      const cacheKey = generateKey({ provider: providerName, model: modelName, messages: parsed.messages });
      const cached = get(cacheKey);
      if (cached && !parsed.nocache) return { ...cached, cached: true };

      const controller = new AbortController();
      const options = { ...parsed, model: modelName, abortSignal: controller.signal };
      const res = await provider.chatCompletion(options);
      set(cacheKey, res, parseInt(env.CACHE_TTL || "300", 10));
      return res;
    },

    async *chatCompletionStream(body) {
      const parsed = chatPayloadSchema.parse(body);
      const requestId = parsed.requestId || Math.random().toString(36).slice(2);
      const controller = new AbortController();
      active.set(requestId, controller);
      try {
        const [providerName, modelName] = getProviderAndModel(parsed.model);
        const provider = factory.getProvider(providerName);
        const options = { ...parsed, model: modelName, abortSignal: controller.signal };
        for await (const chunk of provider.chatCompletionStream(options)) {
          yield chunk;
        }
      } finally {
        active.delete(requestId);
      }
    },

    stopGeneration({ requestId }) {
      const ctl = active.get(requestId);
      if (ctl) {
        ctl.abort();
        active.delete(requestId);
        return { success: true, message: "Stop signal sent." };
      }
      return { success: false, message: "No active generation found for the given requestId." };
    },

    async getChatCapabilities() {
      const info = await factory.getProvidersInfo();
      const defaultProvider = factory.getProvider();
      const cacheStats = { enabled: (env?.CACHE_ENABLED ?? "true") !== "false" };
      return {
        capabilities: info,
        defaultProvider: defaultProvider.name,
        circuitBreakers: {},
        cacheStats,
        systemStatus: {
          timestamp: new Date().toISOString()
        }
      };
    }
  };
}


