/**
 * Circuit breaker implementation for resilient API calls
 * Prevents cascading failures when providers are unresponsive
 */
const metrics = require('./metrics');

class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
    this.name = options.name || 'circuit';
    this.fallbackFn = options.fallback || null;
    this.onStateChange = options.onStateChange || (() => {});
    
    // Map state to metric value
    this.stateValues = {
      'CLOSED': 0,
      'HALF_OPEN': 1,
      'OPEN': 2
    };
    
    // Initialize metrics
    metrics.circuitBreakerState.set({ 
      name: this.name, 
      state: this.state 
    }, this.stateValues[this.state]);
  }

  async exec(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this._changeState('HALF_OPEN');
      } else {
        return this._handleFailure(new Error(`Circuit is OPEN for ${this.name}`), args);
      }
    }

    try {
      const result = await this.fn(...args);
      this._handleSuccess();
      return result;
    } catch (error) {
      return this._handleFailure(error, args);
    }
  }

  _changeState(newState) {
    this.state = newState;
    this.onStateChange(this.state, this.name);
    
    // Update metrics
    metrics.circuitBreakerState.set({ 
      name: this.name, 
      state: this.state 
    }, this.stateValues[this.state]);
  }

  _handleSuccess() {
    if (this.state !== 'CLOSED') {
      this.failureCount = 0;
      this._changeState('CLOSED');
    }
  }

  async _handleFailure(error, args) {
    this.failureCount++;
    
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this._changeState('OPEN');
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
    
    if (this.fallbackFn) {
      return this.fallbackFn(...args, error);
    }
    throw error;
  }
  
  // Reset the circuit breaker
  reset() {
    this.failureCount = 0;
    this._changeState('CLOSED');
  }
}

// CircuitBreaker registry to manage all breakers
const circuitBreakers = new Map();

function createBreaker(name, fn, options = {}) {
  const breaker = new CircuitBreaker(fn, {
    ...options,
    name,
    onStateChange: (state, name) => {
      console.log(`Circuit ${name} state changed to ${state}`);
    }
  });
  
  circuitBreakers.set(name, breaker);
  return breaker;
}

// Get all circuit breakers and their states
function getCircuitBreakerStates() {
  const states = {};
  circuitBreakers.forEach((breaker, name) => {
    states[name] = {
      state: breaker.state,
      failureCount: breaker.failureCount,
      nextAttempt: breaker.state === 'OPEN' ? new Date(breaker.nextAttempt).toISOString() : null
    };
  });
  return states;
}

module.exports = { 
  CircuitBreaker, 
  createBreaker, 
  circuitBreakers,
  getCircuitBreakerStates
};