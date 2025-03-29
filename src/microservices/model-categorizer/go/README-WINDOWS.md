# Model Categorizer Microservice - Windows Usage Guide

This guide explains how to use the PowerShell scripts provided for interacting with the Model Categorizer microservice on Windows.

## Prerequisites

- PowerShell 5.1 or later
- Go 1.22 or later (for running without Docker)
- Docker (optional)

## Available Scripts

The following PowerShell scripts are available:

- `run.ps1`: Runs the Model Categorizer microservice
- `get-models.ps1`: Retrieves categorized models from the service
- `add-model.ps1`: Registers a new model with the service

## Running the Service

1. Open PowerShell and navigate to this directory
2. Run the service using one of the following commands:

```powershell
# Run using native Go
.\run.ps1

# Run using Docker
.\run.ps1 --docker
```

The service will start on port 8080 by default.

## Getting Categorized Models

Once the service is running, you can retrieve the categorized models using:

```powershell
# Get models with default settings
.\get-models.ps1

# Get models with pretty-printed JSON
.\get-models.ps1 -Pretty

# Get experimental models too
.\get-models.ps1 -Experimental

# Get models from a different URL
.\get-models.ps1 -BaseUrl "http://other-server:8080"
```

## Adding New Models

You can register new models with the service using:

```powershell
# Add a basic model
.\add-model.ps1 -Provider "openai" -ModelName "gpt-4-turbo-preview"

# Add a model with full details
.\add-model.ps1 `
  -Provider "anthropic" `
  -ModelName "claude-3-sonnet-next" `
  -Family "Claude 3" `
  -Type "Sonnet" `
  -Version "20240601" `
  -Capabilities "chat,vision,function-calling" `
  -ContextWindow 200000 `
  -ReleaseDate "2024-06" `
  -Experimental
```

## Example Workflow

1. Start the service:
   ```powershell
   .\run.ps1
   ```

2. In a new PowerShell window, add a model:
   ```powershell
   .\add-model.ps1 -Provider "openai" -ModelName "gpt-5" -Family "GPT-5" -Type "Standard" -Experimental
   ```

3. Retrieve the categorized models including experimental ones:
   ```powershell
   .\get-models.ps1 -Experimental -Pretty
   ```

## Troubleshooting

- If you get an execution policy error, you may need to allow script execution:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```

- If the service fails to start, check that port 8080 isn't already in use:
  ```powershell
  Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
  ```

- If you can't connect to the service, make sure it's running and check for any errors in the terminal where you started it. 