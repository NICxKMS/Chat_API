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

              // // Log the raw response object for inspection
              // try {
              //   console.log("--- RAW gRPC Response ---:", JSON.stringify(response, null, 2));
              // } catch (stringifyError) {
              //   console.log("--- RAW gRPC Response (Stringify Failed) ---", response);
              // }
              
              // Log the number of HIERARCHICAL groups received
              console.log(`Successfully classified models, received ${response.hierarchical_groups?.length || 0} hierarchical groups`);
              
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