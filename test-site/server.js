const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.TEST_SITE_PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add API proxy routes
const API_URL = process.env.API_URL || 'http://localhost:3000';
console.log(`Proxying API requests to: ${API_URL}`);

// Proxy API requests to the backend
app.use('/api', createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // no path rewriting
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add any auth headers if needed
    if (process.env.API_KEY) {
      proxyReq.setHeader('Authorization', `Bearer ${process.env.API_KEY}`);
    }
  },
  logLevel: 'debug',
}));

// Add classified models endpoints
app.get('/api/models/classified', (req, res) => {
  console.log('Classified models requested');
  
  // Mock data for testing when the real API is not available
  const mockData = {
    classifications: [
      {
        property: "provider",
        value: "OpenAI",
        models: [
          {
            id: "gpt-4",
            name: "GPT-4",
            display_name: "GPT-4 Turbo",
            family: "GPT",
            is_experimental: false,
            type: "chat",
            capabilities: ["text"]
          },
          {
            id: "gpt-3.5-turbo",
            name: "GPT-3.5",
            display_name: "GPT-3.5 Turbo",
            family: "GPT",
            is_experimental: false,
            type: "chat", 
            capabilities: ["text"]
          },
          {
            id: "dall-e-3",
            name: "DALL-E 3",
            display_name: "DALL-E 3",
            family: "Image Generation",
            is_experimental: false,
            type: "image",
            capabilities: ["vision", "image"]
          }
        ]
      },
      {
        property: "provider",
        value: "Anthropic",
        models: [
          {
            id: "claude-3-opus",
            name: "Claude 3 Opus",
            display_name: "Claude 3 Opus",
            family: "Claude",
            is_experimental: false,
            type: "chat",
            capabilities: ["text"]
          },
          {
            id: "claude-3-sonnet",
            name: "Claude 3 Sonnet",
            display_name: "Claude 3 Sonnet",
            family: "Claude",
            is_experimental: false,
            type: "chat",
            capabilities: ["text"]
          }
        ]
      },
      {
        property: "family",
        value: "GPT",
        models: [
          {
            id: "gpt-4",
            name: "GPT-4",
            display_name: "GPT-4 Turbo",
            provider: "OpenAI",
            is_experimental: false,
            type: "chat",
            capabilities: ["text"]
          },
          {
            id: "gpt-3.5-turbo",
            name: "GPT-3.5",
            display_name: "GPT-3.5 Turbo",
            provider: "OpenAI",
            is_experimental: false,
            type: "chat",
            capabilities: ["text"]
          }
        ]
      },
      {
        property: "family",
        value: "Claude",
        models: [
          {
            id: "claude-3-opus",
            name: "Claude 3 Opus",
            display_name: "Claude 3 Opus",
            provider: "Anthropic",
            is_experimental: false,
            type: "chat",
            capabilities: ["text"]
          },
          {
            id: "claude-3-sonnet",
            name: "Claude 3 Sonnet",
            display_name: "Claude 3 Sonnet",
            provider: "Anthropic",
            is_experimental: false,
            type: "chat",
            capabilities: ["text"]
          }
        ]
      }
    ]
  };
  
  // Try to proxy to the real API first
  if (API_URL !== 'http://localhost:3000') {
    try {
      // Forward to proxy
      console.log('Forwarding to proxy');
      return createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
      })(req, res);
    } catch (error) {
      console.error('Error proxying to API, returning mock data:', error);
      // Fall back to mock data
      return res.json(mockData);
    }
  } else {
    // Return mock data if no API_URL is set
    console.log('Returning mock classified models');
    return res.json(mockData);
  }
});

app.get('/api/models/classified/criteria', (req, res) => {
  // Mock criteria data
  const mockCriteria = {
    criteria: [
      {
        name: "provider",
        displayName: "Provider",
        values: ["OpenAI", "Anthropic", "Google", "Meta", "Mistral"]
      },
      {
        name: "family",
        displayName: "Family",
        values: ["GPT", "Claude", "Llama", "PaLM", "Gemini", "Mistral"]
      },
      {
        name: "capability",
        displayName: "Capability",
        values: ["text", "vision", "image", "audio", "multimodal"]
      }
    ]
  };
  
  // Try to proxy to the real API first
  if (API_URL !== 'http://localhost:3000') {
    try {
      // Forward to proxy
      return createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
      })(req, res);
    } catch (error) {
      console.error('Error proxying to API, returning mock data:', error);
      // Fall back to mock data
      return res.json(mockCriteria);
    }
  } else {
    // Return mock data if no API_URL is set
    console.log('Returning mock classification criteria');
    return res.json(mockCriteria);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Test site running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to test the Chat API`);
  console.log(`API proxy target: ${API_URL}`);
});