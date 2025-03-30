/**
 * Model Classification Service
 * Handles sending model data to the classification server using Protocol Buffers
 */
import * as grpc from '@grpc/grpc-js';
import providerFactory from '../providers/ProviderFactory.js';
import protoUtils from '../utils/protoUtils.js';

export class ModelClassificationService {
  /**
   * Create a new ModelClassificationService
   * @param {string} serverAddress - The address of the classification server
   */
  constructor(serverAddress = 'localhost:8080') {
    this.serverAddress = serverAddress;
    this.client = protoUtils.createModelClassificationClient(serverAddress);
  }

  /**
   * Get all models from all providers
   * @returns {Promise<object>} - A list of all models
   */
  async getAllModelsForProto() {
    try {
      // Get all provider models
      const providersInfo = await providerFactory.getProvidersInfo();
      
      // Convert to proto format
      const modelList = [];
      
      for (const [provider, info] of Object.entries(providersInfo)) {
        if (info && typeof info === 'object' && 'models' in info && Array.isArray(info.models)) {
          for (const model of info.models) {
            // Convert string model IDs to objects, or use existing object
            const modelObj = typeof model === 'string' 
              ? { id: model, name: model, provider } 
              : { ...model, provider, name: model.name || model.id };
            
            // Ensure model object has an ID
            if (!modelObj.id) {
              console.warn(`Model without ID detected for provider ${provider}, skipping`);
              continue;
            }
            
            // Enhance with classification properties if available
            // this.enhanceModelWithClassificationProperties(modelObj);
            
            // Convert to proto format
            try {
              const protoModel = protoUtils.createProtoModel(modelObj);
              modelList.push(protoModel);
            } catch (error) {
              console.error(`Error converting model ${modelObj.id} to proto format: ${error.message}`);
              // Continue with other models even if one fails
            }
          }
        }
      }
      
      // Get default provider safely
      let defaultProviderName = 'none';
      let defaultModelName = '';
      
      try {
        const defaultProvider = providerFactory.getProvider();
        defaultProviderName = defaultProvider?.name || 'none';
        defaultModelName = defaultProvider?.config?.defaultModel || '';
      } catch (error) {
        console.warn(`Error getting default provider: ${error.message}`);
      }
      
      // Create LoadedModelList with proper types
      return {
        models: modelList,
        default_provider: defaultProviderName,
        default_model: defaultModelName
      };
    } catch (error) {
      console.error(`Error in getAllModelsForProto: ${error.message}`);
      // Return empty model list on error
      return {
        models: [],
        default_provider: 'none',
        default_model: ''
      };
    }
  }

  // /**
  //  * Enhances a model object with classification properties
  //  * @param {object} model - The model object to enhance
  //  */
  // enhanceModelWithClassificationProperties(model) {
  //   const modelId = model.id.toLowerCase();
  //   const providerName = model.provider.toLowerCase();
    
  //   // Set default values
  //   model.isExperimental = model.isExperimental || 
  //                          modelId.includes('experimental') || 
  //                          modelId.includes('preview');
    
  //   // Detect if model is a default model
  //   model.isDefault = modelId === model.provider.toLowerCase() + '-default' ||
  //                     ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'gemini-pro'].includes(modelId);
    
  //   // Check for multimodal capabilities
  //   model.isMultimodal = Boolean(model.capabilities?.includes('vision')) || 
  //                        modelId.includes('vision') || 
  //                        modelId.includes('gpt-4') || 
  //                        modelId.includes('claude-3') || 
  //                        modelId.includes('gemini');
    
  //   // Determine model family
  //   if (!model.family) {
  //     if (modelId.includes('gpt-4')) {
  //       model.family = 'GPT-4';
  //     } else if (modelId.includes('gpt-3.5')) {
  //       model.family = 'GPT-3.5';
  //     } else if (modelId.includes('claude-3')) {
  //       model.family = 'Claude 3';
  //     } else if (modelId.includes('claude-2')) {
  //       model.family = 'Claude 2';
  //     } else if (modelId.includes('gemini-1.5')) {
  //       model.family = 'Gemini 1.5';
  //     } else if (modelId.includes('gemini-1.0')) {
  //       model.family = 'Gemini 1.0';
  //     } else if (modelId.includes('gemini')) {
  //       model.family = 'Gemini';
  //     } else if (modelId.includes('llama')) {
  //       model.family = 'Llama';
  //     } else if (modelId.includes('mistral')) {
  //       model.family = 'Mistral';
  //     }
  //   }
    
  //   // Determine model type
  //   if (!model.type) {
  //     if (modelId.includes('vision')) {
  //       model.type = 'Vision';
  //     } else if (modelId.includes('embedding')) {
  //       model.type = 'Embedding';
  //     } else if (modelId.includes('opus')) {
  //       model.type = 'Opus';
  //     } else if (modelId.includes('sonnet')) {
  //       model.type = 'Sonnet';
  //     } else if (modelId.includes('haiku')) {
  //       model.type = 'Haiku';
  //     } else if (modelId.includes('pro')) {
  //       model.type = 'Pro';
  //     } else if (modelId.includes('flash')) {
  //       model.type = 'Flash';
  //     } else if (modelId.includes('turbo')) {
  //       model.type = 'Turbo';
  //     } else {
  //       model.type = 'Standard';
  //     }
  //   }
    
  //   // Set context window size if not provided
  //   if (!model.contextSize) {
  //     if (modelId.includes('gpt-4-turbo') || modelId.includes('gpt-4o')) {
  //       model.contextSize = 128000;
  //     } else if (modelId.includes('gpt-4-32k')) {
  //       model.contextSize = 32768;
  //     } else if (modelId.includes('gpt-4')) {
  //       model.contextSize = 8192;
  //     } else if (modelId.includes('gpt-3.5-turbo-16k')) {
  //       model.contextSize = 16385;
  //     } else if (modelId.includes('claude-3')) {
  //       model.contextSize = 200000;
  //     } else if (modelId.includes('gemini-1.5')) {
  //       model.contextSize = 1000000;
  //     }
  //   }
  // }

  /**
   * Send models to the classification server and return classified models
   * @returns {Promise<object>} - Classified models
   */
  async getClassifiedModels() {
    try {
      // Check if client is properly initialized
      if (!this.client) {
        console.error('Classification client not initialized');
        throw new Error('Classification service client not initialized');
      }

      // Get all models
      const modelList = await this.getAllModelsForProto();
      
      // Log the server address we're connecting to
      console.log(`Connecting to classification server at ${this.serverAddress}`);
      console.log(`Number of models to classify: ${modelList.models.length}`);
      
      // Return a Promise that will resolve with the classified models
      return new Promise((resolve, reject) => {
        // Set a timeout for the gRPC call
        const timeout = setTimeout(() => {
          reject(new Error(`Classification request timed out after 15 seconds`));
        }, 15000);
        
        // Log the number of models being sent for debugging
        console.log(`Preparing to send ${modelList.models.length} models for classification`);
        
        // Call the gRPC service with retry logic
        const attemptClassify = (retryCount = 0, maxRetries = 3) => {
          // Call the classify method in the protoUtils
          this.client.classifyModels(modelList, (error, response) => {
            if (error) {
              // Handle gRPC errors
              console.error(`Classification error (attempt ${retryCount + 1}/${maxRetries + 1}): ${error.message}`);
              
              // Clear the timeout if set
              clearTimeout(timeout);
              
              // If we have retries left, try again
              if (retryCount < maxRetries) {
                console.log(`Retrying classification (attempt ${retryCount + 2}/${maxRetries + 1})...`);
                
                // Exponential backoff delay with jitter: 2^n * 500ms + random(0-200ms)
                const backoff = Math.min((Math.pow(2, retryCount) * 500) + Math.random() * 200, 5000);
                setTimeout(() => attemptClassify(retryCount + 1, maxRetries), backoff);
              } else {
                // No more retries, reject the promise
                reject(new Error(`Classification failed after ${maxRetries + 1} attempts: ${error.message}`));
              }
            } else {
              // Clear the timeout if set
              clearTimeout(timeout);
              
              // Check if response is valid
              if (!response) {
                reject(new Error('Received empty response from classification server'));
                return;
              }
              
              console.log(`Successfully classified models, received ${response.classified_groups?.length || 0} classification groups`);
              
              // Resolve the promise with the response
              resolve(response);
            }
          });
        };
        
        // Start the classification process
        attemptClassify();
      });
    } catch (error) {
      console.error(`Error in getClassifiedModels: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get models that match specific criteria
   * @param {object} criteria - Criteria for filtering models
   * @returns {Promise<object>} - Models matching criteria
   */
  async getModelsByCriteria(criteria) {
    try {
      // Check if client is properly initialized
      if (!this.client) {
        console.error('Classification client not initialized');
        throw new Error('Classification service client not initialized');
      }
      
      // Log the server address we're connecting to
      console.log(`Connecting to classification server at ${this.serverAddress} for criteria matching`);
      console.log(`Criteria: ${JSON.stringify(criteria)}`);
      
      // Convert criteria to protocol buffer format
      const protoCriteria = protoUtils.createProtoClassificationCriteria(criteria);
      
      // Return a Promise that will resolve with the matching models
      return new Promise((resolve, reject) => {
        // Set a timeout for the gRPC call
        const timeout = setTimeout(() => {
          reject(new Error(`Classification criteria request timed out after 10 seconds`));
        }, 10000);
        
        // Call the gRPC service with retry logic
        const attemptGetModelsByCriteria = (retryCount = 0, maxRetries = 2) => {
          this.client.getModelsByCriteria(protoCriteria, (error, response) => {
            if (error) {
              // Handle gRPC errors
              console.error(`Get models by criteria error (attempt ${retryCount + 1}/${maxRetries + 1}): ${error.message}`);
              
              // Clear the timeout if set
              clearTimeout(timeout);
              
              // If we have retries left, try again
              if (retryCount < maxRetries) {
                console.log(`Retrying get models by criteria (attempt ${retryCount + 2}/${maxRetries + 1})...`);
                
                // Simple backoff delay: 1s, 2s, ...
                setTimeout(() => attemptGetModelsByCriteria(retryCount + 1, maxRetries), (retryCount + 1) * 1000);
              } else {
                // No more retries, reject the promise
                reject(new Error(`Get models by criteria failed after ${maxRetries + 1} attempts: ${error.message}`));
              }
            } else {
              // Clear the timeout if set
              clearTimeout(timeout);
              
              // Check if response is valid
              if (!response) {
                reject(new Error('Received empty response from classification server'));
                return;
              }
              
              console.log(`Successfully got models by criteria, found ${response.models?.length || 0} matching models`);
              
              // Resolve the promise with the response
              resolve(response);
            }
          });
        };
        
        // Start the get models by criteria process
        attemptGetModelsByCriteria();
      });
    } catch (error) {
      console.error(`Error in getModelsByCriteria: ${error.message}`);
      throw error;
    }
  }
} 