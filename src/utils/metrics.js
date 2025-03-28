/**
 * Performance metrics utility using Prometheus client
 * Tracks response times, memory usage, and provider statistics
 */
const promClient = require('prom-client');

// Create a Registry to register and collect metrics
const register = new promClient.Registry();

// Add default metrics (process metrics like memory, CPU, event loop)
promClient.collectDefaultMetrics({ register });

// Create custom metrics

// HTTP request duration metric
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_milliseconds',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'provider', 'model', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000], // response time buckets
  registers: [register]
});

// Cache hit/miss counter
const cacheAccessCounter = new promClient.Counter({
  name: 'cache_access_total',
  help: 'Count of cache hits and misses',
  labelNames: ['result', 'type'], // result: hit/miss, type: model/completion
  registers: [register]
});

// Provider request counter
const providerRequestCounter = new promClient.Counter({
  name: 'provider_requests_total',
  help: 'Count of requests to different AI providers',
  labelNames: ['provider', 'model', 'status'], // status: success/error
  registers: [register]
});

// Request rate gauge
const requestRateGauge = new promClient.Gauge({
  name: 'request_rate',
  help: 'Current request rate per second',
  registers: [register]
});

// Memory usage gauge
const memoryUsageGauge = new promClient.Gauge({
  name: 'memory_usage_mb',
  help: 'Memory usage in MB',
  labelNames: ['type'], // type: heapUsed, rss, etc.
  registers: [register]
});

// Circuit breaker state gauge
const circuitBreakerState = new promClient.Gauge({
  name: 'circuit_breaker_state',
  help: 'State of circuit breakers (0: closed, 1: half-open, 2: open)',
  labelNames: ['name', 'state'],
  registers: [register]
});

// Request queue size gauge
const requestQueueGauge = new promClient.Gauge({
  name: 'request_queue_size',
  help: 'Number of requests in queue',
  registers: [register]
});

// Start a request rate calculator
let requestCount = 0;
setInterval(() => {
  requestRateGauge.set(requestCount);
  requestCount = 0;
  
  // Collect memory usage too
  const memUsage = process.memoryUsage();
  memoryUsageGauge.set({ type: 'heapUsed' }, memUsage.heapUsed / 1024 / 1024);
  memoryUsageGauge.set({ type: 'rss' }, memUsage.rss / 1024 / 1024);
}, 1000);

// Export metrics
module.exports = {
  register,
  httpRequestDurationMicroseconds,
  cacheAccessCounter,
  providerRequestCounter,
  requestRateGauge,
  memoryUsageGauge,
  circuitBreakerState,
  requestQueueGauge,
  
  // Helper method to increment request count
  incrementRequestCount: () => {
    requestCount++;
  }
};