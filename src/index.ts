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
import express, { Request, Response, NextFunction } from 'express';
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

// Type definitions
interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers?: number;
}

interface RequestWithBody extends Request {
  body: {
    model?: string;
    nocache?: boolean;
    [key: string]: any;
  };
}

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Apply middlewares for optimization
app.use(cors());
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '1MB' }));

// Add compression middleware for faster response delivery
app.use(compression({
  filter: (req: Request, res: Response) => {
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
    const provider = (req.body?.provider || req.query?.provider || 'unknown') as string;
    const model = (req.body?.model || req.query?.model || 'unknown') as string;
    
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
app.use((req: Request, res: Response, next: NextFunction) => {
  const memUsage: MemoryUsage = process.memoryUsage();
  
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
app.use((req: Request, res: Response, next: NextFunction) => {
  const currentTime = Date.now();
  
  // Check memory usage periodically (every 5 minutes)
  if (currentTime - lastMemoryCleanup > 5 * 60 * 1000) {
    lastMemoryCleanup = currentTime;
    
    // Log current memory usage
    const memUsage: MemoryUsage = process.memoryUsage();
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
      if ((global as any).gc) {
        try {
          (global as any).gc();
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

// Type definition for model categories
interface Model {
  name: string;
  isExperimental: boolean;
}

interface Provider {
  name: string;
  models: Model[];
}

interface Category {
  name: string;
  providers: Provider[];
}

// Direct route for categorized models to avoid routing issues
app.get('/api/models/categories', async (_req: Request, res: Response) => {
  // Create some sample categorized models
  const categories: Category[] = [
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
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API Providers endpoint
app.get('/api/providers', (_req: Request, res: Response) => {
  // This is a simple placeholder - you would typically get this from your provider factory
  const providers: string[] = ['openai', 'anthropic', 'gemini', 'mistral', 'ollama'];
  res.json(providers);
});

// Metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

// Cache stats endpoint
app.get('/cache/stats', (_req: Request, res: Response) => {
  res.json(cache.getStats());
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
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
const certKeyPath = path.join(__dirname, '../certs/server.key');
const certCrtPath = path.join(__dirname, '../certs/server.crt');

if (process.env.NODE_ENV === 'production' && 
    fs.existsSync(certKeyPath) && 
    fs.existsSync(certCrtPath)) {
    
  const options = {
    key: fs.readFileSync(certKeyPath),
    cert: fs.readFileSync(certCrtPath)
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

export default app; // Export for testing 