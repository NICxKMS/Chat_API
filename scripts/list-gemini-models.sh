#!/bin/bash
# List Gemini Models
# This script fetches and displays all available Gemini models

# Load API key from .env file if it exists
if [ -f .env ]; then
  GOOGLE_API_KEY=$(grep GOOGLE_API_KEY .env | cut -d '=' -f2)
fi

# Use provided API key or ask for one if not found
if [ -z "$GOOGLE_API_KEY" ]; then
  echo "Enter your Gemini API key:"
  read GOOGLE_API_KEY
fi

echo "Fetching Gemini models..."

# Set the endpoint URL for listing models
URL="https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY"

# Send the GET request to the Gemini API and extract model names
RESPONSE=$(curl -s "$URL")

# Check if the request was successful
if [[ $RESPONSE == *"error"* ]]; then
  echo "Error fetching models: $RESPONSE"
  exit 1
fi

# Use jq to extract model names if available, otherwise use grep and sed
if command -v jq &> /dev/null; then
  echo -e "\nAvailable Gemini Models:"
  jq -r '.models[].name' <<< "$RESPONSE" | while read -r MODEL; do
    MODEL_NAME=$(echo "$MODEL" | awk -F'/' '{print $NF}')
    echo "- $MODEL_NAME"
  done
  
  MODEL_COUNT=$(jq '.models | length' <<< "$RESPONSE")
  echo -e "\nTotal: $MODEL_COUNT models"
else
  echo -e "\nAvailable Gemini Models:"
  MODELS=$(echo "$RESPONSE" | grep -o '"name": "[^"]*"' | sed 's/"name": "//g' | sed 's/"//g')
  
  while IFS= read -r MODEL; do
    MODEL_NAME=$(echo "$MODEL" | awk -F'/' '{print $NF}')
    echo "- $MODEL_NAME"
  done <<< "$MODELS"
  
  MODEL_COUNT=$(echo "$MODELS" | wc -l)
  echo -e "\nTotal: $MODEL_COUNT models"
fi