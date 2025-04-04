/**
 * Model Routes
 * Defines endpoints for model-related operations
 */
import express from "express";
import modelController from "../controllers/ModelController.js";

const router = express.Router();

// GET /models - Get all models from all providers
router.get("/", modelController.getAllModels.bind(modelController));

// // GET /models/list - REMOVED ALIAS
// router.get('/list', modelController.getAllModels.bind(modelController));

// GET /models/categories - Get models categorized for dropdown UI
router.get("/categories", modelController.getCategorizedModels.bind(modelController));

// // GET /models/categorized - REMOVED ALIAS
// router.get('/categorized', modelController.getCategorizedModels.bind(modelController));

// GET /models/providers - Get all providers and their capabilities
router.get("/providers", modelController.getProviders.bind(modelController));

// // GET /models/capabilities/all - REMOVED ALIAS
// router.get('/capabilities/all', modelController.getProviderCapabilities.bind(modelController));

// GET /models/classified - Get models classified by external service
router.get("/classified", modelController.getClassifiedModels.bind(modelController));

// GET /models/classified/criteria - Get models classified with specific criteria
router.get("/classified/criteria", modelController.getClassifiedModelsWithCriteria.bind(modelController));

// GET /models/:providerName - Get models for a specific provider (must be last)
router.get("/:providerName", modelController.getProviderModels.bind(modelController));

export default router; 