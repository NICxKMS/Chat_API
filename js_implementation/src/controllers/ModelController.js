/**
 * Model Controller
 * Handles all model-related API endpoints
 */
const providerFactory = require('../providers/ProviderFactory');
const cache = require('../utils/cache');
const metrics = require('../utils/metrics');
const { categorizeModels } = require('../utils/modelCategorizer');

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
   * Alias for getAllModels - For backward compatibility
   */
  async getModels(req, res) {
    return this.getAllModels(req, res);
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
      
      // Special handling for categories and categorized paths
      if (providerName === 'categories' || providerName === 'categorized') {
        return this.getCategorizedModels(req, res);
      }
      
      try {
        // Get provider from factory
        const provider = providerFactory.getProvider(providerName);
        
        // Get models from provider
        const models = await provider.getModels();
        
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

  /**
   * Get categorized models organized for dropdown UI
   * Returns a structured hierarchy of providers, families, types, and versions
   */
  async getCategorizedModels(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Include experimental/internal models if requested
      const includeExperimental = req.query.include_experimental === 'true';
      
      // Get all models from all providers
      const modelsByProvider = await providerFactory.getAllModels();
      
      // Process models with the categorizer utility
      const categorizedModels = categorizeModels(modelsByProvider, includeExperimental);
      
      // Add cache control header for client-side caching
      res.set('Cache-Control', 'public, max-age=120'); // Allow client to cache for 2 minutes
      
      res.json(categorizedModels);
    } catch (error) {
      console.error(`Error getting categorized models: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get categorized models', 
        message: error.message 
      });
    }
  }
  
  /**
   * Get available providers and their capabilities
   */
  async getProviders(req, res) {
    try {
      const providers = await providerFactory.getProvidersInfo();
      res.json(providers);
    } catch (error) {
      console.error(`Error getting providers: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get providers', 
        message: error.message 
      });
    }
  }
}

// Export singleton instance
module.exports = new ModelController();