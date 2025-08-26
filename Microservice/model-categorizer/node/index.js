const { ModelClassificationHandler } = require("./handlers/classification");

// Public API: simple functions mirroring RPC methods
function classifyModels(loadedModelList) {
  const handler = new ModelClassificationHandler();
  return handler.classifyModels(loadedModelList || { models: [] });
}

function classifyModelsWithCriteria(loadedModelList, criteria) {
  const handler = new ModelClassificationHandler();
  return handler.classifyModelsWithCriteria(loadedModelList || { models: [] }, criteria || {});
}

module.exports = {
  classifyModels,
  classifyModelsWithCriteria,
};


