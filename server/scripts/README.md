# Chat API Load Testing Suite

This directory contains tools for load testing and performance analysis of the Chat API server.

## Available Scripts

### 1. Standard Load Test (load-test.js)

Tests the non-streaming chat completion endpoint with configurable concurrency and duration.

```bash
# Basic usage
npm run load-test

# With custom parameters
node scripts/load-test.js --connections 50 --duration 60 --model openai/gpt-3.5-turbo
```

Options:
- `--connections`: Number of concurrent connections (default: 10)
- `--duration`: Test duration in seconds (default: 30)
- `--model`: Model to use for testing (default: openai/gpt-3.5-turbo)
- `--url`: Base URL for the API (default: http://localhost:3000)
- `--requests-per-second`: Rate limit for requests (default: unlimited)

### 2. Streaming Load Test (stream-test.js)

Specifically tests the streaming endpoint with detailed metrics on chunk delivery.

```bash
# Basic usage
npm run stream-test

# With custom parameters
node scripts/stream-test.js --concurrent 20 --requests 200 --batch 10
```

Options:
- `--concurrent`: Number of concurrent connections (default: 10)
- `--requests`: Total number of requests to make (default: 100)
- `--model`: Model to use for testing (default: openai/gpt-3.5-turbo)
- `--url`: Base URL for the API (default: http://localhost:3000)
- `--batch`: Batch size for requests (default: 5)

### 3. Performance Benchmarking (benchmark.js)

Runs the server with various Node.js Clinic profiling tools to analyze performance bottlenecks.

```bash
# Run all profiling tools
npm run benchmark

# Run specific tools
npm run benchmark:doctor
npm run benchmark:flame

# Advanced usage
node scripts/benchmark.js doctor flame --duration 60 --connections 100
```

Tools:
- `doctor`: Identifies general performance issues
- `bubbleprof`: Analyzes async operations and event loop
- `flame`: Generates CPU flame graphs for identifying hot spots
- `heapprofiler`: Analyzes memory usage patterns

Options:
- `--duration`: Load test duration in seconds (default: 30)
- `--connections`: Number of concurrent connections (default: 50)
- `--port`: Server port (default: 3000)

## Key Metrics

The load testing scripts measure various performance aspects:

### Standard Load Test Metrics
- Requests per second (throughput)
- Latency (min, max, mean, p50, p90, p99)
- Success/failure rates
- Transfer rates

### Streaming Test Metrics
- Time to first chunk (TTFC)
- Average time between chunks
- Total token generation rate
- Connection stability

### Benchmark Metrics
- CPU profiling
- Memory usage
- Event loop delays
- Async bottlenecks

## Interpreting Results

### Performance Targets
- Standard endpoint: Aim for <1s response time at p50
- Streaming endpoint: Aim for <500ms to first chunk
- Memory usage: <500MB per instance under load
- CPU: <80% utilization under sustained load

### Warning Signs
- Response times increasing over test duration
- High p99 latency (>3s)
- Failed requests >1% of total
- Long time to first chunk (>1s)
- Event loop delays >50ms

## Tips for Performance Tuning

Based on benchmark results, consider:

1. **If CPU-bound** (high flame graph peaks):
   - Optimize expensive operations
   - Consider worker threads for CPU-intensive tasks
   - Use caching for repetitive operations

2. **If I/O-bound** (bubbleprof shows I/O waits):
   - Implement connection pooling
   - Review provider timeouts
   - Consider parallel requests

3. **If memory issues** (heapprofiler shows leaks):
   - Review object retention patterns
   - Implement incremental response processing
   - Consider streaming options for large payloads

## Extending the Test Suite

To create additional tests, follow these patterns:

1. Use existing scripts as templates
2. Maintain consistent CLI argument patterns
3. Use the same reporting format for result comparison
4. Consider adding custom metrics relevant to your use case 