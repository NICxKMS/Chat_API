# PowerShell script to run both the model categorizer and test server

# Function to print colored output
function Write-ColoredMessage {
    param (
        [string]$Message,
        [string]$Color = "Cyan"
    )
    Write-Host ">> $Message" -ForegroundColor $Color
}

# Check if Node.js is installed
$nodeInstalled = $null -ne (Get-Command "node" -ErrorAction SilentlyContinue)

# Start the Go microservice in a new terminal window
Write-ColoredMessage "Starting Model Categorizer microservice..."
Start-Process powershell -ArgumentList "-Command", "cd ..; go run main.go"

# Wait a moment for the microservice to start
Start-Sleep -Seconds 2

# Check if we can open the test interface
Write-ColoredMessage "Opening test interface..."

if ($nodeInstalled) {
    # If Node.js is installed, start the test server
    Write-ColoredMessage "Starting test server using Node.js..."
    Write-ColoredMessage "Test interface will be available at http://localhost:3000" -Color "Green"
    Start-Process powershell -ArgumentList "-Command", "node server.js"
    
    # Wait a moment and then open the browser
    Start-Sleep -Seconds 1
    Start-Process "http://localhost:3000"
} else {
    # If Node.js is not installed, just open the HTML file directly
    Write-ColoredMessage "Node.js not found, opening HTML file directly..." -Color "Yellow"
    $htmlPath = (Resolve-Path "index.html").Path
    Start-Process $htmlPath
}

Write-ColoredMessage "Test environment is ready!" -Color "Green"
Write-ColoredMessage "Press Ctrl+C to stop all servers when finished" -Color "Yellow"

# Keep the script running to show status
try {
    while ($true) {
        Start-Sleep -Seconds 10
        Write-ColoredMessage "Test environment is running. Press Ctrl+C to stop." -Color "DarkGray"
    }
} finally {
    # This will execute when the user presses Ctrl+C
    Write-ColoredMessage "Shutting down test environment..." -Color "Red"
} 