# Chat API

A centralized API that provides access to multiple LLM providers through a single interface.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the example environment file:
   ```
   cp .env.example .env
   ```
4. Edit `.env` to add your API keys for the providers you want to use

## OpenRouter Setup

OpenRouter has updated their authentication system to use Clerk. To use OpenRouter with this API:

1. Get your API key from [OpenRouter Dashboard](https://openrouter.ai/keys)
2. Make sure you're using the new API key format that starts with `sk-or-v1-...`
3. Set the following environment variables in your `.env` file:

```
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_HTTP_REFERER=https://your-app-domain.com  # Required by OpenRouter
OPENROUTER_TITLE=Your App Name  # Optional but helpful
```

## Running the Server

Start the API server:

```
npm start
```

Or use the provided batch script to start both the API server and test site:

```
start-servers.bat
```

The API will be available at http://localhost:3000 and the test site at http://localhost:8080.

## Available Providers

- OpenAI
- Anthropic
- Google Gemini
- OpenRouter (provides access to many different models)

## API Endpoints

- `GET /models` - List all available models
- `GET /models/categorized` - Get models organized by provider, family, type, and version
- `GET /models/providers` - List all available providers
- `GET /models/:providerName` - List models for a specific provider
- `POST /chat/completions` - Send a chat completion request
- `POST /chat/completions/stream` - Stream a chat completion response

## Error Handling

If you encounter authentication errors with OpenRouter:
1. Check that your API key is in the correct format (should start with `sk-or-v1-`)
2. Ensure you've set the correct HTTP referer in your environment variables
3. Check the OpenRouter dashboard to verify your API key is valid

## Troubleshooting

### OpenRouter Streaming Issues

If you encounter circular JSON errors with OpenRouter streaming:
1. Try the request again - these are often transient network issues
2. Try a different model from OpenRouter
3. As a fallback, use non-streaming completion instead

## License

MIT 