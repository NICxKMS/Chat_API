/**
 * Main server entry point
 * Sets up Express server with configured routes and middleware
 */
import dotenv from 'dotenv';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import routes from './routes';
import errorHandler from './middleware/errorHandler';
import rateLimiter from './middleware/rateLimiter';
import config from './config/config';

// Load environment variables from .env file
dotenv.config();

// Create Express application
const app: Express = express();
const PORT = process.env.PORT || 3000;

// Apply middleware
app.use(cors());
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(express.json({ limit: '2mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '2mb' })); // Parse URL-encoded bodies

// Apply rate limiting if enabled
if (config.rateLimiting && config.rateLimiting.enabled) {
  app.use(rateLimiter);
}

// Basic health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', version: config.version });
});

// Apply API routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

export default app; 