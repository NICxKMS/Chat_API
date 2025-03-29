// Load environment variables first, before any other imports
require('dotenv').config();

// Add detailed debug logging for environment variables
const googleApiKey = process.env.GOOGLE_API_KEY;
console.log('Environment loaded.');
console.log('GOOGLE_API_KEY present:', !!googleApiKey);
if (googleApiKey) {
  const keyPreview = `${googleApiKey.substring(0, 5)}...${googleApiKey.substring(googleApiKey.length - 4)}`;
  console.log(`GOOGLE_API_KEY preview: ${keyPreview}`);
}
console.log('Environment variables:', Object.keys(process.env).filter(key => 
  key.includes('API_KEY') || 
  key.includes('GOOGLE') || 
  key.includes('GEMINI')
).join(', '));

// Now import the rest of the modules
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const spdy = require('spdy'); // HTTP/2 support

// Import routes
const modelRoutes = require('./routes/modelRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Import utilities
const metrics = require('./utils/metrics');
const cache = require('./utils/cache');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Apply middlewares for optimization
app.use(cors());
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '1MB' }));

// Add compression middleware for faster response delivery
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balanced compression level
}));

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
        .labels(req.method, req.path, provider, model, res.statusCode)
        .observe(duration);
    }
  });
  
  next();
});

// Memory usage monitoring middleware
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

// Memory optimization - clean up old cache and run garbage collection periodically
let lastMemoryCleanup = Date.now();
app.use((req, res, next) => {
  const currentTime = Date.now();
  
  // Check memory usage periodically (every 5 minutes)
  if (currentTime - lastMemoryCleanup > 5 * 60 * 1000) {
    lastMemoryCleanup = currentTime;
    
    // Log current memory usage
    const memUsage = process.memoryUsage();
    console.log('Memory usage stats:', {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    });
    
    // Record in metrics
    metrics.memoryUsageGauge.set({ type: 'heapUsed' }, memUsage.heapUsed / 1024 / 1024);
    metrics.memoryUsageGauge.set({ type: 'heapTotal' }, memUsage.heapTotal / 1024 / 1024);
    metrics.memoryUsageGauge.set({ type: 'rss' }, memUsage.rss / 1024 / 1024);
    
    // Perform cleanup if memory is higher than threshold
    if (memUsage.heapUsed > 400 * 1024 * 1024) { // 400 MB threshold
      console.log('Memory usage high, performing cleanup...');
      
      // Suggest garbage collection (may not actually run depending on V8)
      if (global.gc) {
        try {
          global.gc();
          console.log('Garbage collection completed');
        } catch (err) {
          console.error('Error during garbage collection:', err);
        }
      } else {
        console.warn('Garbage collection not available. Run Node with --expose-gc flag to enable it.');
      }
    }
  }
  
  next();
});

// Routes
app.use('/api/models', modelRoutes);
app.use('/api/chat', chatRoutes);

// Direct route for categorized models to avoid routing issues
app.get('/api/models/categories', async (req, res) => {
  // Create some sample categorized models
  const categories = [
    {
      name: 'Latest & Greatest',
      providers: [
        {
          name: 'openai',
          models: [
            { name: 'gpt-4o', isExperimental: false },
            { name: 'gpt-4-turbo', isExperimental: false }
          ]
        },
        {
          name: 'anthropic',
          models: [
            { name: 'claude-3-opus-20240229', isExperimental: false },
            { name: 'claude-3-sonnet-20240229', isExperimental: false }
          ]
        }
      ]
    },
    {
      name: 'Fast & Efficient',
      providers: [
        {
          name: 'openai',
          models: [
            { name: 'gpt-3.5-turbo', isExperimental: false },
            { name: 'gpt-4o-mini', isExperimental: false }
          ]
        },
        {
          name: 'anthropic',
          models: [
            { name: 'claude-3-haiku-20240307', isExperimental: false }
          ]
        },
        {
          name: 'gemini',
          models: [
            { name: 'gemini-1.5-flash', isExperimental: false }
          ]
        }
      ]
    },
    {
      name: 'All Models',
      providers: [
        {
          name: 'openai',
          models: [
            { name: 'gpt-4o', isExperimental: false },
            { name: 'gpt-4-turbo', isExperimental: false },
            { name: 'gpt-3.5-turbo', isExperimental: false },
            { name: 'gpt-4o-mini', isExperimental: false }
          ]
        },
        {
          name: 'anthropic',
          models: [
            { name: 'claude-3-opus-20240229', isExperimental: false },
            { name: 'claude-3-sonnet-20240229', isExperimental: false },
            { name: 'claude-3-haiku-20240307', isExperimental: false }
          ]
        },
        {
          name: 'gemini',
          models: [
            { name: 'gemini-1.5-flash', isExperimental: false },
            { name: 'gemini-1.5-pro', isExperimental: false },
            { name: 'gemini-1.0-pro', isExperimental: false }
          ]
        }
      ]
    }
  ];
  
  res.json(categories);
});

// API Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API Providers endpoint
app.get('/api/providers', (req, res) => {
  // This is a simple placeholder - you would typically get this from your provider factory
  const providers = ['openai', 'anthropic', 'gemini', 'mistral', 'ollama'];
  res.json(providers);
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

// Cache stats endpoint
app.get('/cache/stats', (req, res) => {
  res.json(cache.getStats());
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Chat API',
    version: '1.0.0',
    endpoints: {
      models: '/api/models',
      chat: '/api/chat',
      metrics: '/metrics',
      cacheStats: '/cache/stats'
    }
  });
});

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

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  // Close any db connections, cleanup operations, etc.
  process.exit(0);
});

module.exports = app; // Export for testing