@echo off
echo Starting Model Categorizer test environment...

echo Starting the Go microservice...
start cmd /k "cd .. && go run main.go"

echo Waiting for the microservice to start...
timeout /t 2 > nul

where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Starting test server using Node.js...
    echo Test interface will be available at http://localhost:3000
    start cmd /k "node server.js"
    
    echo Opening browser...
    timeout /t 1 > nul
    start http://localhost:3000
) else (
    echo Node.js not found, opening HTML file directly...
    start index.html
)

echo.
echo Test environment is ready!
echo Press Ctrl+C to stop all servers when finished
echo.

echo Keeping this window open for reference. Close it when done.
pause 