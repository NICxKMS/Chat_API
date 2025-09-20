import * as unified from "./categorize-worker.js";

export function getCategorizer() {
  return {
    classifyModels: async (loaded) => unified.classifyModels(loaded),
    classifyModelsWithCriteria: async (criteria, loaded) => unified.classifyModelsWithCriteria(loaded, criteria)
  };
}

export function toLoadedModelList(providersInfo) {
  const models = [];
  for (const [provider, info] of Object.entries(providersInfo || {})) {
    const list = Array.isArray(info?.models) ? info.models : [];
    for (const m of list) {
      const id = typeof m === "string" ? m : (m.id || m.name || "");
      if (!id) continue;
      models.push({ id, name: id, provider });
    }
  }
  return { models };
}


