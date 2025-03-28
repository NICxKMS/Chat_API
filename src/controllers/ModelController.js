/**
 * Model Controller
 * Handles all model-related API endpoints
 */
const providerFactory = require('../providers/ProviderFactory');
const cache = require('../utils/cache');
const metrics = require('../utils/metrics');

class ModelController {
  /**
   * Get all available models from all providers
   */
  async getAllModels(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Get models from all providers using the factory
      const modelsByProvider = await providerFactory.getAllModels();
      
      // Return formatted response
      res.json({
        models: modelsByProvider,
        providers: providerFactory.getProviderNames(),
        default: {
          provider: providerFactory.getProvider().name,
          model: providerFactory.getProvider().config.defaultModel
        }
      });
    } catch (error) {
      console.error(`Error getting models: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get models', 
        message: error.message 
      });
    }
  }

  /**
   * Get models for a specific provider
   */
  async getProviderModels(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      const { providerName } = req.params;
      
      if (!providerName) {
        return res.status(400).json({ 
          error: 'Provider name is required' 
        });
      }
      
      try {
        // Get provider from factory
        const provider = providerFactory.getProvider(providerName);
        
        // Generate cache key for this provider's models
        const cacheKey = cache.generateKey(`provider-models-${providerName}`);
        
        // Try to get from cache first
        let models = await cache.get(cacheKey, 'model');
        
        if (!models) {
          // If not in cache, fetch models from provider
          models = await provider.getModels();
          
          // Cache for future requests
          await cache.set(cacheKey, models, 300, 'model'); // Cache for 5 minutes
        }
        
        // Return formatted response
        res.json({
          provider: providerName,
          models: models,
          defaultModel: provider.config.defaultModel
        });
      } catch (error) {
        // Handle provider not found
        res.status(404).json({ 
          error: `Provider '${providerName}' not found or not configured`,
          message: error.message
        });
      }
    } catch (error) {
      console.error(`Error getting provider models: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get provider models', 
        message: error.message 
      });
    }
  }

  /**
   * Get provider capabilities
   */
  async getProviderCapabilities(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Get all provider info
      const providersInfo = await providerFactory.getProvidersInfo();
      
      res.json({
        providers: providersInfo,
        defaultProvider: providerFactory.getProvider().name
      });
    } catch (error) {
      console.error(`Error getting provider capabilities: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get provider capabilities', 
        message: error.message 
      });
    }
  }
}

module.exports = new ModelController();