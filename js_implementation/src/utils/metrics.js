/**
 * Metrics Utility
 * Simple metrics collection for API monitoring
 */

// Basic counter for requests
let requestCount = 0;

// Counter for provider requests
const providerRequestCounter = {
  inc: (labels) => {
    // Simple implementation that just logs the increment
    providerRequestCounter.value++;
    providerRequestCounter.latestLabels = labels;
  },
  value: 0,
  latestLabels: {}
};

// Circuit breaker state
const circuitBreakerState = {
  set: (labels, value) => {
    // Simple implementation that just stores the latest value
    circuitBreakerState.value = value;
    circuitBreakerState.labels = labels;
  },
  value: 0,
  labels: {}
};

// Memory usage gauge
const memoryUsageGauge = {
  set: (labels, value) => {
    // Simple implementation that just stores the latest value
    memoryUsageGauge.value = value;
    memoryUsageGauge.labels = labels;
  },
  value: 0,
  labels: {}
};

// HTTP request duration
const httpRequestDurationMicroseconds = {
  labels: (method, path, provider, model, statusCode) => {
    // Returns an observer that can be used to observe request durations
    return {
      observe: (duration) => {
        // Simple implementation that just stores the latest value
        httpRequestDurationMicroseconds.value = duration;
        httpRequestDurationMicroseconds.latestLabels = { method, path, provider, model, statusCode };
      }
    };
  },
  value: 0,
  latestLabels: {}
};

// Register for metrics endpoint
const register = {
  contentType: 'text/plain',
  metrics: async () => {
    // Generate a simple text representation of metrics
    const metrics = [
      `# HELP api_request_count Total number of API requests`,
      `# TYPE api_request_count counter`,
      `api_request_count ${requestCount}`,
      
      `# HELP provider_request_count Provider API request count`,
      `# TYPE provider_request_count counter`,
      `provider_request_count{provider="${providerRequestCounter.latestLabels.provider || 'unknown'}",model="${providerRequestCounter.latestLabels.model || 'unknown'}",status="${providerRequestCounter.latestLabels.status || 'unknown'}"} ${providerRequestCounter.value}`,
      
      `# HELP circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)`,
      `# TYPE circuit_breaker_state gauge`,
      `circuit_breaker_state{name="${circuitBreakerState.labels.name || 'unknown'}",state="${circuitBreakerState.labels.state || 'unknown'}"} ${circuitBreakerState.value}`,
      
      `# HELP memory_usage_mb Memory usage in MB`,
      `# TYPE memory_usage_mb gauge`,
      `memory_usage_mb{type="${memoryUsageGauge.labels.type || 'unknown'}"} ${memoryUsageGauge.value}`,
      
      `# HELP http_request_duration_ms HTTP request duration in ms`,
      `# TYPE http_request_duration_ms gauge`,
      `http_request_duration_ms{method="${httpRequestDurationMicroseconds.latestLabels.method || 'unknown'}",path="${httpRequestDurationMicroseconds.latestLabels.path || 'unknown'}",provider="${httpRequestDurationMicroseconds.latestLabels.provider || 'unknown'}",model="${httpRequestDurationMicroseconds.latestLabels.model || 'unknown'}",status="${httpRequestDurationMicroseconds.latestLabels.statusCode || 'unknown'}"} ${httpRequestDurationMicroseconds.value}`
    ].join('\n');
    
    return metrics;
  }
};

function incrementRequestCount() {
  requestCount++;
}

module.exports = {
  incrementRequestCount,
  providerRequestCounter,
  circuitBreakerState,
  memoryUsageGauge,
  httpRequestDurationMicroseconds,
  register
};