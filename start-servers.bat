@echo off
echo Starting Chat API servers...

:: Start the main API server
start cmd /k "echo Starting API server on port 3000 && npm run start"

:: Wait a moment for the API to initialize
timeout /t 3 /nobreak >nul

:: Start the test site server
start cmd /k "echo Starting test site server on port 8080 && cd test-site && npm run start"

echo Servers starting...
echo API server: http://localhost:3000
echo Test site: http://localhost:8080
