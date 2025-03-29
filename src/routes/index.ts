/**
 * Routes index
 * Combines all API routes into a single router
 */
import express, { Router } from 'express';
import modelRoutes from './modelRoutes';
import chatRoutes from './chatRoutes';

const router: Router = express.Router();

// Apply API routes
router.use('/models', modelRoutes);
router.use('/chat', chatRoutes);

// Version info route
router.get('/version', (req, res) => {
  res.json({
    version: process.env.npm_package_version || '1.0.0',
    apiVersion: 'v1',
    timestamp: new Date().toISOString()
  });
});

export default router; 