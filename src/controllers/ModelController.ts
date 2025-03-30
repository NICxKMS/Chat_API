/**
 * Model Controller
 * Handles all model-related API endpoints
 */
import { Request, Response } from 'express';
import providerFactory from '../providers/ProviderFactory';
import * as cache from '../utils/cache';
import * as metrics from '../utils/metrics';
import { categorizeModels } from '../utils/modelCategorizer';
import ModelClassificationService from '../services/ModelClassificationService';

// Interface for a single model
interface Model {
  id: string;
  name?: string;
  contextSize?: number;
  maxTokens?: number;
  provider: string;
  displayName?: string;
  description?: string;
  costPerToken?: number;
  capabilities?: string[];
  [key: string]: any;
}

// Interface for models by provider response that matches what categorizeModels expects
interface ProviderModels {
  models: string[];
  defaultModel?: string;
  error?: string;
}

interface ModelsByProvider {
  [providerName: string]: ProviderModels;
}

// Interface for provider info
interface ProviderInfo {
  name: string;
  models: string[];
  defaultModel?: string;
  apiVersion?: string;
  lastUpdated?: string;
  [key: string]: any;
}

// Interface for structured models returned by categorizeModels
interface StructuredModels {
  [providerName: string]: {
    [familyName: string]: {
      [typeName: string]: {
        latest: string | null;
        other_versions: string[];
      }
    }
  };
}

// Interface for classifications
interface Classification {
  property: string;
  value: string;
  models: string[];
}

class ModelController {
  // Create instance of ModelClassificationService
  private modelClassificationService: ModelClassificationService;

  constructor() {
    // Initialize with default port 8080 or from environment variable
    const classificationServerPort = process.env.CLASSIFICATION_SERVER_PORT || '8080';
    const classificationServerHost = process.env.CLASSIFICATION_SERVER_HOST || 'localhost';
    const serverAddress = `${classificationServerHost}:${classificationServerPort}`;
    
    this.modelClassificationService = new ModelClassificationService(serverAddress);
  }

  /**
   * Get all available models from all providers
   */
  async getAllModels(req: Request, res: Response): Promise<void> {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Get models from all providers using the factory
      const providersInfo = await providerFactory.getProvidersInfo();
      const modelsByProvider: ModelsByProvider = {};
      
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
      console.error(`Error getting models: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to get models', 
        message: (error as Error).message 
      });
    }
  }

  /**
   * Alias for getAllModels - For backward compatibility
   */
  async getModels(req: Request, res: Response): Promise<void> {
    await this.getAllModels(req, res);
  }

  /**
   * Get models for a specific provider
   */
  async getProviderModels(req: Request, res: Response): Promise<void> {
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
          message: (error as Error).message
        });
      }
    } catch (error) {
      console.error(`Error getting provider models: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to get provider models', 
        message: (error as Error).message 
      });
    }
  }

  /**
   * Get provider capabilities
   */
  async getProviderCapabilities(req: Request, res: Response): Promise<void> {
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
      console.error(`Error getting provider capabilities: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to get provider capabilities', 
        message: (error as Error).message 
      });
    }
  }

  /**
   * Get categorized models organized for dropdown UI
   * Returns a structured hierarchy of providers, families, types, and versions
   */
  async getCategorizedModels(req: Request, res: Response): Promise<void> {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Include experimental/internal models if requested
      const includeExperimental = req.query.include_experimental === 'true';
      
      // Get all models from all providers
      const providersInfo = await providerFactory.getProvidersInfo();
      const modelsByProvider: ModelsByProvider = {};
      
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
      console.error(`Error getting categorized models: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to get categorized models', 
        message: (error as Error).message 
      });
    }
  }
  
  /**
   * Get available providers and their capabilities
   */
  async getProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = await providerFactory.getProvidersInfo();
      res.json(providers);
    } catch (error) {
      console.error(`Error getting providers: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to get providers', 
        message: (error as Error).message 
      });
    }
  }

  /**
   * Get models classified by external service using Protocol Buffers
   */
  async getClassifiedModels(req: Request, res: Response): Promise<void> {
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
      
      try {
        // Get classified models from external service
        const classifiedModels = await this.modelClassificationService.getClassifiedModels();
        
        // Transform response to be more API-friendly
        const response = {
          classifications: classifiedModels.classified_groups.map(group => ({
            property: group.property_name,
            value: group.property_value,
            models: group.models
          })),
          properties: classifiedModels.available_properties,
          timestamp: new Date().toISOString()
        };
        
        // Cache the results
        if (cache.isEnabled() && !req.query.nocache) {
          await cache.set(cacheKey, response, 300); // Cache for 5 minutes
        }
        
        // Return formatted response
        res.json(response);
      } catch (error) {
        console.error(`Error classifying models: ${(error as Error).message}`);
        
        // Attempt to return locally categorized models as fallback
        const providersInfo = await providerFactory.getProvidersInfo();
        const modelsByProvider: ModelsByProvider = {};
        
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
        const classifications: Classification[] = [];
        
        // Process each provider and its model families
        for (const [provider, families] of Object.entries(structuredModels)) {
          // Add provider as a classification
          classifications.push({
            property: 'provider',
            value: provider,
            models: Object.entries(families).flatMap(([_, types]) => 
              Object.entries(types).flatMap(([__, modelData]) => 
                [modelData.latest, ...modelData.other_versions].filter(Boolean)
              )
            ) as string[]
          });
          
          // Add each family as a classification
          for (const [family, types] of Object.entries(families)) {
            classifications.push({
              property: 'family',
              value: family,
              models: Object.entries(types).flatMap(([_, modelData]) => 
                [modelData.latest, ...modelData.other_versions].filter(Boolean)
              ) as string[]
            });
            
            // Add each type as a classification
            for (const [type, modelData] of Object.entries(types)) {
              classifications.push({
                property: 'type',
                value: type,
                models: [modelData.latest, ...modelData.other_versions].filter(Boolean) as string[]
              });
            }
          }
        }
        
        res.json({
          classifications,
          error: `Could not connect to classification server: ${(error as Error).message}`,
          fallback: 'Using local categorization',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`Error in getClassifiedModels: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to get classified models', 
        message: (error as Error).message 
      });
    }
  }

  /**
   * Get models classified by external service using Protocol Buffers with specific criteria
   */
  async getClassifiedModelsWithCriteria(req: Request, res: Response): Promise<void> {
    try {
      // Record request in metrics
      metrics.incrementRequestCount();
      
      // Parse criteria from query parameters
      const criteria = {
        properties: req.query.properties ? String(req.query.properties).split(',') : undefined,
        includeExperimental: req.query.include_experimental === 'true',
        includeDeprecated: req.query.include_deprecated === 'true',
        minContextSize: req.query.min_context_size ? parseInt(String(req.query.min_context_size)) : undefined
      };
      
      // Generate cache key based on criteria
      const cacheKey = cache.generateKey({
        route: 'models/classified/criteria',
        query: req.query
      });
      
      // Try to get from cache
      if (cache.isEnabled() && !req.query.nocache) {
        const cachedResult = await cache.get(cacheKey);
        if (cachedResult) {
          res.json(cachedResult);
          return;
        }
      }
      
      try {
        // Get classified models with criteria
        const classifiedModels = await this.modelClassificationService.getClassifiedModelsWithCriteria(criteria);
        
        // Transform response to be more API-friendly
        const response = {
          classifications: classifiedModels.classified_groups.map(group => ({
            property: group.property_name,
            value: group.property_value,
            models: group.models
          })),
          properties: classifiedModels.available_properties,
          criteria: criteria,
          timestamp: new Date().toISOString()
        };
        
        // Cache the results
        if (cache.isEnabled() && !req.query.nocache) {
          await cache.set(cacheKey, response, 300); // Cache for 5 minutes
        }
        
        // Return formatted response
        res.json(response);
      } catch (error) {
        console.error(`Error classifying models with criteria: ${(error as Error).message}`);
        
        // Let's provide a fallback by using the standard classification endpoint
        try {
          const classifiedModels = await this.modelClassificationService.getClassifiedModels();
          
          // Filter the results based on criteria
          const filteredGroups = classifiedModels.classified_groups
            .map(group => ({
              property_name: group.property_name,
              property_value: group.property_value,
              models: group.models.filter(model => {
                // Apply criteria filters
                if (criteria.minContextSize && (!model.context_size || model.context_size < criteria.minContextSize)) {
                  return false;
                }
                if (!criteria.includeExperimental && model.is_experimental) {
                  return false;
                }
                if (!criteria.includeDeprecated && model.metadata?.['deprecated'] === 'true') {
                  return false;
                }
                return true;
              })
            }))
            // Remove empty groups
            .filter(group => group.models.length > 0);
          
          // Create response
          const response = {
            classifications: filteredGroups.map(group => ({
              property: group.property_name,
              value: group.property_value,
              models: group.models
            })),
            properties: classifiedModels.available_properties,
            criteria: criteria,
            fallback: "Applied filters locally due to classification service error",
            error: `Classification service error: ${(error as Error).message}`,
            timestamp: new Date().toISOString()
          };
          
          res.json(response);
        } catch (fallbackError) {
          // Return error if even the fallback fails
          res.status(500).json({ 
            error: 'Failed to get classified models with criteria', 
            message: (error as Error).message,
            fallback_error: (fallbackError as Error).message
          });
        }
      }
    } catch (error) {
      console.error(`Error in getClassifiedModelsWithCriteria: ${(error as Error).message}`);
      res.status(500).json({ 
        error: 'Failed to process classification criteria', 
        message: (error as Error).message 
      });
    }
  }
}

// Export singleton instance
export default new ModelController(); 