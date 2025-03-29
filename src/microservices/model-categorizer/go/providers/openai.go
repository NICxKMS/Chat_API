package providers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/your-org/model-categorizer/config"
)

// OpenAIProvider handles interactions with the OpenAI API
type OpenAIProvider struct {
	APIKey  string
	BaseURL string
}

// OpenAIModelList represents the response from OpenAI models list endpoint
type OpenAIModelList struct {
	Data  []OpenAIModel `json:"data"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// OpenAIModel represents an OpenAI model
type OpenAIModel struct {
	ID      string `json:"id"`
	Created int64  `json:"created"`
	Object  string `json:"object"`
	OwnedBy string `json:"owned_by"`
}

// NewOpenAIProvider creates a new OpenAI provider with the given configuration
func NewOpenAIProvider(cfg *config.Configuration) *OpenAIProvider {
	return &OpenAIProvider{
		APIKey:  cfg.OpenAI.APIKey,
		BaseURL: cfg.OpenAI.BaseURL,
	}
}

// GetAvailableModels fetches all available models from OpenAI
func (p *OpenAIProvider) GetAvailableModels() ([]string, error) {
	if p.APIKey == "" {
		return []string{}, fmt.Errorf("OpenAI API key not configured")
	}

	client := &http.Client{
		Timeout: time.Second * 10,
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/models", p.BaseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", p.APIKey))
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

	var modelList OpenAIModelList
	if err := json.Unmarshal(body, &modelList); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	// Check for API errors
	if modelList.Error != nil {
		return nil, fmt.Errorf("API error: %s", modelList.Error.Message)
	}

	// Extract model IDs
	var models []string
	for _, model := range modelList.Data {
		models = append(models, model.ID)
	}

	return models, nil
}

// GetModelInfo gets detailed information about a specific model
func (p *OpenAIProvider) GetModelInfo(modelID string) (map[string]interface{}, error) {
	if p.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	client := &http.Client{
		Timeout: time.Second * 10,
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/models/%s", p.BaseURL, modelID), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", p.APIKey))
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

	var modelInfo map[string]interface{}
	if err := json.Unmarshal(body, &modelInfo); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	return modelInfo, nil
}
