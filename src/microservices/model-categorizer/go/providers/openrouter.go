package providers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/your-org/model-categorizer/config"
)

// OpenRouterProvider handles interactions with the OpenRouter API
type OpenRouterProvider struct {
	APIKey   string
	BaseURL  string
	Referer  string
	AppTitle string
}

// OpenRouterModelsResponse represents the response from OpenRouter's models endpoint
type OpenRouterModelsResponse struct {
	Data  []OpenRouterModel `json:"data"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// OpenRouterModel represents an OpenRouter model
type OpenRouterModel struct {
	ID              string  `json:"id"`
	Name            string  `json:"name,omitempty"`
	Description     string  `json:"description,omitempty"`
	Context         int     `json:"context_length,omitempty"`
	ProviderName    string  `json:"provider,omitempty"`
	PricePrompt     float64 `json:"pricing.prompt,omitempty"`
	PriceCompletion float64 `json:"pricing.completion,omitempty"`
}

// NewOpenRouterProvider creates a new OpenRouter provider with the given configuration
func NewOpenRouterProvider(cfg *config.Configuration) *OpenRouterProvider {
	return &OpenRouterProvider{
		APIKey:   cfg.OpenRouter.APIKey,
		BaseURL:  cfg.OpenRouter.BaseURL,
		Referer:  cfg.OpenRouter.Referer,
		AppTitle: cfg.OpenRouter.AppTitle,
	}
}

// GetAvailableModels fetches all available models from OpenRouter
func (p *OpenRouterProvider) GetAvailableModels() ([]string, error) {
	if p.APIKey == "" {
		return []string{}, fmt.Errorf("OpenRouter API key not configured")
	}

	client := &http.Client{
		Timeout: time.Second * 10,
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/models", p.BaseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", p.APIKey))
	req.Header.Add("HTTP-Referer", p.Referer)
	if p.AppTitle != "" {
		req.Header.Add("X-Title", p.AppTitle)
	}
	req.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error making request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var modelsResp OpenRouterModelsResponse
	if err := json.Unmarshal(body, &modelsResp); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	// Check for API errors
	if modelsResp.Error != nil {
		return nil, fmt.Errorf("API error: %s", modelsResp.Error.Message)
	}

	// Extract model IDs
	var models []string
	for _, model := range modelsResp.Data {
		models = append(models, model.ID)
	}

	return models, nil
}

// GetModelInfo gets detailed information about a specific model
func (p *OpenRouterProvider) GetModelInfo(modelID string) (map[string]interface{}, error) {
	if p.APIKey == "" {
		return nil, fmt.Errorf("OpenRouter API key not configured")
	}

	client := &http.Client{
		Timeout: time.Second * 10,
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/models", p.BaseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", p.APIKey))
	req.Header.Add("HTTP-Referer", p.Referer)
	if p.AppTitle != "" {
		req.Header.Add("X-Title", p.AppTitle)
	}
	req.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error making request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var modelsResp OpenRouterModelsResponse
	if err := json.Unmarshal(body, &modelsResp); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	// Look for the specific model
	for _, model := range modelsResp.Data {
		if model.ID == modelID {
			// Determine family and type from model ID
			family, modelType := determineOpenRouterModelFamilyAndType(model.ID)

			return map[string]interface{}{
				"id":               model.ID,
				"name":             model.Name,
				"family":           family,
				"type":             modelType,
				"context_window":   model.Context,
				"provider":         model.ProviderName,
				"price_prompt":     model.PricePrompt,
				"price_completion": model.PriceCompletion,
			}, nil
		}
	}

	return nil, fmt.Errorf("model not found: %s", modelID)
}

// determineOpenRouterModelFamilyAndType extracts family and type information from an OpenRouter model ID
func determineOpenRouterModelFamilyAndType(modelID string) (string, string) {
	// OpenRouter IDs are formatted as provider/model-name
	// For example: "openai/gpt-4", "anthropic/claude-3-opus-20240229"

	// Extract original provider and model name
	var provider, modelName string

	for i := 0; i < len(modelID); i++ {
		if modelID[i] == '/' {
			provider = modelID[:i]
			modelName = modelID[i+1:]
			break
		}
	}

	// If no provider format, just use the model ID
	if provider == "" {
		return "Unknown", "Unknown"
	}

	// For known providers, delegate to their specific determination logic
	switch provider {
	case "openai":
		family := determineModelFamily(modelName, "openai")
		modelType := determineModelType(modelName, family, "openai")
		return family, modelType

	case "anthropic":
		family := determineModelFamily(modelName, "anthropic")
		modelType := determineModelType(modelName, family, "anthropic")
		return family, modelType

	case "google":
		family := determineModelFamily(modelName, "gemini")
		modelType := determineModelType(modelName, family, "gemini")
		return family, modelType

	default:
		// Try general determination
		family := determineModelFamily(modelName, provider)
		modelType := determineModelType(modelName, family, provider)
		return family, modelType
	}
}

// determineModelFamily identifies the model family based on the model name and provider
func determineModelFamily(modelName string, provider string) string {
	switch provider {
	case "openai":
		if contains(modelName, "gpt-4") {
			return "GPT-4"
		} else if contains(modelName, "gpt-3.5") {
			return "GPT-3.5"
		} else if contains(modelName, "gpt-3") {
			return "GPT-3"
		}
	case "anthropic":
		if contains(modelName, "claude-3") {
			return "Claude 3"
		} else if contains(modelName, "claude-2") {
			return "Claude 2"
		} else if contains(modelName, "claude-1") || contains(modelName, "claude-instant") {
			return "Claude 1"
		}
	case "gemini":
		if contains(modelName, "gemini") {
			return "Gemini"
		}
	}

	// Generic family determination based on common patterns
	if contains(modelName, "llama") {
		return "LLaMA"
	} else if contains(modelName, "mistral") {
		return "Mistral"
	} else if contains(modelName, "falcon") {
		return "Falcon"
	} else if contains(modelName, "palm") {
		return "PaLM"
	}

	return "Unknown"
}

// determineModelType categorizes the model based on its capabilities
func determineModelType(modelName string, family string, provider string) string {
	// Size/capability-based classification
	if contains(modelName, "opus") || contains(modelName, "sonnet") || contains(modelName, "haiku") {
		return "LLM" // Claude 3 models
	} else if contains(modelName, "pro") || contains(modelName, "ultra") || contains(modelName, "1106-preview") || contains(modelName, "0125-preview") {
		return "LLM" // Advanced LLMs
	} else if contains(modelName, "turbo") || contains(modelName, "1106") || contains(modelName, "0125") {
		return "LLM" // Fast/efficient LLMs
	} else if contains(modelName, "vision") || contains(modelName, "-v") {
		return "Multimodal"
	} else if contains(modelName, "embedding") {
		return "Embedding"
	}

	// Provider-specific heuristics
	switch provider {
	case "openai":
		if family == "GPT-4" {
			return "LLM"
		} else if family == "GPT-3.5" {
			return "LLM"
		}
	case "anthropic":
		return "LLM"
	case "gemini":
		if contains(modelName, "pro") {
			return "Multimodal"
		} else {
			return "LLM"
		}
	}

	// Default to LLM for most models
	return "LLM"
}

// contains is a helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
