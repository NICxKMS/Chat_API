# Centralized Chat API

A unified API service that provides a consistent interface for interacting with multiple AI chat providers including OpenAI, Anthropic, Google Gemini, and OpenRouter.

## Features

- **Multi-Provider Support**: Seamlessly interact with OpenAI, Anthropic, Google Gemini, and OpenRouter APIs through a unified interface
- **Consistent Request/Response Format**: Standardized format across all providers
- **Provider-Specific Capabilities**: Access provider-specific features while maintaining a consistent API surface
- **Dynamic Model Loading**: Automatically discover available models from supported providers
- **Streaming Support**: Stream responses for real-time interactions
- **Resilient Design**: Circuit breakers and fallbacks for improved reliability
- **Performance Monitoring**: Built-in metrics for monitoring API usage and performance

## Supported Providers

The API currently supports the following providers:

- **OpenAI**: Access to GPT models including gpt-4o, gpt-4-turbo, and gpt-3.5-turbo
- **Anthropic**: Access to Claude models including Claude 3 Opus, Sonnet, and Haiku
- **Google Gemini**: Access to Gemini 1.5 Pro, Gemini 1.5 Flash, and Gemini 1.0 Pro
- **OpenRouter**: Gateway to multiple LLM providers through a single interface

## Getting Started

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your API keys for the providers you want to use
3. Install dependencies: `npm install`
4. Start the server: `npm start`

## API Endpoints

### Chat Completions

```
POST /chat/completions
```

Request body:
```json
{
  "model": "openai/gpt-4o",  // Format: "provider/model"
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

### Streaming Chat Completions

```
POST /chat/completions/stream
```

Request body is the same as for non-streaming completions.

### List Available Models

```
GET /models
```

Returns a list of all available models across all configured providers.

## Configuration

The system is configured through environment variables. See `.env.example` for available options. Key configuration options:

- `DEFAULT_PROVIDER`: The default provider to use when none is specified
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`: API keys for each provider
- `DYNAMIC_MODEL_LOADING`: Whether to dynamically load models from provider APIs (true/false)

## Implementation Details

### Provider Architecture

The system uses a provider-based architecture with the following components:

- **BaseProvider**: Abstract base class that defines the interface all providers must implement
- **Provider Implementations**: Concrete implementations for each supported provider
- **ProviderFactory**: Factory pattern implementation for instantiating and managing providers

### Dynamic Model Loading

For each provider, models can be loaded in two ways:

1. **Static Configuration**: Models defined in the configuration
2. **Dynamic Discovery**: Models fetched from the provider's API (when supported and enabled)

#### Gemini Model Loading

The Gemini provider supports dynamic model loading via the Google Generative Language API v1beta endpoint. When enabled, it will fetch the most up-to-date list of available models. 

You can also use the provided scripts to list available Gemini models:
- PowerShell: `scripts/list-gemini-models.ps1`
- Bash: `scripts/list-gemini-models.sh`

### Adding New Providers

To add a new provider:

1. Create a new provider class that extends `BaseProvider`
2. Implement required methods: `getModels()`, `chatCompletion()`, and `streamChatCompletion()`
3. Add the provider to the `ProviderFactory`
4. Update the configuration in `config.js`

## Test Site

A simple test site is included in the `test-site` directory for demonstrating the API functionality.

## License

MIT 