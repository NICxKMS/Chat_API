package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	// URL of the model categorizer microservice
	baseURL := "http://localhost:8080"
	if len(os.Args) > 1 {
		baseURL = os.Args[1]
	}

	// Get categorized models
	resp, err := http.Get(baseURL + "/models/categorized")
	if err != nil {
		fmt.Printf("Error making request: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		os.Exit(1)
	}

	// Pretty-print the JSON response
	var data interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		fmt.Printf("Error parsing JSON: %v\n", err)
		fmt.Println(string(body))
		os.Exit(1)
	}

	prettyJSON, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		fmt.Printf("Error formatting JSON: %v\n", err)
		fmt.Println(string(body))
		os.Exit(1)
	}

	fmt.Println(string(prettyJSON))
}
