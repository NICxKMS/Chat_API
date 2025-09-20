import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OpenRouterProvider } from "./openrouter.js";

export function createProviderFactory(config) {
  const providers = {};
  const cfgs = config.providers || {};

  if (cfgs.openai?.apiKey) providers.openai = new OpenAIProvider(cfgs.openai);
  if (cfgs.anthropic?.apiKey) providers.anthropic = new AnthropicProvider(cfgs.anthropic);
  if (cfgs.gemini?.apiKey) providers.gemini = new GeminiProvider(cfgs.gemini);
  if (cfgs.openrouter?.apiKey) providers.openrouter = new OpenRouterProvider(cfgs.openrouter);

  const defaultName = config.defaultProvider || (cfgs.openai?.apiKey ? "openai" : Object.keys(providers)[0] || "openai");

  // cache for providers info to avoid repeated upstream calls
  let providersInfoCache = null; // { data, expiry }
  const providersInfoTtlMs = Math.max(1, (config.cache?.ttl || 60)) * 1000;

  return {
    getProvider(name) {
      const n = name || defaultName;
      const p = providers[n];
      if (!p) throw new Error(`Provider ${n} not configured`);
      return p;
    },
    async getProvidersInfo(providerName) {
      // If specific provider requested, bypass cache
      if (providerName) {
        const out = {};
        try {
          const p = this.getProvider(providerName);
          out[providerName] = { models: await p.getModels(), defaultModel: p.config.defaultModel };
        } catch (e) {
          out[providerName] = { models: [], error: e.message };
        }
        return out;
      }
      // Use cache for all providers
      const now = Date.now();
      if (providersInfoCache && providersInfoCache.expiry > now) {
        return providersInfoCache.data;
      }
      const out = {};
      await Promise.all(Object.entries(providers).map(async ([name, p]) => {
        try { out[name] = { models: await p.getModels(), defaultModel: p.config.defaultModel }; }
        catch (e) { out[name] = { models: [], error: e.message }; }
      }));
      providersInfoCache = { data: out, expiry: now + providersInfoTtlMs };
      return out;
    },
    getProviders() { return { ...providers }; },
    getProviderName() { return defaultName; }
  };
}


