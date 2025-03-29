/**
 * Provider type declarations to handle access to protected properties
 */
import BaseProvider, { ProviderConfig, ProviderResponse } from '../providers/BaseProvider';

// Extended provider interface that exposes protected members
declare global {
  interface ExtendedBaseProvider extends BaseProvider {
    // Make config public for TypeScript while still respecting runtime protection
    config: ProviderConfig & {
      timeout?: number;
      defaultModel?: string;
      [key: string]: any;
    };
  }
}

// Fix for cache.generateKey
declare module '../utils/cache' {
  export function generateKey(data: any): string;
}

// Fix for Anthropic SDK types
declare module '@anthropic-ai/sdk' {
  interface CustomContentBlock {
    type: string;
    text: string;
  }
} 