package providers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/your-org/model-categorizer/config"
)

// AnthropicProvider handles interactions with the Anthropic API
type AnthropicProvider struct {
	APIKey  string
	BaseURL string
}

// AnthropicModelsResponse represents the response from Anthropic's models endpoint
type AnthropicModelsResponse struct {
	Models []AnthropicModel `json:"models"`
	Error  *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// AnthropicModel represents an Anthropic model
type AnthropicModel struct {
	Name                string   `json:"name"`
	MaxTokens           int      `json:"max_tokens,omitempty"`
	Description         string   `json:"description,omitempty"`
	ContextWindow       int      `json:"context_window,omitempty"`
	Capabilities        []string `json:"capabilities,omitempty"`
	InputCostPerToken   float64  `json:"input_cost_per_token,omitempty"`
	OutputCostPerToken  float64  `json:"output_cost_per_token,omitempty"`
}

// NewAnthropicProvider creates a new Anthropic provider with the given configuration
func NewAnthropicProvider(cfg *config.Configuration) *AnthropicProvider {
	return &AnthropicProvider{
		APIKey:  cfg.Anthropic.APIKey,
		BaseURL: cfg.Anthropic.BaseURL,
	}
}

// GetAvailableModels fetches all available models from Anthropic
func (p *AnthropicProvider) GetAvailableModels() ([]string, error) {
	if p.APIKey == "" {
		return []string{}, fmt.Errorf("Anthropic API key not configured")
	}

	// Standard Anthropic models until API for model list is available
	standardModels := []string{
		"claude-3-opus-20240229",
		"claude-3-sonnet-20240229",
		"claude-3-haiku-20240307",
		"claude-2.1",
		"claude-2.0",
		"claude-instant-1.2",
	}

	// If we have an API key, try to request more models (for future API support)
	client := &http.Client{
		Timeout: time.Second * 10,
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/v1/models", p.BaseURL), nil)
	if err != nil {
		return standardModels, nil // Fall back to standard models
	}

	req.Header.Add("x-api-key", p.APIKey)
	req.Header.Add("anthropic-version", "2023-06-01")
	req.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return standardModels, nil // Fall back to standard models
	}
	defer resp.Body.Close()

	// If API returns success, parse the response
	if resp.StatusCode == http.StatusOK {
		var modelsResp AnthropicModelsResponse
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
				models = append(models, model.Name)
			}
			return models, nil
		}
	}

	// Fall back to standard models
	return standardModels, nil
}

// GetModelInfo gets detailed information about a specific model
func (p *AnthropicProvider) GetModelInfo(modelID string) (map[string]interface{}, error) {
	// Define standard model info for well-known models
	standardInfo := map[string]map[string]interface{}{
		"claude-3-opus-20240229": {
			"family":         "Claude 3",
			"type":           "Opus",
			"context_window": 200000,
			"capabilities":   []string{"vision", "function-calling"},
			"version":        "20240229",
		},
		"claude-3-sonnet-20240229": {
			"family":         "Claude 3",
			"type":           "Sonnet",
			"context_window": 200000,
			"capabilities":   []string{"vision", "function-calling"},
			"version":        "20240229",
		},
		"claude-3-haiku-20240307": {
			"family":         "Claude 3",
			"type":           "Haiku",
			"context_window": 200000,
			"capabilities":   []string{"vision", "function-calling"},
			"version":        "20240307",
		},
		"claude-2.1": {
			"family":         "Claude 2",
			"type":           "Standard",
			"context_window": 100000,
			"capabilities":   []string{"function-calling"},
			"version":        "2.1",
		},
		"claude-2.0": {
			"family":         "Claude 2",
			"type":           "Standard",
			"context_window": 100000,
			"capabilities":   []string{},
			"version":        "2.0",
		},
		"claude-instant-1.2": {
			"family":         "Claude 1",
			"type":           "Instant",
			"context_window": 100000,
			"capabilities":   []string{},
			"version":        "1.2",
		},
	}

	// Return standard info if available
	if info, exists := standardInfo[modelID]; exists {
		return info, nil
	}

	// For unknown models, return basic info
	return map[string]interface{}{
		"family":       "Claude",
		"type":         "Unknown",
		"capabilities": []string{},
	}, nil
} 