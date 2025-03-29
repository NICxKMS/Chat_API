# PowerShell script to get categorized models from the Model Categorizer microservice

# Parse arguments
param (
    [string]$BaseUrl = "http://localhost:8080",
    [switch]$Experimental,
    [switch]$Pretty
)

# Function to print colored output
function Write-ColoredMessage {
    param (
        [string]$Message
    )
    Write-Host ">> $Message" -ForegroundColor Cyan
}

Write-ColoredMessage "Fetching categorized models from $BaseUrl..."

# Build the URL with optional experimental flag
$url = "$BaseUrl/models/categorized"
if ($Experimental) {
    $url += "?experimental=true"
}

try {
    # Make the HTTP request
    $response = Invoke-RestMethod -Uri $url -Method Get -ContentType "application/json"
    
    # Format and output the JSON
    if ($Pretty) {
        # Pretty print the JSON
        $jsonOutput = $response | ConvertTo-Json -Depth 10
        Write-Output $jsonOutput
    } else {
        # Output the JSON as a compact string
        $jsonOutput = $response | ConvertTo-Json -Depth 10 -Compress
        Write-Output $jsonOutput
    }
    
    # Optional: Save to file
    if ($PSBoundParameters.ContainsKey('OutFile')) {
        $jsonOutput | Out-File -FilePath $OutFile
        Write-ColoredMessage "Saved output to $OutFile"
    }
    
    Write-ColoredMessage "Successfully retrieved categorized models."
} catch {
    Write-Host "Error: Failed to connect to the Model Categorizer service." -ForegroundColor Red
    Write-Host "Details: $_" -ForegroundColor Red
    Write-Host "Make sure the service is running at $BaseUrl" -ForegroundColor Red
    exit 1
} 