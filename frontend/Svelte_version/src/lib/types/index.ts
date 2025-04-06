// Message roles
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  ERROR = 'error'
}

// Message type definition
export interface MessageType {
  id: string;
  role: MessageRole | string;
  content: string;
  timestamp: number;
  isComplete?: boolean;
  preview?: string; // Used for search results
}

// Conversation type definition
export interface ConversationType {
  id: string;
  title: string;
  messages: MessageType[];
  createdAt: number;
  updatedAt: number;
}

// Chat store state type
export interface ChatStoreState {
  messages: MessageType[];
  conversations: ConversationType[];
  currentConversationId: string | null;
  isStreaming: boolean;
  abortController: AbortController | null;
  error: string | null;
}

// Settings store state type
export interface SettingsStoreState {
  fontSize: 'small' | 'medium' | 'large';
  showTimestamps: boolean;
  autoScroll: boolean;
  showPerformanceMetrics: boolean;
  apiResponseFormat: 'markdown' | 'text' | 'code';
}

// API store state type
export interface ApiStoreState {
  endpointUrl: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  isLoading: boolean;
  error: string | null;
  customHeaders: Record<string, string>;
}

// Model definition
export interface ModelType {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  isDefault?: boolean;
}

// Models store state type
export interface ModelsStoreState {
  availableModels: ModelType[];
  selectedModelId: string | null;
}

// User type
export interface UserType {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Authentication store state type
export interface AuthStoreState {
  user: UserType | null;
  isLoading: boolean;
  error: string | null;
}
