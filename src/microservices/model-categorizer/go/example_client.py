#!/usr/bin/env python3
"""
Example Python client for the Model Categorizer microservice.
This script demonstrates how to fetch and process categorized model data from the service.
"""

import argparse
import json
import requests
from typing import Dict, Any, List, Optional


class ModelCategorizerClient:
    """Client for the Model Categorizer microservice"""
    
    def __init__(self, base_url: str = "http://localhost:8080"):
        """Initialize the client with the microservice URL"""
        self.base_url = base_url.rstrip("/")
    
    def get_providers(self) -> List[str]:
        """Get a list of all available providers"""
        response = requests.get(f"{self.base_url}/models")
        response.raise_for_status()
        return response.json()
    
    def get_provider_models(self, provider: str) -> Dict[str, Any]:
        """Get all models for a specific provider"""
        response = requests.get(f"{self.base_url}/models/{provider}")
        response.raise_for_status()
        return response.json()
    
    def get_categorized_models(self, include_experimental: bool = False) -> Dict[str, Any]:
        """Get all models categorized by provider, family, and type"""
        params = {"experimental": "true"} if include_experimental else {}
        response = requests.get(f"{self.base_url}/models/categorized", params=params)
        response.raise_for_status()
        return response.json()
    
    def get_model_capabilities(self, provider: str, model: str) -> Dict[str, Any]:
        """Get capabilities and metadata for a specific model"""
        response = requests.get(f"{self.base_url}/models/{provider}/{model}/capabilities")
        response.raise_for_status()
        return response.json()
    
    def register_model(self, provider: str, model: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new model with the service"""
        payload = {
            "provider": provider,
            "model": model,
            "metadata": metadata
        }
        response = requests.post(
            f"{self.base_url}/models/register",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()


def print_structured_models(data: Dict[str, Any], indent: int = 0) -> None:
    """Print structured model data in a hierarchical format"""
    spaces = " " * indent
    
    for provider, families in data.items():
        print(f"{spaces}Provider: {provider}")
        
        for family, types in families.items():
            print(f"{spaces}  Family: {family}")
            
            for type_name, models in types.items():
                print(f"{spaces}    Type: {type_name}")
                if models.get("latest"):
                    print(f"{spaces}      Latest: {models['latest']}")
                
                if models.get("other_versions"):
                    print(f"{spaces}      Other versions: {', '.join(models['other_versions'])}")


def main() -> None:
    """Main function to run the example client"""
    parser = argparse.ArgumentParser(description="Model Categorizer client example")
    parser.add_argument("--url", default="http://localhost:8080", help="Base URL of the Model Categorizer service")
    parser.add_argument("--experimental", action="store_true", help="Include experimental models")
    parser.add_argument("--format", choices=["pretty", "json"], default="pretty", help="Output format")
    args = parser.parse_args()
    
    client = ModelCategorizerClient(args.url)
    
    try:
        # Get all categorized models
        print("Fetching categorized models...")
        categorized_models = client.get_categorized_models(args.experimental)
        
        # Display the results
        if args.format == "json":
            print(json.dumps(categorized_models, indent=2))
        else:
            print("\nCategorized Models:")
            print_structured_models(categorized_models)
        
        print("\nExample: Accessing a specific model family")
        # Access a specific provider and family if available
        if "OpenAI" in categorized_models and "GPT-4" in categorized_models["OpenAI"]:
            gpt4_models = categorized_models["OpenAI"]["GPT-4"]
            print("GPT-4 model types:")
            for type_name, models in gpt4_models.items():
                print(f"  - {type_name}: {models['latest']}")
        
    except requests.RequestException as e:
        print(f"Error connecting to Model Categorizer service: {e}")
        print("Make sure the service is running at the specified URL.")
    except Exception as e:
        print(f"Unexpected error: {e}")


if __name__ == "__main__":
    main() 