## Testing Endpoints

The test interface provides three tabs to test different functionality:

1. **Health Check** - Tests the `/health` endpoint to verify that the service is running correctly
2. **Models List** - Tests the `/models` endpoint to fetch all categorized models
3. **Dynamic Provider** - Tests the `/dynamic` endpoint to fetch models using your own API keys

### Classification Options

When using the classification endpoints, you can specify additional options:

- **Properties** - An array of properties to classify models by (default: provider, family, type, capabilities)
- **Include Experimental** - Whether to include experimental models
- **Include Deprecated** - Whether to include deprecated models
- **Min Context Size** - Filter models to have at least this context window size
- **Hierarchical** - Controls hierarchical organization (default: true). Returns models organized by provider > type > version. Set to false explicitly to get flat classification.

### Dynamic Provider Testing 