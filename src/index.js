const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const spdy = require('spdy'); // HTTP/2 support

// Load environment variables
dotenv.config();

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

// Routes
app.use('/models', modelRoutes);
app.use('/chat', chatRoutes);

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
      models: '/models',
      chat: '/chat',
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