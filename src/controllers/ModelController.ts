/**
 * Model Controller
 * Handles all model-related API endpoints
 */
import { Request, Response } from 'express';
import providerFactory from '../providers/ProviderFactory';
import * as cache from '../utils/cache';
import * as metrics from '../utils/metrics';
import { categorizeModels } from '../utils/modelCategorizer';

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

class ModelController {
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
}

// Export singleton instance
export default new ModelController(); 