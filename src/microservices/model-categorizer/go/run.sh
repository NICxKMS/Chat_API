#!/bin/bash

# Script to run the Model Categorizer microservice

# Function to print colored output
print_message() {
  echo -e "\033[1;34m>> $1\033[0m"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Ensure the script can be run from any directory
cd "$(dirname "$0")"

# Check if using Docker or native Go
if [ "$1" == "--docker" ] || [ "$1" == "-d" ]; then
  print_message "Starting Model Categorizer using Docker..."
  
  # Check if Docker is available
  if ! command_exists docker; then
    echo "Error: Docker is not installed or not in PATH"
    exit 1
  fi
  
  # Build and run with Docker Compose
  if command_exists docker-compose; then
    print_message "Using docker-compose..."
    docker-compose up --build
  else
    print_message "Using docker compose..."
    docker compose up --build
  fi
  
else
  print_message "Starting Model Categorizer using native Go..."
  
  # Check if Go is available
  if ! command_exists go; then
    echo "Error: Go is not installed or not in PATH"
    echo "Install Go or use Docker with: ./run.sh --docker"
    exit 1
  fi
  
  # Download dependencies
  print_message "Downloading dependencies..."
  go mod download
  
  # Run the service
  print_message "Running service on port 8080..."
  go run main.go
fi 