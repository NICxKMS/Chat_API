# Centralized Chat API: Setup Guide

## Project Overview

The Centralized Chat API is a flexible and extensible API service that provides a unified interface for interacting with multiple AI chat providers, including OpenAI, Anthropic, Google Gemini, and OpenRouter. It abstracts away the differences between provider APIs, offering a consistent request/response format while maintaining provider-specific capabilities.

Key features include:
- Provider-agnostic interface for working with multiple LLM providers
- Support for streaming responses
- Model discovery and exploration
- Easily extensible architecture for adding new providers
- Unified request/response format across all providers
- Test site for demonstrating API functionality

## Tech Stack

### Programming Languages
- JavaScript (Node.js)

### Frameworks & Libraries
- **Express.js**: Web server framework
- **OpenAI SDK**: For interacting with OpenAI API (`openai` package)
- **Anthropic SDK**: For interacting with Anthropic API (`@anthropic-ai/sdk` package)
- **Google Generative AI SDK**: For interacting with Gemini API (`@google/generative-ai` package)
- **Axios**: HTTP client for API requests
- **CORS**: Cross-Origin Resource Sharing middleware
- **dotenv**: Environment variable management

### Development Tools
- **Nodemon**: Development server with auto-restart capability

### Dependencies
```json
"dependencies": {
  "@anthropic-ai/sdk": "^0.39.0",
  "@google/generative-ai": "^0.24.0",
  "axios": "^1.8.4",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "openai": "^4.90.0",
  "node-cache": "^5.1.2",
  "prom-client": "^14.2.0"
},
"devDependencies": {
  "nodemon": "^3.1.9"
}
```

## Directory and File Structure

```
chat_api/
├── .env                    # Environment variables (not in version control)
├── .env.example            # Template for environment variables
├── .gitignore              # Git ignore configuration
├── changes.md              # Change log for documenting updates
├── package.json            # Project metadata and dependencies
├── README.md               # Project documentation
├── setup.md                # This comprehensive setup guide
├── src/                    # Source code directory
│   ├── index.js            # Main application entry point
│   ├── config/             # Configuration files
│   │   └── config.js       # Central configuration for providers and models
│   ├── controllers/        # Request handlers
│   │   ├── ChatController.js  # Handles chat-related endpoints
│   │   └── ModelController.js # Handles model-related endpoints
│   ├── providers/          # Provider-specific implementations
│   │   ├── AnthropicProvider.js  # Anthropic-specific implementation
│   │   ├── BaseProvider.js      # Abstract base class for providers
│   │   ├── GeminiProvider.js    # Google Gemini implementation
│   │   ├── OpenAIProvider.js    # OpenAI implementation
│   │   ├── OpenRouterProvider.js # OpenRouter implementation
│   │   └── ProviderFactory.js   # Factory for instantiating providers
│   ├── utils/              # Utility files
│   │   ├── cache.js        # Caching utility
│   │   └── metrics.js      # Performance metrics utility
│   └── routes/             # API route definitions
│       ├── chatRoutes.js   # Routes for chat endpoints
│       └── modelRoutes.js  # Routes for model endpoints
└── test-site/             # Demo website for testing the API
    ├── server.js          # Simple server for the test site
    └── public/            # Static files for the test site
        ├── index.html     # Main page of the test site
        ├── css/           # Stylesheets
        │   └── styles.css # Main stylesheet
        └── js/            # JavaScript files
            └── app.js     # Main client-side application code
```

### Key Components Explained

- **src/index.js**: The entry point of the application. Sets up the Express server, middleware, and routes.
- **src/config/config.js**: Centralizes configuration settings, including provider-specific settings and model lists.
- **src/providers/BaseProvider.js**: Abstract class that defines the interface all providers must implement.
- **src/providers/ProviderFactory.js**: Factory pattern implementation for instantiating and managing providers.
- **src/controllers/**: Contains business logic for handling API requests.
- **src/routes/**: Defines API endpoints and connects them to controller methods.
- **src/utils/cache.js**: Implements caching functionality for optimizing API performance.
- **src/utils/metrics.js**: Implements response time monitoring and performance metrics collection.
- **test-site/**: A simple web application demonstrating how to use the Chat API.

## Essential Code Fragments and Templates

### 1. Base Provider Template (`src/providers/BaseProvider.js`)

```javascript
class BaseProvider {
  constructor(config) {
    if (this.constructor === BaseProvider) {
      throw new Error('BaseProvider is an abstract class and cannot be instantiated directly');
    }
    
    this.config = config;
    this.name = 'base';
  }

  getModels() {
    throw new Error('getModels() method must be implemented by provider classes');
  }

  async chatCompletion(options) {
    throw new Error('chatCompletion() method must be implemented by provider classes');
  }

  async streamChatCompletion(options, onChunk) {
    throw new Error('streamChatCompletion() method must be implemented by provider classes');
  }

  getInfo() {
    return {
      name: this.name,
      models: this.getModels(),
      defaultModel: this.config.defaultModel,
      supportsStreaming: this.supportsStreaming || false
    };
  }
}

module.exports = BaseProvider;
```

### Provider Implementation Best Practices

When implementing provider classes, leverage the default methods and configurations provided by the official SDKs rather than creating excessive custom implementations:

```javascript
// Example for OpenAIProvider.js
const { OpenAI } = require('openai');
const BaseProvider = require('./BaseProvider');

class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'openai';
    this.supportsStreaming = true;
    
    // Use the SDK's default configuration
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }

  async chatCompletion({ model, messages, temperature, max_tokens }) {
    // Use the SDK's built-in methods directly
    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens
    });
    
    // Just normalize the response format
    return this.normalizeResponse(response);
  }

  async streamChatCompletion({ model, messages, temperature, max_tokens }, onChunk) {
    // Use the SDK's streaming capabilities directly
    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true
    });
    
    // Process the stream using SDK's event handling
    for await (const chunk of stream) {
      onChunk(this.normalizeStreamChunk(chunk));
    }
  }
  
  // Dynamic model loading implementation
  async getModels() {
    // Start with hardcoded models for fast initial loading
    let models = this.config.models || [];
    
    // If dynamic loading is enabled, fetch the latest models from the API
    if (this.config.dynamicModelLoading) {
      try {
        // Use the SDK's built-in method to list models
        const response = await this.client.models.list();
        
        // Extract model IDs and filter as needed (e.g., only chat models)
        const dynamicModels = response.data
          .filter(model => model.id.includes('gpt'))
          .map(model => model.id);
        
        // Combine with hardcoded models, removing duplicates
        models = [...new Set([...models, ...dynamicModels])];
      } catch (error) {
        console.warn(`Failed to dynamically load OpenAI models: ${error.message}`);
        // Continue with hardcoded models if dynamic loading fails
      }
    }
    
    return models;
  }
}
```

### 2. Server Setup (`src/index.js`)

```javascript
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const modelRoutes = require('./routes/modelRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Import metrics
const metrics = require('./utils/metrics');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Add middleware to measure request duration
app.use((req, res, next) => {
  const start = Date.now();
  
  // Add hook to execute after request is done
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Skip metrics route itself
    if (req.path !== '/metrics') {
      const provider = req.body?.model?.split('/')[0] || 'unknown';
      const model = req.body?.model?.split('/')[1] || 'unknown';
      
      metrics.httpRequestDurationMicroseconds
        .labels(req.method, req.route?.path || req.path, provider, model, res.statusCode)
        .observe(duration);
    }
  });
  
  next();
});

// Routes
app.use('/models', modelRoutes);
app.use('/chat', chatRoutes);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Chat API',
    version: '1.0.0',
    endpoints: {
      models: '/models',
      chat: '/chat',
      metrics: '/metrics'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 3. Provider Factory Pattern (`src/providers/ProviderFactory.js`)

```javascript
const config = require('../config/config');
// Import provider classes...

class ProviderFactory {
  constructor() {
    this.providers = {};
    this.loadProviders();
  }

  loadProviders() {
    // Initialize provider instances
    const providerConfigs = config.providers;
    
    if (providerConfigs.openai?.apiKey) {
      this.providers.openai = new OpenAIProvider(providerConfigs.openai);
    }
    
    // Load other providers similarly...

    // Update default provider if the configured one isn't available
    if (!this.providers[config.defaultProvider]) {
      const availableProviders = Object.keys(this.providers);
      if (availableProviders.length > 0) {
        config.defaultProvider = availableProviders[0];
      }
    }
  }

  getProvider(name) {
    const providerName = name || config.defaultProvider;
    const provider = this.providers[providerName];
    
    if (!provider) {
      // Handle provider not found...
    }
    
    return provider;
  }

  getAllProviders() {
    return Object.values(this.providers);
  }
}

// Create singleton instance
const providerFactory = new ProviderFactory();
module.exports = providerFactory;
```

### 4. Configuration Template (`src/config/config.js`)

```javascript
module.exports = {
  // Default provider to use when none is specified
  defaultProvider: process.env.DEFAULT_PROVIDER || 'openai',
  
  // Provider configuration
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      models: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-3.5-turbo'
        // Additional models will be loaded dynamically
      ],
      defaultModel: 'gpt-4o-mini',
      // Enable dynamic model loading from provider
      dynamicModelLoading: true
    },
    // Other provider configurations...
  }
};
```

### 5. Route Definition Template (`src/routes/chatRoutes.js`)

```javascript
const express = require('express');
const chatController = require('../controllers/ChatController');

const router = express.Router();

router.post('/completions', chatController.chatCompletion);
router.post('/completions/stream', chatController.streamChatCompletion);
router.get('/completions/stream', chatController.streamChatCompletion);
router.get('/capabilities', chatController.getChatCapabilities);

module.exports = router;
```

### 6. Controller Template (`src/controllers/ChatController.js`)

```javascript
const providerFactory = require('../providers/ProviderFactory');
const cache = require('../utils/cache');

class ChatController {
  async chatCompletion(req, res) {
    try {
      const { model, messages, temperature, max_tokens } = req.body;
      
      // Generate cache key
      const cacheKey = cache.generateKey({
        provider: providerName,
        model,
        messages,
        temperature,
        max_tokens
      });
      
      // Check cache first
      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        console.log('Cache hit for:', cacheKey);
        return res.json(cachedResponse);
      }
      
      // Extract provider and model...
      
      // Get provider...
      
      // Send request to provider...
      
      // Cache response before returning
      cache.set(cacheKey, response);
      
      // Return response
      res.json(response);
      
    } catch (error) {
      console.error(`Chat completion error: ${error.message}`);
      res.status(500).json({ error: 'Chat completion failed', message: error.message });
    }
  }

  // Other methods...
}

module.exports = new ChatController();
```

### Performance Optimization

1. **Caching Responses**
   - Implement caching for model lists and capabilities
   - Use a library like `node-cache` or Redis
   - Cache model lists with appropriate TTL (time-to-live)
   - Implement response caching for identical requests

### Advanced Performance Optimization Techniques

#### 1. Parallel Processing
- Implement parallel API calls using Promise.all for concurrent requests
- Use worker threads for CPU-intensive operations
- Add batch processing capabilities for multiple similar requests
- Implement request multiplexing to reduce overhead

```javascript
// Example: Parallel provider model fetching 
// Add to src/controllers/ModelController.js
async getAllModels() {
  try {
    const providers = providerFactory.getAllProviders();
    
    // Fetch models from all providers in parallel
    const modelPromises = providers.map(async (provider) => {
      try {
        const models = await provider.getModels();
        return {
          provider: provider.name,
          models: models
        };
      } catch (error) {
        console.error(`Error fetching models from ${provider.name}:`, error);
        return {
          provider: provider.name,
          models: [],
          error: error.message
        };
      }
    });
    
    // Wait for all promises to resolve
    const results = await Promise.all(modelPromises);
    
    return results;
  } catch (error) {
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
}
```

#### 2. Memory Optimization
- Implement streaming for large request and response bodies
- Use Buffer pooling for binary data processing
- Configure proper garbage collection settings
- Add memory usage monitoring and alerts
- Implement pagination for large data responses

```javascript
// Memory usage monitoring middleware
// Add to src/index.js after other middleware
app.use((req, res, next) => {
  const memUsage = process.memoryUsage();
  
  // Log if memory usage is high
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
    console.warn('High memory usage detected', {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      endpoint: req.originalUrl
    });
    
    // Record in metrics
    metrics.memoryUsageGauge.set({
      type: 'heapUsed'
    }, memUsage.heapUsed / 1024 / 1024);
  }
  
  next();
});
```

#### 3. Advanced Caching Strategies
- Implement multi-level caching (memory, Redis, distributed)
- Add cache warming for frequently accessed endpoints
- Implement smart cache invalidation with pub/sub
- Use cache hit ratio monitoring to optimize TTL values
- Add stale-while-revalidate pattern for fresh content

```javascript
// Enhanced caching implementation
// Update src/utils/cache.js
const NodeCache = require('node-cache');
const Redis = require('ioredis'); // Add to package.json

// Create tiered cache system
const memoryCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min TTL
let redisCache = null;

// Initialize Redis if configured
if (process.env.REDIS_URL) {
  redisCache = new Redis(process.env.REDIS_URL);
  console.log('Redis cache initialized');
}

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  setCount: 0
};

module.exports = {
  // Get from cache with tiered fallback
  async get(key) {
    // Try memory cache first (fastest)
    const memResult = memoryCache.get(key);
    if (memResult !== undefined) {
      stats.hits++;
      return memResult;
    }
    
    // Try Redis if available
    if (redisCache) {
      try {
        const redisResult = await redisCache.get(key);
        if (redisResult) {
          // Populate memory cache for next time
          const parsed = JSON.parse(redisResult);
          memoryCache.set(key, parsed);
          stats.hits++;
          return parsed;
        }
      } catch (error) {
        console.error('Redis cache error:', error);
      }
    }
    
    stats.misses++;
    return null;
  },
  
  // Set in all cache layers
  async set(key, value, ttl = 600) {
    stats.setCount++;
    
    // Always set in memory cache
    memoryCache.set(key, value, ttl);
    
    // Set in Redis if available
    if (redisCache) {
      try {
        await redisCache.setex(key, ttl, JSON.stringify(value));
      } catch (error) {
        console.error('Redis cache set error:', error);
      }
    }
    
    return true;
  },
  
  // Get cache stats
  getStats() {
    const hitRatio = stats.hits + stats.misses > 0 
      ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) 
      : 0;
      
    return {
      ...stats,
      hitRatio: `${hitRatio}%`,
      memoryItems: memoryCache.keys().length,
      memoryStats: memoryCache.getStats()
    };
  },
  
  // Additional methods...
};
```

#### 4. Network Optimization
- Implement HTTP/2 for multiplexed connections
- Add compression middleware (gzip, brotli)
- Configure connection pooling for external API calls
- Implement DNS caching
- Set appropriate timeouts for all network requests

```javascript
// Network optimization example
// Add to src/index.js
const compression = require('compression'); // Add to package.json
const spdy = require('spdy'); // HTTP/2 support - Add to package.json
const fs = require('fs');
const path = require('path');

// Add compression middleware
app.use(compression({
  // Don't compress responses with this content type
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all other responses
    return compression.filter(req, res);
  },
  // Compression level (1-9)
  level: 6
}));

// Configure HTTP/2 if certificates are available
if (process.env.NODE_ENV === 'production' && 
    fs.existsSync(path.join(__dirname, '../certs/server.key')) && 
    fs.existsSync(path.join(__dirname, '../certs/server.crt'))) {
    
  const options = {
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt'))
  };

  // Create HTTP/2 server
  spdy.createServer(options, app).listen(PORT, () => {
    console.log(`HTTP/2 Server running on port ${PORT}`);
  });
} else {
  // Fallback to standard HTTP server
  app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
  });
}
```

#### 5. Circuit Breaker and Resilience
- Implement circuit breaker pattern for API calls
- Add retry mechanisms with exponential backoff
- Create fallback mechanisms when providers are unavailable
- Monitor provider health and availability

```javascript
// Circuit breaker implementation
// Create a new file: src/utils/circuitBreaker.js
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
  }

  async exec(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        this.onStateChange(this.state, this.name);
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

  _handleSuccess() {
    if (this.state !== 'CLOSED') {
      this.failureCount = 0;
      this.state = 'CLOSED';
      this.onStateChange(this.state, this.name);
    }
  }

  async _handleFailure(error, args) {
    this.failureCount++;
    
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.onStateChange(this.state, this.name);
    }
    
    if (this.fallbackFn) {
      return this.fallbackFn(...args, error);
    }
    throw error;
  }
}

// Usage example
const circuitBreakers = new Map();

function createBreaker(name, fn, options = {}) {
  const breaker = new CircuitBreaker(fn, {
    ...options,
    name,
    onStateChange: (state, name) => {
      console.log(`Circuit ${name} state changed to ${state}`);
      metrics.circuitBreakerState.set({ name, state: state }, 1);
    }
  });
  
  circuitBreakers.set(name, breaker);
  return breaker;
}

module.exports = { CircuitBreaker, createBreaker, circuitBreakers };
```

#### 6. Load Testing and Performance Profiling
- Implement automated load testing pipeline
- Add performance profiling tools
- Set up synthetic monitoring for key endpoints
- Create performance dashboards with historical data
- Implement A/B testing for optimization experiments

```javascript
// Add these dev dependencies to package.json:
// "autocannon": "^7.10.0",
// "clinic": "^12.0.0"

// Create a load test script: scripts/load-test.js
const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

// Default test configuration
const defaultConfig = {
  url: 'http://localhost:3000',
  connections: 10,
  duration: 10,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Test cases
const tests = [
  {
    name: 'Get Models API',
    method: 'GET',
    path: '/models'
  },
  {
    name: 'Chat Completion API',
    method: 'POST',
    path: '/chat/completions',
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
      temperature: 0.7,
      max_tokens: 150
    })
  }
];

// Run tests sequentially
async function runTests() {
  const results = {};
  
  for (const test of tests) {
    console.log(`Running test: ${test.name}`);
    
    const config = {
      ...defaultConfig,
      title: test.name,
      method: test.method,
      url: `${defaultConfig.url}${test.path}`,
      headers: {
        ...defaultConfig.headers
      }
    };
    
    if (test.body) {
      config.body = test.body;
    }
    
    const result = await autocannon(config);
    results[test.name] = result;
    
    console.log(`Test completed: ${test.name}`);
    console.log(`Latency: ${result.latency.average}ms average, ${result.latency.p99}ms p99`);
    console.log(`Requests/sec: ${result.requests.average}`);
    console.log('-----------------------------------');
  }
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = path.join(__dirname, '../test-results');
  
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(resultsDir, `load-test-${timestamp}.json`),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`Results saved to test-results/load-test-${timestamp}.json`);
}

runTests().catch(console.error);
```

By implementing these advanced optimization techniques, you'll ensure the Chat API delivers minimal response times and maintains high performance even under heavy load. Regularly monitor metrics and review optimization strategies as your application scales.