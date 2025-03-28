# Centralized Chat API

A unified API service that provides a consistent interface for interacting with multiple AI chat providers including OpenAI, Anthropic, Google Gemini, and OpenRouter.

## Features

- **Multi-Provider Support**: Seamlessly interact with OpenAI, Anthropic, Google Gemini, and OpenRouter APIs through a unified interface
- **Consistent Request/Response Format**: Standardized format across all providers
- **Provider-Specific Capabilities**: Access provider-specific features while maintaining a consistent API surface
- **Dynamic Model Loading**: Automatically discover available models from supported providers
- **Streaming Support**: Stream responses for real-time interactions with reliable token delivery
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

### Streaming Implementation

The streaming implementation for each provider has been carefully designed to ensure reliable token delivery:

- **Robust Error Handling**: Graceful handling of stream interruptions and API errors
- **Complete Token Delivery**: Carefully structured to prevent token dropping
- **First Token Delivery**: Special handling for first tokens to ensure they're never dropped
- **Consistent Response Format**: Normalized streaming chunks across all providers

#### Gemini-Specific Streaming Implementation
The Gemini provider uses a reliable proxy streaming approach that completely eliminates token dropping issues:

- Uses a two-phase streaming technique:
  1. First retrieves the complete response from Gemini in non-streaming mode
  2. Then delivers tokens progressively with controlled chunking
- Guarantees 100% reliable token delivery with no dropped content
- Preserves the streaming experience while ensuring message integrity
- Simulates natural token delivery with random small chunk sizes
- Completely eliminates common issues like:
  - First token truncation
  - Mid-word token splitting
  - Special character handling problems
  - Missing words or partial content

The implementation bypasses the limitations of Gemini's native streaming mechanism to provide a more reliable experience. This approach prioritizes content integrity over raw streaming speed but maintains a responsive user experience.

You can verify the token delivery reliability with:
```bash
node scripts/verify-token-fix.js
```

#### Streaming Debugging Tools

Several debugging scripts are available for testing and diagnosing streaming issues:

- `node scripts/test-streaming.js [provider_name]`: Tests all providers with basic streaming diagnostics
- `node scripts/test-gemini-streaming.js`: Tests Gemini streaming with enhanced diagnostics, including raw output
- `node scripts/debug-streaming.js [provider] [model] "prompt"`: Debugs any provider with detailed token-by-token analysis
- `node scripts/compare-streaming.js "prompt"`: Compares streaming performance across all providers
- `node scripts/verify-token-fix.js`: Verifies Gemini token delivery with specific test cases
- `node scripts/compare-gemini-streaming.js`: Compares Gemini's proxy streaming approach with other providers

These tools provide detailed diagnostics such as:

- Raw token content visualization
- Hex representation of tokens to detect whitespace/invisible characters
- Token timing analysis (first token, intervals between tokens)
- Character-by-character breakdown for debugging
- Performance comparison between providers
- Content integrity verification tests
- Side-by-side comparison of different streaming approaches

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