#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run the model categorizer microservice.
.DESCRIPTION
    This script provides a convenient way to run the model categorizer microservice
    either directly or in a Docker container.
.PARAMETER Docker
    Run the service in a Docker container.
.PARAMETER Build
    Build the service before running.
.PARAMETER Port
    The port to run the service on. Default is 8080.
#>
param(
    [switch]$Docker,
    [switch]$Build,
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Model Categorizer Microservice"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "=== Model Categorizer Microservice Runner ==="

# If Docker flag is set, run in Docker
if ($Docker) {
    Write-ColorOutput Cyan "Running in Docker mode on port $Port..."
    if ($Build) {
        Write-ColorOutput Yellow "Building Docker image..."
        docker build -t model-categorizer:latest .
    }
    docker run -p ${Port}:8080 -e PORT=8080 --name model-categorizer model-categorizer:latest
}
else {
    # Running locally
    Write-ColorOutput Cyan "Running in local mode on port $Port..."
    if ($Build) {
        Write-ColorOutput Yellow "Building Go binary..."
        go build -o model-categorizer.exe
    }
    $env:PORT = $Port
    # Run the Go binary
    Write-ColorOutput Green "Starting service..."
    ./model-categorizer.exe
}

Write-ColorOutput Green "Service stopped." 