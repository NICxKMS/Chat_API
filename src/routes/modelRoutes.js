/**
 * Model Routes
 * Defines endpoints for model-related operations
 */
const express = require('express');
const modelController = require('../controllers/ModelController');

const router = express.Router();

// GET /models - Get all models from all providers
router.get('/', modelController.getAllModels);

// GET /models/:providerName - Get models for a specific provider
router.get('/:providerName', modelController.getProviderModels);

// GET /models/capabilities - Get provider capabilities and model info
router.get('/capabilities/all', modelController.getProviderCapabilities);

module.exports = router;