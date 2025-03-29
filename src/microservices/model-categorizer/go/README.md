# Model Categorizer Microservice

This is a Go-based microservice for categorizing AI models from various providers.

## Features

- Categorizes models by family and type
- Caches categorized results for improved performance
- RESTful API endpoints for model data retrieval
- Support for multiple AI providers (OpenAI, Anthropic, Gemini, etc.)

## Setup

### Prerequisites

- Go 1.22 or higher
- Docker (optional)

### Local Development

1. Install dependencies:

```bash
go mod download
```

2. Run the service:

```bash
go run main.go
```

The service will be available at http://localhost:8080.

### Docker Deployment

1. Build the Docker image:

```bash
docker build -t model-categorizer-service .
```

2. Run the container:

```bash
docker run -p 8080:8080 model-categorizer-service
```

## API Endpoints

### GET /health
Returns the health status of the service.

### GET /providers
Returns a list of all available providers.

### GET /providers/{provider}/models
Returns all models for a specific provider, categorized by family and type.

### POST /registry
Registers new models to the service.

Request body:
```json
{
  "models": [
    {
      "id": "gpt-4",
      "provider": "openai",
      "version": "1.0.0",
      "capabilities": ["chat", "function-calling"],
      "contextWindow": 8192
    }
  ]
}
```

## Model Categorization Logic

Models are categorized based on:

1. Explicit metadata when available
2. Pattern matching on model names
3. Versioning information (when comparing models within the same family)

The service maintains an in-memory cache of categorized models to improve performance. 