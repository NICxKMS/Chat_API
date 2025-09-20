import { getCategorizer, toLoadedModelList } from "../categorizerAdapter.js";
import { getOrSet, generateKey } from "../cache.js";
import { FALLBACK_CATEGORIES } from "../models/fallbackCategories.js";

export function createModelController(factory, logger) {
  return {
    async getAllModels() {
      const info = await factory.getProvidersInfo();
      const defaultProvider = factory.getProvider();
      const modelsByProvider = {};
      for (const [name, details] of Object.entries(info)) {
        if (Array.isArray(details.models)) {
          modelsByProvider[name] = {
            models: details.models.map(m => (typeof m === "string" ? m : m.id)),
            defaultModel: details.defaultModel
          };
        }
      }
      return {
        models: modelsByProvider,
        providers: Object.keys(factory.getProviders()),
        default: { provider: defaultProvider.name, model: modelsByProvider[defaultProvider.name]?.defaultModel }
      };
    },

    async getProviders() {
      return await factory.getProvidersInfo();
    },

    async getCategories() {
      return FALLBACK_CATEGORIES;
    },

    async getClassifiedModels() {
      try {
        const categorizer = getCategorizer();
        if (categorizer) {
          const providersInfo = await factory.getProvidersInfo();
          const loaded = toLoadedModelList(providersInfo);
          const cacheKey = `classifiedModels:${generateKey(loaded)}`;
          const res = await getOrSet(cacheKey, async () => {
            return await categorizer.classifyModels(loaded);
          });
          return res;
        }
      } catch (e) {
        console.warn("[models.getClassifiedModels] categorizer load failed", e?.message);
      }
      return { error: "Local categorizer not available in this runtime." };
    },

    async getClassifiedModelsWithCriteria(criteria = {}) {
      try {
        const categorizer = getCategorizer();
        if (categorizer) {
          const providersInfo = await factory.getProvidersInfo();
          const loaded = toLoadedModelList(providersInfo);
          const keyObj = { criteria, loaded };
          const cacheKey = `classifiedCriteria:${generateKey(keyObj)}`;
          const res = await getOrSet(cacheKey, async () => {
            return await categorizer.classifyModelsWithCriteria(criteria, loaded);
          });
          return res;
        }
      } catch (e) {
        console.warn("[models.getClassifiedModelsWithCriteria] categorizer load failed", e?.message);
      }
      return { error: "Local categorizer not available in this runtime." };
    },

    async getProviderModels(providerName) {
      try {
        const provider = factory.getProvider(providerName);
        const models = await provider.getModels();
        return { provider: providerName, models, defaultModel: provider.config?.defaultModel };
      } catch (error) {
        return { error: `Provider '${providerName}' not found or not configured`, message: error.message };
      }
    }
  };
}


