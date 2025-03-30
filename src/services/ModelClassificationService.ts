/**
 * Model Classification Service
 * Handles sending model data to the classification server using Protocol Buffers
 */
import * as grpc from '@grpc/grpc-js';
import providerFactory from '../providers/ProviderFactory';
import protoUtils from '../utils/protoUtils';
import {
  LoadedModelListObject,
  ClassifiedModelResponseObject,
  ModelObject,
  ClassificationCriteriaObject
} from '../types/proto/models';

export class ModelClassificationService {
  private client: any;
  private serverAddress: string;

  /**
   * Create a new ModelClassificationService
   * @param serverAddress - The address of the classification server
   */
  constructor(serverAddress: string = 'localhost:8080') {
    this.serverAddress = serverAddress;
    this.client = protoUtils.createModelClassificationClient(serverAddress);
  }

  /**
   * Get all models from all providers
   * @returns Promise<LoadedModelListObject> - A list of all models
   */
  private async getAllModelsForProto(): Promise<LoadedModelListObject> {
    // Get all provider models
    const providersInfo = await providerFactory.getProvidersInfo();
    
    // Convert to proto format
    const modelList: ModelObject[] = [];
    
    for (const [provider, info] of Object.entries(providersInfo)) {
      if (info && typeof info === 'object' && 'models' in info && Array.isArray(info.models)) {
        for (const model of info.models) {
          const modelId = typeof model === 'string' ? model : model.id;
          const modelObj: any = {
            id: modelId,
            provider,
            // Add other properties if they exist
            ...((typeof model === 'string') 
                ? { name: modelId } 
                : { ...model, name: model.name || modelId })
          };
          
          // Enhance with classification properties if available (based on classifier.go)
          this.enhanceModelWithClassificationProperties(modelObj);
          
          // Convert to proto format and add to list
          modelList.push(protoUtils.convertToProtoModel(modelObj));
        }
      }
    }
    
    // Get default provider
    const defaultProvider = providerFactory.getProvider();
    const defaultModel = defaultProvider && 
      typeof defaultProvider.config === 'object' ? 
      defaultProvider.config.defaultModel : undefined;
    
    // Create LoadedModelList
    return {
      models: modelList,
      default_provider: defaultProvider?.name,
      default_model: defaultModel
    };
  }

  /**
   * Enhances a model object with classification properties
   * @param model - The model object to enhance
   */
  private enhanceModelWithClassificationProperties(model: any): void {
    const modelId = model.id.toLowerCase();
    const providerName = model.provider.toLowerCase();
    
    // Set default values
    model.isExperimental = model.isExperimental || 
                           modelId.includes('experimental') || 
                           modelId.includes('preview');
    
    // Detect if model is a default model
    model.isDefault = modelId === model.provider.toLowerCase() + '-default' ||
                      ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'gemini-pro'].includes(modelId);
    
    // Check for multimodal capabilities
    model.isMultimodal = Boolean(model.capabilities?.includes('vision')) || 
                         modelId.includes('vision') || 
                         modelId.includes('gpt-4') || 
                         modelId.includes('claude-3') || 
                         modelId.includes('gemini');
    
    // Determine model family
    if (!model.family) {
      if (modelId.includes('gpt-4')) {
        model.family = 'GPT-4';
      } else if (modelId.includes('gpt-3.5')) {
        model.family = 'GPT-3.5';
      } else if (modelId.includes('claude-3')) {
        model.family = 'Claude 3';
      } else if (modelId.includes('claude-2')) {
        model.family = 'Claude 2';
      } else if (modelId.includes('gemini-1.5')) {
        model.family = 'Gemini 1.5';
      } else if (modelId.includes('gemini-1.0')) {
        model.family = 'Gemini 1.0';
      } else if (modelId.includes('gemini')) {
        model.family = 'Gemini';
      } else if (modelId.includes('llama')) {
        model.family = 'Llama';
      } else if (modelId.includes('mistral')) {
        model.family = 'Mistral';
      }
    }
    
    // Determine model type
    if (!model.type) {
      if (modelId.includes('vision')) {
        model.type = 'Vision';
      } else if (modelId.includes('embedding')) {
        model.type = 'Embedding';
      } else if (modelId.includes('opus')) {
        model.type = 'Opus';
      } else if (modelId.includes('sonnet')) {
        model.type = 'Sonnet';
      } else if (modelId.includes('haiku')) {
        model.type = 'Haiku';
      } else if (modelId.includes('pro')) {
        model.type = 'Pro';
      } else if (modelId.includes('flash')) {
        model.type = 'Flash';
      } else if (modelId.includes('turbo')) {
        model.type = 'Turbo';
      } else {
        model.type = 'Standard';
      }
    }
    
    // Set context window size if not provided
    if (!model.contextSize) {
      if (modelId.includes('gpt-4-turbo') || modelId.includes('gpt-4o')) {
        model.contextSize = 128000;
      } else if (modelId.includes('gpt-4-32k')) {
        model.contextSize = 32768;
      } else if (modelId.includes('gpt-4')) {
        model.contextSize = 8192;
      } else if (modelId.includes('gpt-3.5-turbo-16k')) {
        model.contextSize = 16385;
      } else if (modelId.includes('claude-3')) {
        model.contextSize = 200000;
      } else if (modelId.includes('gemini-1.5')) {
        model.contextSize = 1000000;
      }
    }
  }

  /**
   * Send models to the classification server and return classified models
   * @returns Promise<ClassifiedModelResponseObject> - Classified models
   */
  public async getClassifiedModels(): Promise<ClassifiedModelResponseObject> {
    try {
      // Get all models
      const modelList = await this.getAllModelsForProto();
      
      // Return a Promise that will resolve with the classified models
      return new Promise((resolve, reject) => {
        this.client.classifyModels(modelList, (
          error: grpc.ServiceError | null,
          response: ClassifiedModelResponseObject
        ) => {
          if (error) {
            console.error(`Error classifying models: ${error.message}`);
            reject(error);
          } else {
            // Convert from proto format
            const result: ClassifiedModelResponseObject = {
              classified_groups: response.classified_groups.map(group => ({
                property_name: group.property_name,
                property_value: group.property_value,
                models: group.models.map(model => protoUtils.convertFromProtoModel(model))
              })),
              available_properties: response.available_properties,
              error_message: response.error_message
            };
            
            resolve(result);
          }
        });
      });
    } catch (error) {
      console.error(`Error in getClassifiedModels: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Send classification criteria to the server and return classified models
   * @param criteria - Classification criteria
   * @returns Promise<ClassifiedModelResponseObject> - Classified models
   */
  public async getClassifiedModelsWithCriteria(criteria: {
    properties?: string[],
    includeExperimental?: boolean,
    includeDeprecated?: boolean,
    minContextSize?: number
  }): Promise<ClassifiedModelResponseObject> {
    try {
      // Create classification criteria
      const classificationCriteria = protoUtils.createClassificationCriteria(criteria);
      
      // Return a Promise that will resolve with the classified models
      return new Promise((resolve, reject) => {
        this.client.classifyModelsWithCriteria(classificationCriteria, (
          error: grpc.ServiceError | null,
          response: ClassifiedModelResponseObject
        ) => {
          if (error) {
            console.error(`Error classifying models with criteria: ${error.message}`);
            reject(error);
          } else {
            // Convert from proto format
            const result: ClassifiedModelResponseObject = {
              classified_groups: response.classified_groups.map(group => ({
                property_name: group.property_name,
                property_value: group.property_value,
                models: group.models.map(model => protoUtils.convertFromProtoModel(model))
              })),
              available_properties: response.available_properties,
              error_message: response.error_message
            };
            
            resolve(result);
          }
        });
      });
    } catch (error) {
      console.error(`Error in getClassifiedModelsWithCriteria: ${(error as Error).message}`);
      throw error;
    }
  }
}

export default ModelClassificationService; 