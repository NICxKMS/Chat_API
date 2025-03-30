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