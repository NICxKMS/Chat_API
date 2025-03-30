/**
 * Protocol Buffer Utilities
 * Handles loading Proto files and creating gRPC clients
 */
import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ProtoGrpcType } from '../types/proto/models';

// Path to proto file
const PROTO_PATH = path.resolve(__dirname, '../protos/models.proto');

// Proto loader options
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

// Load proto file
const protoDescriptor = grpc.loadPackageDefinition(
  packageDefinition
) as unknown as ProtoGrpcType;

// Get the service definition
const modelService = protoDescriptor.modelservice;

/**
 * Create a gRPC client for the model classification service
 * @param serverAddress - The address of the classification server
 * @returns gRPC client for the model classification service
 */
export function createModelClassificationClient(serverAddress: string = 'localhost:8080') {
  return new modelService.ModelClassificationService(
    serverAddress,
    grpc.credentials.createInsecure()
  );
}

/**
 * Convert standard model object to Protocol Buffer model object
 * @param model - The model object to convert
 * @returns Protocol Buffer model object
 */
export function convertToProtoModel(model: any): any {
  // Extract standard fields
  const protoModel: any = {
    id: model.id || '',
    name: model.name || '',
    context_size: model.contextSize || 0,
    max_tokens: model.maxTokens || 0,
    provider: model.provider || '',
    display_name: model.displayName || '',
    description: model.description || '',
    cost_per_token: model.costPerToken || 0,
    capabilities: model.capabilities || [],
    
    // Classification fields
    family: model.family || '',
    type: model.type || '',
    series: model.series || '',
    variant: model.variant || '',
    is_default: model.isDefault || false,
    is_multimodal: model.isMultimodal || model.capabilities?.includes('vision') || false,
    is_experimental: model.isExperimental || false,
    version: model.version || '',
    
    metadata: {}
  };

  // Add any additional fields to metadata
  for (const [key, value] of Object.entries(model)) {
    // Skip fields that are already included
    if (!['id', 'name', 'contextSize', 'maxTokens', 'provider', 'displayName', 
         'description', 'costPerToken', 'capabilities', 'family', 'type', 
         'series', 'variant', 'isDefault', 'isMultimodal', 'isExperimental', 
         'version'].includes(key)) {
      // Convert value to string for metadata
      protoModel.metadata[key] = String(value);
    }
  }

  return protoModel;
}

/**
 * Convert Protocol Buffer model object to standard model object
 * @param protoModel - The Protocol Buffer model object to convert
 * @returns Standard model object
 */
export function convertFromProtoModel(protoModel: any): any {
  // Extract standard fields with camelCase keys
  const model: any = {
    id: protoModel.id || '',
    name: protoModel.name || '',
    contextSize: protoModel.context_size || 0,
    maxTokens: protoModel.max_tokens || 0,
    provider: protoModel.provider || '',
    displayName: protoModel.display_name || '',
    description: protoModel.description || '',
    costPerToken: protoModel.cost_per_token || 0,
    capabilities: protoModel.capabilities || [],
    
    // Classification fields with camelCase keys
    family: protoModel.family || '',
    type: protoModel.type || '',
    series: protoModel.series || '',
    variant: protoModel.variant || '',
    isDefault: protoModel.is_default || false,
    isMultimodal: protoModel.is_multimodal || false,
    isExperimental: protoModel.is_experimental || false,
    version: protoModel.version || ''
  };

  // Add metadata fields to model
  if (protoModel.metadata) {
    for (const [key, value] of Object.entries(protoModel.metadata)) {
      model[key] = value;
    }
  }

  return model;
}

/**
 * Create classification criteria for filtering models
 * @param options - Options for classification criteria
 * @returns Classification criteria object
 */
export function createClassificationCriteria(options: {
  properties?: string[],
  includeExperimental?: boolean,
  includeDeprecated?: boolean,
  minContextSize?: number
}) {
  return {
    properties: options.properties || [],
    include_experimental: options.includeExperimental || false,
    include_deprecated: options.includeDeprecated || false,
    min_context_size: options.minContextSize || 0
  };
}

export default {
  createModelClassificationClient,
  convertToProtoModel,
  convertFromProtoModel,
  createClassificationCriteria
}; 