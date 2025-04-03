import express from 'express';

const app = express();

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Chat API'
  });
});

export default app; 