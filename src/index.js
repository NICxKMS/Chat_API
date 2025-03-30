// Load environment variables first, before any other imports
import dotenv from 'dotenv';
dotenv.config();

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
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import spdy from 'spdy'; // HTTP/2 support

// Import routes
import modelRoutes from './routes/modelRoutes';
import chatRoutes from './routes/chatRoutes';

// Import utilities
import * as metrics from './utils/metrics';
import * as cache from './utils/cache';

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

// Create a middleware for metrics collection
app.use((req, res, next) => {
  // Track request count
  metrics.incrementRequestCount();
  
  // Track response time
  const startTime = process.hrtime();
  
  // When response finishes
  res.on('finish', () => {
    // Calculate response time
    const duration = process.hrtime(startTime);
    const responseTimeMs = (duration[0] * 1000) + (duration[1] / 1000000);
    
    // Record response time
    metrics.recordResponseTime(responseTimeMs / 1000); // Convert to seconds for histogram
    
    // Get provider and model from request (if applicable)
    const provider = (req.body?.provider || req.query?.provider || 'unknown');
    const model = (req.body?.model || req.query?.model || 'unknown');
    
    // Record provider request (if applicable)
    if (req.path.includes('/api/chat') || req.path.includes('/api/models')) {
      metrics.incrementProviderRequestCount(
        provider,
        model,
        res.statusCode.toString()
      );
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
    metrics.memoryGauge.labels('heapUsed').set(memUsage.heapUsed);
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
    metrics.memoryGauge.labels('heapUsed').set(memUsage.heapUsed);
    metrics.memoryGauge.labels('heapTotal').set(memUsage.heapTotal);
    metrics.memoryGauge.labels('rss').set(memUsage.rss);
    
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
            { name: 'gpt-4-turbo', isExperimental: false },
            { name: 'gpt-4', isExperimental: false }
          ]
        },
        {
          name: 'anthropic',
          models: [
            { name: 'claude-3-opus', isExperimental: false },
            { name: 'claude-3-sonnet', isExperimental: false },
            { name: 'claude-3-haiku', isExperimental: false }
          ]
        },
        {
          name: 'google',
          models: [
            { name: 'gemini-1.5-pro', isExperimental: false },
            { name: 'gemini-1.5-flash', isExperimental: false },
            { name: 'gemini-1.0-pro', isExperimental: false }
          ]
        }
      ]
    }
  ];
  
  res.json(categories);
});

// Health check endpoint
app.get('/health', (req, res) => {
  // Get memory usage data
  const memUsage = process.memoryUsage();
  
  // Get CPU usage (from metrics if available)
  const cpuUsage = metrics.getCpuUsage ? metrics.getCpuUsage() : undefined;
  
  // Get cache stats
  const cacheStats = cache.getStats ? cache.getStats() : undefined;
  
  // Return health data
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    },
    cpu: cpuUsage,
    cache: cacheStats,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Metrics endpoint for Prometheus scraping
app.get('/metrics', (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  metrics.register.metrics().then(data => res.end(data));
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Path ${req.path} does not exist`
  });
});

// Handle errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.statusCode || 500).json({ 
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred'
  });
});

// Start the server based on configuration
if (process.env.ENABLE_HTTP2 === 'true') {
  // Setup HTTP/2 server with SSL
  const options = {
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt'))
  };
  
  spdy.createServer(options, app).listen(PORT, () => {
    console.log(`HTTP/2 Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
} else {
  // Start standard HTTP server
  app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app; 