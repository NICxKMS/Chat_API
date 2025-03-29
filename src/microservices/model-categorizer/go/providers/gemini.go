package providers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/your-org/model-categorizer/config"
)

// GeminiProvider handles interactions with the Google Gemini API
type GeminiProvider struct {
	APIKey     string
	APIVersion string
}

// GeminiModelsResponse represents the response from Gemini's models endpoint
type GeminiModelsResponse struct {
	Models []GeminiModel `json:"models"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

// GeminiModel represents a Gemini model
type GeminiModel struct {
	Name            string   `json:"name"`
	Version         string   `json:"version,omitempty"`
	DisplayName     string   `json:"displayName,omitempty"`
	Description     string   `json:"description,omitempty"`
	InputTokenLimit int      `json:"inputTokenLimit,omitempty"`
	OutputTokenLimit int     `json:"outputTokenLimit,omitempty"`
	SupportedGenerationMethods []string `json:"supportedGenerationMethods,omitempty"`
}

// NewGeminiProvider creates a new Gemini provider with the given configuration
func NewGeminiProvider(cfg *config.Configuration) *GeminiProvider {
	return &GeminiProvider{
		APIKey:     cfg.Gemini.APIKey,
		APIVersion: cfg.Gemini.APIVersion,
	}
}

// GetAvailableModels fetches all available models from Gemini
func (p *GeminiProvider) GetAvailableModels() ([]string, error) {
	if p.APIKey == "" {
		return []string{}, fmt.Errorf("Gemini API key not configured")
	}

	// Standard Gemini models
	standardModels := []string{
		"gemini-1.5-pro",
		"gemini-1.5-flash",
		"gemini-1.0-pro",
		"gemini-1.0-pro-vision",
	}

	// If API version and key are provided, try to fetch from API
	if p.APIVersion != "" && p.APIKey != "" {
		client := &http.Client{
			Timeout: time.Second * 10,
		}

		url := fmt.Sprintf("https://generativelanguage.googleapis.com/%s/models?key=%s", 
			p.APIVersion, p.APIKey)

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return standardModels, nil // Fall back to standard models
		}

		req.Header.Add("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return standardModels, nil // Fall back to standard models
		}
		defer resp.Body.Close()

		// If API returns success, parse the response
		if resp.StatusCode == http.StatusOK {
			var modelsResp GeminiModelsResponse
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				return standardModels, nil
			}

			if err := json.Unmarshal(body, &modelsResp); err != nil {
				return standardModels, nil
			}

			// Return API models if available
			if len(modelsResp.Models) > 0 {
				var models []string
				for _, model := range modelsResp.Models {
					// Extract model ID from name (last part of path)
					modelParts := make([]string, 0)
					for i := len(model.Name) - 1; i >= 0; i-- {
						if model.Name[i] == '/' {
							modelParts = append(modelParts, model.Name[i+1:])
							break
						}
						if i == 0 {
							modelParts = append(modelParts, model.Name)
						}
					}
					
					if len(modelParts) > 0 {
						models = append(models, modelParts[0])
					}
				}
				
				// If we extracted model IDs, return them
				if len(models) > 0 {
					return models, nil
				}
			}
		}
	}

	// Fall back to standard models
	return standardModels, nil
}

// GetModelInfo gets detailed information about a specific model
func (p *GeminiProvider) GetModelInfo(modelID string) (map[string]interface{}, error) {
	// Define standard model info for well-known models
	standardInfo := map[string]map[string]interface{}{
		"gemini-1.5-pro": {
			"family":         "Gemini 1.5",
			"type":           "Pro",
			"context_window": 1000000,
			"capabilities":   []string{"vision", "function-calling"},
			"version":        "1.5",
		},
		"gemini-1.5-flash": {
			"family":         "Gemini 1.5",
			"type":           "Flash",
			"context_window": 1000000,
			"capabilities":   []string{"vision", "function-calling"},
			"version":        "1.5",
		},
		"gemini-1.0-pro": {
			"family":         "Gemini 1.0",
			"type":           "Pro",
			"context_window": 32768,
			"capabilities":   []string{"function-calling"},
			"version":        "1.0",
		},
		"gemini-1.0-pro-vision": {
			"family":         "Gemini 1.0",
			"type":           "Pro Vision",
			"context_window": 32768,
			"capabilities":   []string{"vision"},
			"version":        "1.0",
		},
	}

	// Return standard info if available
	if info, exists := standardInfo[modelID]; exists {
		return info, nil
	}

	// For unknown models, return basic info
	return map[string]interface{}{
		"family":       "Gemini",
		"type":         "Unknown",
		"capabilities": []string{},
	}, nil
} 