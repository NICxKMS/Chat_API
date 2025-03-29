/**
 * Circuit Breaker Implementation
 * Protects against cascading failures when external services are unavailable
 */
import * as metrics from './metrics';

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit is open (failing)
  HALF_OPEN = 'half-open' // Testing if service recovered
}

// Type definition for fallback function
type FallbackFunction = (params: any, error: Error) => Promise<any>;

// Type definition for state change callback
type StateChangeCallback = (state: CircuitState, breakerName: string) => void;

// Define the circuit breaker options interface
export interface CircuitBreakerOptions {
  failureThreshold?: number;    // Number of failures before opening
  resetTimeout?: number;        // Time to wait before half-open (ms)
  errorThreshold?: number;      // Percentage of failures to consider circuit unhealthy
  monitorInterval?: number;     // Health check interval (ms)
  name?: string;
  fallback?: FallbackFunction | null;
  onStateChange?: StateChangeCallback; // Callback for state changes
}

// Circuit breaker state information
export interface CircuitBreakerStateReport {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  fallbackCalls: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
}

// Store active circuit breakers
const circuitBreakers: Map<string, CircuitBreaker> = new Map();

/**
 * Circuit Breaker class
 * Implements the circuit breaker pattern for API calls
 */
export class CircuitBreaker {
  private name: string;
  private action: (...args: unknown[]) => Promise<unknown>;
  private fallback: FallbackFunction | null;
  private state: CircuitState = CircuitState.CLOSED;
  private failureThreshold: number;
  private resetTimeout: number;
  private errorThreshold: number;
  private failures: number = 0;
  private successes: number = 0;
  private fallbackCalls: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private nextAttempt: Date | null = null;
  private onStateChange: StateChangeCallback;

  /**
   * Create a new circuit breaker
   */
  constructor(name: string, action: (...args: unknown[]) => Promise<unknown>, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.action = action;
    this.fallback = options.fallback || null;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.errorThreshold = options.errorThreshold || 50;
    this.onStateChange = options.onStateChange || (() => {});
    
    // Initialize metrics
    metrics.circuitBreakerGauge.set({ 
      name: this.name, 
      state: this.state 
    }, this.stateToValue());
    
    // Register this breaker
    circuitBreakers.set(name, this);
  }

  /**
   * Execute the action with circuit breaker protection
   */
  async fire(...args: unknown[]): Promise<any> {
    if (this.state === CircuitState.OPEN) {
      // Check if it's time to try again
      if (this.nextAttempt && new Date() > this.nextAttempt) {
        this.setState(CircuitState.HALF_OPEN);
      } else {
        return this.handleOpen(args);
      }
    }
    
    try {
      // Execute the action
      const result = await this.action(...args);
      
      // Record successful call
      this.recordSuccess();
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure();
      
      // Handle fallback or rethrow
      if (this.fallback) {
        this.fallbackCalls++;
        return this.fallback(args[0], error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    this.successes++;
    this.lastSuccess = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.CLOSED);
      this.failures = 0;
    }
    
    // Update metrics
    metrics.circuitBreakerGauge.set({ 
      name: this.name, 
      state: this.state 
    }, this.stateToValue());
  }

  /**
   * Record a failed call
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
    
    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED && this.failures >= this.failureThreshold) {
      this.setState(CircuitState.OPEN);
      this.nextAttempt = new Date(Date.now() + this.resetTimeout);
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN);
      this.nextAttempt = new Date(Date.now() + this.resetTimeout);
    }
    
    // Update metrics
    metrics.circuitBreakerGauge.set({ 
      name: this.name, 
      state: this.state 
    }, this.stateToValue());
  }

  /**
   * Handle open circuit
   */
  private async handleOpen(args: unknown[]): Promise<unknown> {
    if (this.fallback) {
      this.fallbackCalls++;
      return this.fallback(args[0], new Error('Circuit is open'));
    }
    throw new Error(`Service ${this.name} is unavailable (circuit open)`);
  }

  /**
   * Set the circuit state
   */
  private setState(newState: CircuitState): void {
    this.state = newState;
    this.onStateChange(this.state, this.name);
  }

  /**
   * Convert state to numeric value for metrics
   */
  private stateToValue(): number {
    switch (this.state) {
      case CircuitState.CLOSED: return 0;
      case CircuitState.HALF_OPEN: return 1;
      case CircuitState.OPEN: return 2;
      default: return -1;
    }
  }

  /**
   * Get current state information
   */
  getState(): CircuitBreakerStateReport {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      fallbackCalls: this.fallbackCalls,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess
    };
  }
}

/**
 * Create a new circuit breaker
 */
export function createBreaker(
  name: string, 
  action: (...args: unknown[]) => Promise<unknown>, 
  options: CircuitBreakerOptions = {}
): CircuitBreaker {
  // Combine provided options with defaults
  const fullOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 30000,
    errorThreshold: 50,
    onStateChange: (state, breakerName) => {
      // Call user-provided callback if set
      if (options.onStateChange) {
        options.onStateChange(state, breakerName);
      }
      
      // Log state change
      console.log(`Circuit breaker ${breakerName} changed to ${state}`);
    },
    ...options
  };
  
  return new CircuitBreaker(name, action, fullOptions);
}

/**
 * Get the current state of all circuit breakers
 */
export function getCircuitBreakerStates(): Record<string, CircuitBreakerStateReport> {
  const states: Record<string, CircuitBreakerStateReport> = {};
  
  circuitBreakers.forEach((breaker, name) => {
    states[name] = breaker.getState();
  });
  
  return states;
} 