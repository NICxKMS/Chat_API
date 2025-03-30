/**
 * Model Routes
 * Defines endpoints for model-related operations
 */
import express, { Router } from 'express';
import modelController from '../controllers/ModelController';

const router: Router = express.Router();

// GET /models - Get all models from all providers
router.get('/', modelController.getAllModels.bind(modelController));

// GET /models/categories - Get models categorized for dropdown UI
router.get('/categories', modelController.getCategorizedModels.bind(modelController));

// GET /models/categorized - Alias for categorized models
router.get('/categorized', modelController.getCategorizedModels.bind(modelController));

// GET /models/providers - Get all providers and their capabilities
router.get('/providers', modelController.getProviders.bind(modelController));

// GET /models/capabilities/all - Get provider capabilities and model info
router.get('/capabilities/all', modelController.getProviderCapabilities.bind(modelController));

// GET /models/classified - Get models classified by external service
router.get('/classified', modelController.getClassifiedModels.bind(modelController));

// GET /models/classified/criteria - Get models classified with specific criteria
router.get('/classified/criteria', modelController.getClassifiedModelsWithCriteria.bind(modelController));

// GET /models/:providerName - Get models for a specific provider (must be last)
router.get('/:providerName', modelController.getProviderModels.bind(modelController));

export default router; 