# List Gemini Models
# This script fetches and displays all available Gemini models

# Load API key from .env file if it exists
if (Test-Path -Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match "GOOGLE_API_KEY=(.*)") {
            $apiKey = $matches[1]
        }
    }
}

# Use provided API key or ask for one if not found
if (-not $apiKey) {
    $apiKey = Read-Host "Enter your Gemini API key"
}

Write-Host "Fetching Gemini models..." -ForegroundColor Cyan

# Set the endpoint URL for listing models
$url = "https://generativelanguage.googleapis.com/v1beta/models?key=$apiKey"

try {
    # Send the GET request to the Gemini API
    $response = Invoke-RestMethod -Uri $url -Method Get

    # Extract and display the model names
    $models = $response.models | Select-Object -ExpandProperty name
    
    Write-Host "`nAvailable Gemini Models:" -ForegroundColor Green
    $models | ForEach-Object {
        # Extract just the model name from the full path
        $modelName = $_.Split('/')[-1]
        Write-Host "- $modelName"
    }
    
    Write-Host "`nTotal: $($models.Count) models" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error fetching models: $_" -ForegroundColor Red
    exit 1
} 