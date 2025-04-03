/**
 * Model Controller
 * Handles all model-related API endpoints
 */
import providerFactory from '../providers/ProviderFactory.js';
import * as cache from '../utils/cache.js';
import * as metrics from '../utils/metrics.js';
import { ModelClassificationService } from '../services/ModelClassificationService.js';

class ModelController {
  constructor() {
    // Check if classification service is enabled
    this.useClassificationService = process.env.USE_CLASSIFICATION_SERVICE === 'true';
    
    // Only initialize if enabled
    if (this.useClassificationService) {
      // Initialize with default port 8080 or from environment variable
      const classificationServerPort = process.env.CLASSIFICATION_SERVER_PORT || '8080';
      const classificationServerHost = process.env.CLASSIFICATION_SERVER_HOST || 'localhost';
      const serverAddress = `${classificationServerHost}:${classificationServerPort}`;
      
      console.log(`Initializing classification service at ${serverAddress}`);
      this.modelClassificationService = new ModelClassificationService(serverAddress);
    } else {
      console.log('Classification service is disabled');
      this.modelClassificationService = null;
    }
    
  }

  /**
   * Get all available models from all providers
   */
  async getAllModels(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Get models from all providers using the factory
      const providersInfo = await providerFactory.getProvidersInfo();
      const modelsByProvider = {};
      
      for (const [provider, info] of Object.entries(providersInfo)) {
        if (info && typeof info === 'object' && 'models' in info && Array.isArray(info.models)) {
          modelsByProvider[provider] = {
            models: info.models.map(model => typeof model === 'string' ? model : model.id),
            defaultModel: info.defaultModel
          };
        }
      }
      
      // Safely access config properties
      const defaultProvider = providerFactory.getProvider();
      const defaultModel = defaultProvider && 
        typeof defaultProvider.config === 'object' ? 
        defaultProvider.config.defaultModel : undefined;
      
      // Return formatted response
      res.json({
        models: modelsByProvider,
        providers: Object.keys(providerFactory.getProviders()),
        default: {
          provider: defaultProvider.name,
          model: defaultModel
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
    await this.getAllModels(req, res);
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
        res.status(400).json({ 
          error: 'Provider name is required' 
        });
        return;
      }
      
      // Special handling for categories and categorized paths
      if (providerName === 'categories' || providerName === 'categorized') {
        await this.getCategorizedModels(req, res);
        return;
      }
      
      try {
        // Get provider from factory
        const provider = providerFactory.getProvider(providerName);
        
        // Get models from provider
        const models = await provider.getModels();
        
        // Safely access config properties
        const defaultModel = typeof provider.config === 'object' ? 
          provider.config.defaultModel : undefined;
          
        // Return formatted response
        res.json({
          provider: providerName,
          models: models,
          defaultModel: defaultModel
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
      
      // Check if classification service is enabled and available
      if (this.useClassificationService && this.modelClassificationService) {
        // Use the classification service
        return this.getClassifiedModels(req, res);
      }
      
      // If classification service is not available, return empty result
      res.json({});
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

  /**
   * Get models classified by external service using Protocol Buffers
   */
  async getClassifiedModels(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Check if results are in cache
      const cacheKey = cache.generateKey({ route: 'models/classified' });
      if (cache.isEnabled() && !req.query.nocache) {
        const cachedResult = await cache.get(cacheKey);
        if (cachedResult) {
          res.json(cachedResult);
          return;
        }
      }
      
      // If classification service is disabled, return empty result
      if (!this.useClassificationService || !this.modelClassificationService) {
        console.log('Classification service is disabled, returning empty result');
        res.json({
          hierarchical_groups: [], // Match the expected structure
          properties: [],
          timestamp: new Date().toISOString()
        });
        return;
      }
   
      try {
        const serverAddress = this.modelClassificationService['serverAddress'];
        console.log(`Attempting to connect to classification server at ${serverAddress}`);
        
        // Get classified models from external service (expects hierarchical structure)
        const classifiedModels = await this.modelClassificationService.getClassifiedModels();
        
        // Check if we have valid hierarchical results
        if (!classifiedModels || !classifiedModels.hierarchical_groups || classifiedModels.hierarchical_groups.length === 0) {
          console.warn('Classification service returned empty hierarchical results');
          res.json({
            hierarchical_groups: [],
            properties: classifiedModels?.available_properties || [], // Use available properties if possible
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        // Prepare response (no transformation needed if frontend expects hierarchical)
        const response = {
          hierarchical_groups: classifiedModels.hierarchical_groups,
          properties: classifiedModels.available_properties || [],
          timestamp: new Date().toISOString()
        };
        
        // Cache the results
        if (cache.isEnabled() && !req.query.nocache) {
          await cache.set(cacheKey, response, 300); // Cache for 5 minutes
        }
        
        // Return formatted response
        res.json(response);
      } catch (error) {
        console.error(`Error classifying models: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        
        // Return the error
        res.status(500).json({ 
          error: 'Classification service error',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    } catch (error) {
      console.error(`Error in getClassifiedModels: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
      res.status(500).json({ 
        error: 'Failed to get classified models', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Get models with specific classification criteria
   */
  async getClassifiedModelsWithCriteria(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Extract criteria from query parameters
      const criteria = {};
      
      // Process all query parameters
      for (const [key, value] of Object.entries(req.query)) {
        // Skip certain params that are not criteria
        if (['nocache', 'include_experimental'].includes(key)) {
          continue;
        }
        
        // Add to criteria
        criteria[key] = value;
      }
      
      // Check if we have any criteria
      if (Object.keys(criteria).length === 0) {
        res.status(400).json({ 
          error: 'No classification criteria provided',
          message: 'Please provide at least one classification criteria'
        });
        return;
      }
      
      // Create cache key based on criteria
      const cacheKey = cache.generateKey({
        route: 'models/classified/criteria',
        criteria
      });
      
      // Check cache
      if (cache.isEnabled() && !req.query.nocache) {
        const cachedResult = await cache.get(cacheKey);
        if (cachedResult) {
          res.json(cachedResult);
          return;
        }
      }
      
      // If classification service is disabled, return empty result
      if (!this.useClassificationService || !this.modelClassificationService) {
        console.log('Classification service is disabled');
        res.json({
          criteria,
          models: [],
          count: 0,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      try {
        const serverAddress = this.modelClassificationService['serverAddress'];
        console.log(`Attempting to connect to classification server at ${serverAddress}`);
        
        // Get models matching criteria from external service
        const matchingModels = await this.modelClassificationService.getModelsByCriteria(criteria);
        
        // Check if we have valid results
        if (!matchingModels || !Array.isArray(matchingModels.models)) {
          console.warn('Classification service returned invalid results');
          res.json({
            criteria,
            models: [],
            count: 0,
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        // Transform response
        const response = {
          criteria,
          models: matchingModels.models,
          count: matchingModels.models.length,
          timestamp: new Date().toISOString()
        };
        
        // Cache the results
        if (cache.isEnabled() && !req.query.nocache) {
          await cache.set(cacheKey, response, 300); // Cache for 5 minutes
        }
        
        // Return formatted response
        res.json(response);
      } catch (error) {
        console.error(`Error getting models by criteria: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        
        // Return the error
        res.status(500).json({ 
          error: 'Classification service error',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    } catch (error) {
      console.error(`Error in getClassifiedModelsWithCriteria: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get classified models with criteria', 
        message: error.message
      });
    }
  }
}

// Create singleton instance
const controller = new ModelController();

// Export instance
export default controller; 