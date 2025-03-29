/**
 * Chat Routes
 * Routes for the chat API endpoints
 */
import express, { Router, Request, Response } from 'express';
import chatController from '../controllers/ChatController';
import cors from 'cors';

const router: Router = express.Router();

// Handle CORS preflight requests
router.options('/completions', (req: Request, res: Response) => {
  // Get the requesting origin or use a default
  const origin = req.headers.origin || 'http://localhost:57983';
  
  console.log(`CORS preflight request from origin: ${origin}`);
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Cache-Control', 'no-cache');
  res.sendStatus(204);
});

// Chat completion endpoint
router.post('/completions', chatController.chatCompletion);

// GET /chat/capabilities - Get chat capabilities and system status
router.get('/capabilities', chatController.getChatCapabilities);

// Export router for use in main application
export default router; 