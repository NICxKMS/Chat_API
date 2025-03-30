import * as grpc from '@grpc/grpc-js';

// Model type definitions
export interface ModelObject {
  id: string;
  name?: string;
  context_size?: number;
  max_tokens?: number;
  provider: string;
  display_name?: string;
  description?: string;
  cost_per_token?: number;
  capabilities?: string[];
  
  // Classification fields
  family?: string;
  type?: string;
  series?: string;
  variant?: string;
  is_default?: boolean;
  is_multimodal?: boolean;
  is_experimental?: boolean;
  version?: string;
  
  metadata?: { [key: string]: string };
}

export interface LoadedModelListObject {
  models: ModelObject[];
  default_provider?: string;
  default_model?: string;
}

export interface ClassificationPropertyObject {
  name: string;
  display_name?: string;
  description?: string;
  possible_values?: string[];
}

export interface ClassifiedModelGroupObject {
  property_name: string;
  property_value: string;
  models: ModelObject[];
}

export interface ClassificationCriteriaObject {
  properties?: string[];
  include_experimental?: boolean;
  include_deprecated?: boolean;
  min_context_size?: number;
}

export interface ClassifiedModelResponseObject {
  classified_groups: ClassifiedModelGroupObject[];
  available_properties?: ClassificationPropertyObject[];
  error_message?: string;
}

// gRPC client and service types
interface ModelClassificationServiceClient extends grpc.Client {
  classifyModels(
    request: LoadedModelListObject,
    callback: (
      error: grpc.ServiceError | null,
      response: ClassifiedModelResponseObject
    ) => void
  ): grpc.ClientUnaryCall;
  
  classifyModels(
    request: LoadedModelListObject,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: ClassifiedModelResponseObject
    ) => void
  ): grpc.ClientUnaryCall;
  
  classifyModels(
    request: LoadedModelListObject,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: ClassifiedModelResponseObject
    ) => void
  ): grpc.ClientUnaryCall;
  
  classifyModelsWithCriteria(
    request: ClassificationCriteriaObject,
    callback: (
      error: grpc.ServiceError | null,
      response: ClassifiedModelResponseObject
    ) => void
  ): grpc.ClientUnaryCall;
  
  classifyModelsWithCriteria(
    request: ClassificationCriteriaObject,
    metadata: grpc.Metadata,
    callback: (
      error: grpc.ServiceError | null,
      response: ClassifiedModelResponseObject
    ) => void
  ): grpc.ClientUnaryCall;
  
  classifyModelsWithCriteria(
    request: ClassificationCriteriaObject,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (
      error: grpc.ServiceError | null,
      response: ClassifiedModelResponseObject
    ) => void
  ): grpc.ClientUnaryCall;
}

interface ModelClassificationServiceService extends grpc.UntypedServiceImplementation {
  classifyModels: grpc.handleUnaryCall<LoadedModelListObject, ClassifiedModelResponseObject>;
  classifyModelsWithCriteria: grpc.handleUnaryCall<ClassificationCriteriaObject, ClassifiedModelResponseObject>;
}

export interface ProtoGrpcType {
  modelservice: {
    ClassificationCriteria: MessageTypeDefinition;
    ClassificationProperty: MessageTypeDefinition;
    ClassifiedModelGroup: MessageTypeDefinition;
    ClassifiedModelResponse: MessageTypeDefinition;
    LoadedModelList: MessageTypeDefinition;
    Model: MessageTypeDefinition;
    ModelClassificationService: ModelClassificationServiceDefinition;
  }
}

type MessageTypeDefinition = typeof import('@grpc/proto-loader').MessageTypeDefinition;

interface ModelClassificationServiceDefinition {
  new(
    address: string,
    credentials: grpc.ChannelCredentials,
    options?: Partial<grpc.ClientOptions>
  ): ModelClassificationServiceClient;
  service: ModelClassificationServiceService;
} 