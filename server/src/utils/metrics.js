/**
 * Metrics Utilities
 * Prometheus metrics for monitoring system performance
 */
import * as promClient from 'prom-client';

// Initialize Prometheus registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Request counter metric
const requestCounter = new promClient.Counter({
  name: 'chat_api_requests_total',
  help: 'Total number of requests to the API',
  registers: [register]
});

// Provider request counter metric
const providerRequestCounter = new promClient.Counter({
  name: 'chat_api_provider_requests_total',
  help: 'Total number of requests to providers',
  labelNames: ['provider', 'model', 'status'],
  registers: [register]
});

// Response time histogram
const responseTimeHistogram = new promClient.Histogram({
  name: 'chat_api_response_time_seconds',
  help: 'Response time in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

// Circuit breaker status gauge
const circuitBreakerGauge = new promClient.Gauge({
  name: 'chat_api_circuit_breaker_status',
  help: 'Circuit breaker status (0=closed, 1=open, 2=half-open)',
  labelNames: ['name', 'state'],
  registers: [register],
  collect() {},
});

// Memory usage gauge
const memoryGauge = new promClient.Gauge({
  name: 'chat_api_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
  collect() {},
});

// Dynamic counters and histograms for providers
const dynamicCounters = new Map();
const dynamicHistograms = new Map();

// Increment request counter
function incrementRequestCount() {
  requestCounter.inc();
}

// Record response time
function recordResponseTime(seconds) {
  responseTimeHistogram.observe(seconds);
}

// Get Prometheus metrics in the required format
function getMetrics() {
  return register.metrics();
}

// Update memory usage metrics
function updateMemoryMetrics() {
  const memoryUsage = process.memoryUsage();
  
  memoryGauge.labels('rss').set(memoryUsage.rss);
  memoryGauge.labels('heapTotal').set(memoryUsage.heapTotal);
  memoryGauge.labels('heapUsed').set(memoryUsage.heapUsed);
  memoryGauge.labels('external').set(memoryUsage.external);
}

// Helper function for provider requests
function incrementProviderRequestCount(provider, model, status) {
  providerRequestCounter.labels(provider, model, status).inc();
}

// Increment dynamic counter (used by providers)
function incrementCounter(name) {
  if (!dynamicCounters.has(name)) {
    const counter = new promClient.Counter({
      name,
      help: `Counter for ${name}`,
      registers: [register]
    });
    dynamicCounters.set(name, counter);
  }
  
  dynamicCounters.get(name).inc();
}

// Observe histogram value (used by providers)
function observeHistogram(name, value) {
  if (!dynamicHistograms.has(name)) {
    const histogram = new promClient.Histogram({
      name,
      help: `Histogram for ${name}`,
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [register]
    });
    dynamicHistograms.set(name, histogram);
  }
  
  dynamicHistograms.get(name).observe(value);
}

// Start collecting metrics automatically
updateMemoryMetrics();
setInterval(updateMemoryMetrics, 10000);

// Reset all metrics
function resetMetrics() {
  register.resetMetrics();
  dynamicCounters.clear();
  dynamicHistograms.clear();
}

// Update circuit breaker gauge method
function updateCircuitBreakerGauge(name, state, value) {
  circuitBreakerGauge.labels(name, state).set(value);
}

// Export metrics utilities
export {
  incrementRequestCount,
  recordResponseTime,
  getMetrics,
  updateMemoryMetrics,
  updateCircuitBreakerGauge,
  resetMetrics,
  register,
  requestCounter,
  providerRequestCounter,
  responseTimeHistogram,
  circuitBreakerGauge,
  memoryGauge,
  incrementProviderRequestCount,
  incrementCounter,
  observeHistogram
}; 