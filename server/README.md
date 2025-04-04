# Chat API - Model Categorizer

A microservice architecture for categorizing and classifying AI models, with a Go gRPC server and a Node.js client.

## Architecture Overview

This project consists of:

1. **Model Categorization Service (Go)**: A gRPC server that classifies AI models based on various properties
2. **Client Library (Node.js)**: A JavaScript library for communicating with the gRPC server
3. **Example Client**: Demonstration of how to use the client library

## Prerequisites

- Go 1.20+
- Node.js 16+
- npm 7+
- Protocol Buffers Compiler (protoc) 3.15+
- Docker and Docker Compose (optional, for containerized deployment)

## Directory Structure

```
├── docker-compose.yml          # Docker Compose configuration
├── Makefile                    # Build automation
├── README.md                   # This file
└── src/
    ├── examples/               # Example client applications
    │   └── classify-models.js  # Example usage of the client
    ├── generate-grpc.sh        # Script to generate JS gRPC code
    ├── microservices/
    │   └── model-categorizer/
    │       └── go/             # Go service implementation
    │           ├── classifiers/    # Model classification logic
    │           ├── handlers/       # gRPC handlers
    │           ├── models/         # Data models
    │           │   └── proto/      # Protocol buffer definitions
    │           ├── docker-compose.yml
    │           ├── Dockerfile
    │           ├── generate.sh     # Generate Go gRPC code
    │           ├── go.mod
    │           ├── go.sum
    │           └── main.go         # Service entry point
    ├── protos/                 # Protocol buffer definitions
    │   └── models.proto        # Main proto file
    ├── types/                  # TypeScript/JS type definitions
    │   └── proto/              # Generated proto types
    └── utils/                  # Utility functions
        └── protoUtils.js       # gRPC client utilities
```

## Setup Instructions

### 1. Generate Protocol Buffer Code

Generate both JavaScript and Go code from the proto definitions:

```bash
make generate
```

### 2. Build the Applications

Build the Go server and install Node.js dependencies:

```bash
make build
```

### 3. Run the Applications

#### Start the Go Server

```bash
make run-server
```

#### Run the Example Client

In a separate terminal:

```bash
make run-client
```

### Using Docker

To start all services using Docker Compose:

```bash
make docker-up
```

To stop all services:

```bash
make docker-down
```

## Development

### Modifying the Protocol Buffer Definition

1. Edit `src/protos/models.proto`
2. Run `make generate` to regenerate the code
3. Rebuild the applications with `make build`

### API Documentation

The service provides two main RPC methods:

1. **ClassifyModels**: Classify a list of models
   ```
   rpc ClassifyModels(LoadedModelList) returns (ClassifiedModelResponse)
   ```

2. **ClassifyModelsWithCriteria**: Classify with specific criteria
   ```
   rpc ClassifyModelsWithCriteria(ClassificationCriteria) returns (ClassifiedModelResponse)
   ```

## Contributing

1. Ensure all tests pass before submitting changes
2. Update documentation for any changes to the API
3. Follow the project's coding style and conventions

## License

MIT 

## Node.js API Server Endpoints

This section details the endpoints provided by the Node.js API server component (located in `src/`).

### Model Endpoints (`/api/models`)

*   **`GET /`**: Get all available models grouped by provider, along with default provider/model.
*   **`GET /list`**: Alias for `GET /`.
*   **`GET /categories`**: Get models structured for UI display, potentially using the classification service or a fallback.
*   **`GET /categorized`**: Alias for `GET /categories`.
*   **`GET /providers`**: Get a list of configured providers and their capabilities (models, features).
*   **`GET /capabilities/all`**: Alias for `GET /providers`.
*   **`GET /classified`**: Get models classified by the external gRPC classification service. Requires the service to be running and enabled via `USE_CLASSIFICATION_SERVICE=true`.
*   **`GET /classified/criteria?{key}={value}`**: Get models matching specific classification criteria from the gRPC service (e.g., `/classified/criteria?category=code&size=small`).
*   **`GET /{providerName}`**: Get models available specifically for the named provider (e.g., `/api/models/openai`).

### Chat Endpoints (`/api/chat`)

*   **`POST /completions`**: Send a standard, non-streaming chat completion request. 
    *   **Body:** `{ "model": "provider/model_name", "messages": [...], "temperature": 0.7, "max_tokens": 1000, ... }`
    *   **Response:** Standard JSON response with the completion.

*   **`POST /stream`**: Send a streaming chat completion request.
    *   **Body:** `{ "model": "provider/model_name", "messages": [...], "temperature": 0.7, "max_tokens": 1000, ... }`
    *   **Response:** `text/event-stream` (Server-Sent Events). Each event is formatted as:
        ```
        data: JSON.stringify(chunk)
        
        ```
        Where `chunk` is a JSON object containing the incremental response piece (content delta, usage, finish reason, etc.) in the standardized API format.
        The stream may also include heartbeat comments (`:heartbeat\n\n`) to keep the connection alive.
        The stream ends when the connection is closed by the server.

*   **`GET /capabilities`**: Get combined capabilities of chat providers, cache status, circuit breaker states, and basic system status.

### Monitoring Endpoints

*   **`GET /health`**: Basic health check endpoint returning status, uptime, memory usage, etc.
*   **`GET /metrics`**: Exposes Prometheus metrics for scraping.

## Authentication (Firebase)

This API uses Firebase Authentication. Clients (e.g., frontend applications) should use a Firebase client SDK (Web, iOS, Android) to handle user sign-up, sign-in, and token management.

1.  **Firebase Setup:**
    *   Ensure you have a Firebase project set up.
    *   Enable Authentication in the Firebase console and configure desired sign-in providers (Email/Password, Google, etc.).
    *   Generate a Service Account key JSON file from your Firebase project settings (Settings > Service accounts > Generate new private key).
    *   **Securely** store this key file (e.g., in the project root) and **add it to your `.gitignore`**.
    *   Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable in your `.env` file to the path of this key file (e.g., `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json`).

2.  **Client-Side:**
    *   Your frontend application should handle the user login flow using a Firebase client SDK.
    *   After successful login, the client SDK provides a Firebase ID Token (a JWT).

3.  **API Requests:**
    *   Include the Firebase ID Token obtained from the client SDK in the `Authorization` header for all requests to protected API endpoints (e.g., `/api/chat/*`, `/api/models/*`) using the Bearer scheme:
        ```
        Authorization: Bearer <firebase_id_token>
        ```

Requests without a valid Firebase ID token to protected routes will receive a 401 Unauthorized error.

## Getting Started

// ... getting started section ...

## Configuration

// ... configuration section ...

## Running the Application

// ... running section ... 