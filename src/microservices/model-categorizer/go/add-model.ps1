# PowerShell script to add a new model to the Model Categorizer microservice

# Parse arguments
param (
    [Parameter(Mandatory=$true)]
    [string]$Provider,
    
    [Parameter(Mandatory=$true)]
    [string]$ModelName,
    
    [string]$Family,
    
    [string]$Type,
    
    [string]$Version = "1.0.0",
    
    [string]$Capabilities = "chat",
    
    [int]$ContextWindow = 16000,
    
    [string]$ReleaseDate,
    
    [switch]$Experimental,
    
    [string]$BaseUrl = "http://localhost:8080"
)

# Function to print colored output
function Write-ColoredMessage {
    param (
        [string]$Message
    )
    Write-Host ">> $Message" -ForegroundColor Cyan
}

Write-ColoredMessage "Preparing to register model '$ModelName' for provider '$Provider'..."

# Build the capabilities array
$capabilitiesArray = $Capabilities -split "," | ForEach-Object { $_.Trim() }

# Create the payload
$payload = @{
    provider = $Provider
    model = $ModelName
    metadata = @{
        family = $Family
        type = $Type
        version = $Version
        capabilities = $capabilitiesArray
        contextWindow = $ContextWindow
        isExperimental = [bool]$Experimental
    }
}

# Add optional fields if provided
if ($ReleaseDate) {
    $payload.metadata.releaseDate = $ReleaseDate
}

# Convert to JSON
$jsonPayload = $payload | ConvertTo-Json -Depth 10

Write-ColoredMessage "Sending registration request to $BaseUrl/models/register..."

try {
    # Make the HTTP request
    $response = Invoke-RestMethod -Uri "$BaseUrl/models/register" -Method Post -Body $jsonPayload -ContentType "application/json"
    
    # Output the response
    Write-Host "Success: " -ForegroundColor Green -NoNewline
    Write-Host $response.message
    
    # Show the added model details
    Write-ColoredMessage "Model details:"
    Write-Host "Provider: $Provider"
    Write-Host "Model: $ModelName"
    Write-Host "Family: $Family"
    Write-Host "Type: $Type"
    Write-Host "Version: $Version"
    Write-Host "Context Window: $ContextWindow tokens"
    Write-Host "Capabilities: $Capabilities"
    if ($Experimental) {
        Write-Host "Experimental: Yes" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: Failed to register the model." -ForegroundColor Red
    Write-Host "Details: $_" -ForegroundColor Red
    Write-Host "Make sure the service is running at $BaseUrl" -ForegroundColor Red
    exit 1
} 