# Model Categorizer Microservice Design

## Overview

The Model Categorizer is a dedicated microservice responsible for organizing and categorizing AI models from various providers. It provides a centralized, consistent way to organize models for display in UI components and for model selection logic.

## Why a Microservice?

1. **Separation of Concerns**: Model categorization is a complex task that should be decoupled from the main application.
2. **Independent Updates**: AI models are frequently updated. A separate service allows for quick updates without redeploying the entire application.
3. **Performance**: Categorization can be resource-intensive. A dedicated service allows for caching and optimization.
4. **Reusability**: Multiple applications can use the same categorization service.
5. **Technology Freedom**: Using Go or another high-performance language for this specific task.

## Architecture

### Service Components

1. **Model Registry**: Database of known models with their metadata
2. **Categorization Engine**: Logic for organizing models into hierarchies
3. **Provider Connectors**: Adapters to fetch model information from providers
4. **API Layer**: REST/GraphQL interface for client applications
5. **Cache Layer**: For performance optimization

### API Endpoints

```
GET /models                       # Get all models across providers
GET /models/{provider}            # Get models for a specific provider
GET /models/categorized           # Get all models in categorized format
GET /models/{provider}/categorized # Get categorized models for a provider
GET /models/capabilities          # Get capabilities across all models
POST /models/register             # Register a new model
```

### Data Model

```go
// Go implementation of the model registry

type ModelMetadata struct {
    Family       string   `json:"family"`
    Type         string   `json:"type"`
    Capabilities []string `json:"capabilities"`
    ContextSize  int      `json:"contextSize,omitempty"`
    ReleaseDate  string   `json:"releaseDate,omitempty"`
    Experimental bool     `json:"isExperimental,omitempty"`
    Generation   float64  `json:"generation,omitempty"`
    Version      string   `json:"version,omitempty"`
}

type ModelRegistry map[string]map[string]ModelMetadata

type ProviderModels struct {
    Models       []string `json:"models"`
    DefaultModel string   `json:"defaultModel,omitempty"`
    Error        string   `json:"error,omitempty"`
}

type ModelsByProvider map[string]ProviderModels

type ModelTypeData struct {
    Latest        string   `json:"latest"`
    OtherVersions []string `json:"other_versions"`
}

type ModelsByType map[string]ModelTypeData

type StructuredModels map[string]map[string]ModelsByType
```

## Implementation Technologies

### Option 1: Go Implementation

**Advantages**:
- High performance
- Low memory footprint
- Strong concurrency support
- Simple deployment as a single binary

**Sample Go Implementation**:

```go
package main

import (
    "encoding/json"
    "log"
    "net/http"
    "strings"
    "github.com/gorilla/mux"
)

// ModelRegistry holds all our model data
var modelRegistry ModelRegistry

func init() {
    // Initialize the registry with known models
    modelRegistry = make(ModelRegistry)
    // Add OpenAI models
    modelRegistry["openai"] = map[string]ModelMetadata{
        "gpt-4o": {
            Family:       "GPT-4",
            Type:         "GPT-4o",
            Capabilities: []string{"vision", "function-calling"},
            ContextSize:  128000,
            ReleaseDate:  "2024-05",
            Generation:   4,
        },
        // ... more models
    }
    // ... more providers
}

// CategorizedModelsHandler returns models in categorized format
func CategorizedModelsHandler(w http.ResponseWriter, r *http.Request) {
    // Get provider parameter (optional)
    provider := r.URL.Query().Get("provider")
    
    // Build model data
    modelsByProvider := make(ModelsByProvider)
    
    // Filter by provider if specified
    if provider != "" {
        if registry, exists := modelRegistry[strings.ToLower(provider)]; exists {
            models := []string{}
            for model := range registry {
                models = append(models, model)
            }
            modelsByProvider[provider] = ProviderModels{
                Models: models,
            }
        }
    } else {
        // Include all providers
        for providerName, registry := range modelRegistry {
            models := []string{}
            for model := range registry {
                models = append(models, model)
            }
            modelsByProvider[providerName] = ProviderModels{
                Models: models,
            }
        }
    }
    
    // Categorize models
    result := categorizeModels(modelsByProvider, false)
    
    // Return JSON response
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func main() {
    r := mux.NewRouter()
    
    // API Routes
    r.HandleFunc("/models/categorized", CategorizedModelsHandler).Methods("GET")
    // ... more routes
    
    // Start server
    log.Println("Starting model categorizer service on :8080")
    http.ListenAndServe(":8080", r)
}
```

### Option 2: Rust Implementation

**Advantages**:
- Memory safety without garbage collection
- Extremely high performance
- Strong type system
- Growing ecosystem for web services

### Option 3: Node.js with TypeScript

**Advantages**:
- Reuse existing TypeScript code
- Familiar to JavaScript/TypeScript developers
- Wide ecosystem
- Easy deployment to serverless environments

## Deployment Options

1. **Containerized Service**: 
   - Docker container with the microservice
   - Kubernetes deployment for scaling
   - Environment variables for configuration

2. **Serverless Function**:
   - AWS Lambda
   - Google Cloud Functions
   - Azure Functions

3. **Edge Computing**:
   - Cloudflare Workers
   - Vercel Edge Functions
   - Faster global response times

## Integration with Main Application

### REST API Integration

```typescript
// Main application (TypeScript)
async function fetchCategorizedModels() {
  try {
    const response = await fetch('http://model-categorizer-service/models/categorized');
    const categorizedModels = await response.json();
    return categorizedModels;
  } catch (error) {
    console.error('Error fetching categorized models:', error);
    // Fall back to local categorization
    return localCategorizeModels(providers);
  }
}
```

### Message Queue Integration

```typescript
// Using a message queue for asynchronous updates
async function registerNewModel(provider, model, metadata) {
  // Publish message to model registry queue
  await mqClient.publish('model-registry', {
    action: 'register',
    provider,
    model,
    metadata
  });
}
```

## Caching Strategy

1. **In-Memory Cache**:
   - Fast responses for frequent requests
   - TTL-based invalidation

2. **Redis Cache**:
   - Distributed caching for multiple instances
   - Cache invalidation across instances

3. **CDN Caching**:
   - Edge caching for global performance
   - Cache control headers

## Implementation Plan

### Phase 1: Extract Current Logic
- Move the existing TypeScript code to a separate module
- Create REST API endpoints
- Add basic caching

### Phase 2: Enhance Features
- Implement provider connectors
- Add automated model discovery
- Implement advanced caching

### Phase 3: Migration to High-Performance Implementation
- Rewrite in Go or Rust
- Implement advanced caching strategies
- Add monitoring and observability
- Deploy as standalone service

## Conclusion

Extracting the model categorizer as a microservice will improve maintainability, performance, and scalability. It will allow the model categorization logic to evolve independently of the main application and provide a consistent interface for model organization across multiple clients. 