# PowerShell script to run the Model Categorizer microservice

# Function to print colored output
function Write-ColoredMessage {
    param (
        [string]$Message
    )
    Write-Host ">> $Message" -ForegroundColor Cyan
}

# Function to check if a command exists
function Test-CommandExists {
    param (
        [string]$Command
    )
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Ensure we're in the right directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Parse arguments
$useDocker = $args -contains "--docker" -or $args -contains "-d"

if ($useDocker) {
    Write-ColoredMessage "Starting Model Categorizer using Docker..."
    
    # Check if Docker is available
    if (-not (Test-CommandExists "docker")) {
        Write-Host "Error: Docker is not installed or not in PATH" -ForegroundColor Red
        exit 1
    }
    
    # Build and run with Docker Compose
    if (Test-CommandExists "docker-compose") {
        Write-ColoredMessage "Using docker-compose..."
        docker-compose up --build
    } else {
        Write-ColoredMessage "Using docker compose..."
        docker compose up --build
    }
} else {
    Write-ColoredMessage "Starting Model Categorizer using native Go..."
    
    # Check if Go is available
    if (-not (Test-CommandExists "go")) {
        Write-Host "Error: Go is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Install Go or use Docker with: .\run.ps1 --docker" -ForegroundColor Red
        exit 1
    }
    
    # Download dependencies
    Write-ColoredMessage "Downloading dependencies..."
    go mod download
    
    # Run the service
    Write-ColoredMessage "Running service on port 8080..."
    go run main.go
} 