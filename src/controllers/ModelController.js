/**
 * Model Controller
 * Handles all model-related API endpoints
 */
import providerFactory from '../providers/ProviderFactory.js';
import * as cache from '../utils/cache.js';
import * as metrics from '../utils/metrics.js';
import { categorizeModels } from '../utils/modelCategorizer.js';
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
      
      // Include experimental/internal models if requested
      const includeExperimental = req.query.include_experimental === 'true';
      
      // Get all models from all providers
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

  /**
   * Get models classified by external service using Protocol Buffers
   */
  async getClassifiedModels(req, res) {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Check if results are in cache
      const cacheKey = cache.generateKey({
        route: 'models/classified',
        query: req.query
      });
      
      if (cache.isEnabled() && !req.query.nocache) {
        const cachedResult = await cache.get(cacheKey);
        if (cachedResult) {
          res.json(cachedResult);
          return;
        }
      }
      
      // If classification service is disabled, go straight to fallback
      if (!this.useClassificationService || !this.modelClassificationService) {
        console.log('Classification service is disabled, using fallback categorization');
        return this.getFallbackClassification(req, res, cacheKey);
      }
      
      try {
        const serverAddress = this.modelClassificationService['serverAddress'];
        console.log(`Attempting to connect to classification server at ${serverAddress}`);
        
        // Get classified models from external service
        const classifiedModels = await this.modelClassificationService.getClassifiedModels();
        
        // Check if we have valid results - if not, use fallback
        if (!classifiedModels || !classifiedModels.classified_groups || classifiedModels.classified_groups.length === 0) {
          console.warn('Classification service returned empty results, using fallback categorization');
          return this.getFallbackClassification(req, res, cacheKey);
        }
        
        // Transform response to be more API-friendly
        const response = {
          classifications: classifiedModels.classified_groups.map(group => ({
            property: group.property_name,
            value: group.property_value,
            models: Array.isArray(group.models) ? group.models : []
          })),
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
        
        // Only use fallback if explicitly requested or for specific errors
        if (req.query.fallback_enabled === 'true' || 
            error.message.includes('unmarshalling') || 
            error.message.includes('timed out') ||
            error.message.includes('UNAVAILABLE')) {
          console.log('Using fallback categorization due to classification error');
          await this.getFallbackClassification(req, res, cacheKey);
        } else {
          // Otherwise, return the error
          res.status(500).json({ 
            error: 'Classification service error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          });
        }
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
   * Fallback method to get local classification when external service is unavailable
   */
  async getFallbackClassification(req, res, cacheKey) {
    try {
      // Attempt to return locally categorized models as fallback
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
      
      // Include experimental/internal models if requested
      const includeExperimental = req.query.include_experimental === 'true';
      // Fixed: Using the correct structure for categorized models
      const structuredModels = categorizeModels(modelsByProvider, includeExperimental);
      
      // Convert structured models to classifications
      const classifications = [];
      
      // Process each provider and its model families
      for (const [provider, families] of Object.entries(structuredModels)) {
        // Add provider as a classification
        classifications.push({
          property: 'provider',
          value: provider,
          models: Object.values(modelsByProvider[provider]?.models || [])
        });
        
        // Process each model family
        for (const [family, types] of Object.entries(families)) {
          // Add family as a classification
          const familyModels = [];
          
          // Process each model type
          for (const [type, versions] of Object.entries(types)) {
            // Include latest version if it exists
            if (versions.latest) {
              familyModels.push(versions.latest);
            }
            
            // Include other versions
            if (Array.isArray(versions.other_versions)) {
              familyModels.push(...versions.other_versions);
            }
          }
          
          // Add to classifications
          classifications.push({
            property: 'family',
            value: family,
            models: familyModels
          });
        }
      }
      
      // Create response
      const response = {
        classifications,
        properties: ['provider', 'family'],
        timestamp: new Date().toISOString(),
        fallback: true
      };
      
      // Cache the results
      if (cache.isEnabled() && !req.query.nocache) {
        await cache.set(cacheKey, response, 300); // Cache for 5 minutes
      }
      
      // Return response
      res.json(response);
    } catch (error) {
      console.error(`Error in fallback classification: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get fallback classification', 
        message: error.message
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
        if (['nocache', 'fallback_enabled', 'include_experimental'].includes(key)) {
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
      
      // If classification service is disabled, go straight to fallback
      if (!this.useClassificationService || !this.modelClassificationService) {
        console.log('Classification service is disabled, using fallback categorization');
        return this.getFallbackClassificationWithCriteria(req, res, criteria, cacheKey);
      }
      
      try {
        const serverAddress = this.modelClassificationService['serverAddress'];
        console.log(`Attempting to connect to classification server at ${serverAddress}`);
        
        // Get models matching criteria from external service
        const matchingModels = await this.modelClassificationService.getModelsByCriteria(criteria);
        
        // Check if we have valid results
        if (!matchingModels || !Array.isArray(matchingModels.models)) {
          console.warn('Classification service returned invalid results, using fallback categorization');
          return this.getFallbackClassificationWithCriteria(req, res, criteria, cacheKey);
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
        
        // Use fallback for service errors
        if (req.query.fallback_enabled === 'true' || 
            error.message.includes('unmarshalling') || 
            error.message.includes('timed out') ||
            error.message.includes('UNAVAILABLE')) {
          console.log('Using fallback for criteria matching due to classification error');
          await this.getFallbackClassificationWithCriteria(req, res, criteria, cacheKey);
        } else {
          // Otherwise, return the error
          res.status(500).json({ 
            error: 'Classification service error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          });
        }
      }
    } catch (error) {
      console.error(`Error in getClassifiedModelsWithCriteria: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get classified models with criteria', 
        message: error.message
      });
    }
  }
  
  /**
   * Fallback method to match criteria locally when external service is unavailable
   */
  async getFallbackClassificationWithCriteria(req, res, criteria, cacheKey) {
    try {
      // First, get all fallback classifications
      const allClassifications = [];
      
      // Get all provider info
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
      
      // Include experimental/internal models if requested
      const includeExperimental = req.query.include_experimental === 'true';
      // Generate model categories
      const structuredModels = categorizeModels(modelsByProvider, includeExperimental);
      
      // Process each provider and its model families for classification
      for (const [provider, families] of Object.entries(structuredModels)) {
        // Add provider as a classification
        allClassifications.push({
          property: 'provider',
          value: provider,
          models: Object.values(modelsByProvider[provider]?.models || [])
        });
        
        // Process each model family
        for (const [family, types] of Object.entries(families)) {
          // Add family as a classification
          const familyModels = [];
          
          // Process each model type
          for (const [type, versions] of Object.entries(types)) {
            if (versions.latest) {
              familyModels.push(versions.latest);
            }
            
            if (Array.isArray(versions.other_versions)) {
              familyModels.push(...versions.other_versions);
            }
          }
          
          // Add to classifications
          allClassifications.push({
            property: 'family',
            value: family,
            models: familyModels
          });
        }
      }
      
      // Match criteria against classifications
      const matchingModels = new Set();
      
      // Filter for each criterion
      for (const [property, value] of Object.entries(criteria)) {
        const matchingClassifications = allClassifications.filter(
          c => c.property === property && c.value === value
        );
        
        // Add all models from matching classifications
        for (const classification of matchingClassifications) {
          if (Array.isArray(classification.models)) {
            for (const model of classification.models) {
              matchingModels.add(model);
            }
          }
        }
      }
      
      // Create response
      const response = {
        criteria,
        models: Array.from(matchingModels),
        count: matchingModels.size,
        timestamp: new Date().toISOString(),
        fallback: true
      };
      
      // Cache the results
      if (cache.isEnabled() && !req.query.nocache) {
        await cache.set(cacheKey, response, 300); // Cache for 5 minutes
      }
      
      // Return response
      res.json(response);
    } catch (error) {
      console.error(`Error in fallback criteria matching: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to get fallback criteria matching', 
        message: error.message
      });
    }
  }
}

// Create singleton instance
const controller = new ModelController();

// Export instance
export default controller; 