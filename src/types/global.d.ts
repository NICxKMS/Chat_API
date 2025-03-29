/**
 * Global type declarations for modules without TypeScript definitions
 */

// Provider Factory module
declare module '../providers/ProviderFactory' {
  import BaseProvider from '../providers/BaseProvider';
  
  const providerFactory: {
    getProvider(providerName?: string | null): BaseProvider;
    getDefaultProvider(): BaseProvider;
    getAllProviders(): BaseProvider[];
    getProviderNames(): string[];
    getAllModels(): Promise<Record<string, any>>;
    getProvidersInfo(): Promise<Record<string, any>[]>;
  };
  
  export default providerFactory;
}

// Middleware modules
declare module '../middleware/errorHandler' {
  import { ErrorRequestHandler } from 'express';
  const errorHandler: ErrorRequestHandler;
  export default errorHandler;
}

declare module '../middleware/rateLimiter' {
  import { RequestHandler } from 'express';
  const rateLimiter: RequestHandler;
  export default rateLimiter;
}

// Utils modules
declare module '../utils/modelCategorizer' {
  export function categorizeModels(
    modelsByProvider: Record<string, any>,
    includeExperimental?: boolean
  ): any;
}

declare module '../utils/circuitBreaker' {
  export function createBreaker(
    name: string,
    fn: Function,
    options?: Record<string, any>
  ): any;
  
  export function getCircuitBreakerStates(): Record<string, any>;
}

declare module '../utils/cache' {
  export function isEnabled(): boolean;
  export function get(key: string): Promise<any>;
  export function set(key: string, value: any, ttl?: number): Promise<void>;
  export function generateKey(data: Record<string, any>): string;
  export function getStats(): Record<string, any>;
}

declare module '../utils/metrics' {
  export function incrementRequestCount(): void;
  export const providerRequestCounter: {
    inc(labels: Record<string, string>): void;
  };
} 