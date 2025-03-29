package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/patrickmn/go-cache"
	"github.com/rs/cors"

	"github.com/your-org/model-categorizer/config"
	"github.com/your-org/model-categorizer/providers"
)

// ProviderModels represents models for a specific provider
type ProviderModels struct {
	Latest        string   `json:"latest"`
	OtherVersions []string `json:"other_versions"`
}

// ModelMetadata contains model information
type ModelMetadata struct {
	ID                  string   `json:"id"`
	Provider            string   `json:"provider"`
	Family              string   `json:"family,omitempty"`
	Type                string   `json:"type,omitempty"`
	Version             string   `json:"version,omitempty"`
	Capabilities        []string `json:"capabilities,omitempty"`
	ContextWindow       int      `json:"contextWindow,omitempty"`
	ReleaseDate         string   `json:"releaseDate,omitempty"`
	IsExperimental      bool     `json:"isExperimental,omitempty"`
	TrainingCutoff      string   `json:"trainingCutoff,omitempty"`
	MaxOutputTokens     int      `json:"maxOutputTokens,omitempty"`
	InputPricePerToken  float64  `json:"inputPricePerToken,omitempty"`
	OutputPricePerToken float64  `json:"outputPricePerToken,omitempty"`
}

// ModelRegistry stores all model metadata
type ModelRegistry struct {
	Models map[string]map[string]ModelMetadata // provider -> model ID -> metadata
}

// ProviderManager manages provider instances and their models
type ProviderManager struct {
	OpenAI     *providers.OpenAIProvider
	Anthropic  *providers.AnthropicProvider
	Gemini     *providers.GeminiProvider
	OpenRouter *providers.OpenRouterProvider
	Config     *config.Configuration
}

// Global variables
var (
	modelRegistry = ModelRegistry{
		Models: make(map[string]map[string]ModelMetadata),
	}
	modelCache      = cache.New(5*time.Minute, 10*time.Minute)
	providerManager *ProviderManager
)

// isNewerVersion compares version strings to determine if a is newer than b
func isNewerVersion(a, b string) bool {
	// Handle date-based version strings (like "20240307")
	aDate, aErr := time.Parse("20060102", a)
	bDate, bErr := time.Parse("20060102", b)

	// If both are dates, compare them
	if aErr == nil && bErr == nil {
		return aDate.After(bDate)
	}

	// Extract numeric version parts if present
	aParts := extractVersionNumbers(a)
	bParts := extractVersionNumbers(b)

	// If both have numeric parts, compare them
	if len(aParts) > 0 && len(bParts) > 0 {
		minLen := len(aParts)
		if len(bParts) < minLen {
			minLen = len(bParts)
		}

		for i := 0; i < minLen; i++ {
			if aParts[i] != bParts[i] {
				return aParts[i] > bParts[i]
			}
		}

		// If all common parts are equal, longer is newer
		return len(aParts) > len(bParts)
	}

	// If one is a date and the other isn't, date is newer (arbitrary but reasonable)
	if aErr == nil {
		return true
	}
	if bErr == nil {
		return false
	}

	// Fallback to string comparison
	return a > b
}

// extractVersionNumbers extracts numeric parts from version strings
func extractVersionNumbers(version string) []int {
	var numbers []int
	var currentNumber string

	for _, c := range version {
		if c >= '0' && c <= '9' {
			currentNumber += string(c)
		} else if currentNumber != "" {
			if num, err := parseVersionPart(currentNumber); err == nil {
				numbers = append(numbers, num)
			}
			currentNumber = ""
		}
	}

	// Don't forget the last number
	if currentNumber != "" {
		if num, err := parseVersionPart(currentNumber); err == nil {
			numbers = append(numbers, num)
		}
	}

	return numbers
}

// parseVersionPart safely parses a version part to an integer
func parseVersionPart(part string) (int, error) {
	return strconv.Atoi(part)
}

// normalizeModelName removes provider prefixes from OpenRouter model IDs
func normalizeModelName(modelID, provider string) string {
	// Handle OpenRouter models which often contain provider names
	if strings.ToLower(provider) == "openrouter" {
		// Remove provider prefixes like "anthropic/" or "openai/"
		parts := strings.SplitN(modelID, "/", 2)
		if len(parts) == 2 {
			// Keep track of the original provider in the modelID
			subProvider := strings.ToLower(parts[0])
			if subProvider == "anthropic" || subProvider == "openai" ||
				subProvider == "google" || subProvider == "meta-llama" ||
				subProvider == "mistralai" {
				return parts[1]
			}
		}
	}
	return modelID
}

// determineModelFamily guesses the model family based on name
func determineModelFamily(modelName, provider string) string {
	modelName = strings.ToLower(modelName)
	provider = strings.ToLower(provider)

	// Check for image generation models across all providers
	if strings.Contains(modelName, "dall-e") ||
		strings.Contains(modelName, "imagen") ||
		strings.Contains(modelName, "midjourney") ||
		strings.Contains(modelName, "stable-diffusion") ||
		strings.Contains(modelName, "image") && strings.Contains(modelName, "generat") {
		return "Image Generation"
	}

	// Normalize OpenRouter model names
	normalizedName := normalizeModelName(modelName, provider)
	if normalizedName != modelName {
		modelName = normalizedName
	}

	switch {
	case provider == "openai" || strings.Contains(modelName, "gpt") || strings.Contains(modelName, "o1"):
		// Check O Series first
		if strings.Contains(modelName, "o1-mini") {
			return "O Series"
		} else if strings.Contains(modelName, "o1") {
			return "O Series"
		} else if strings.Contains(modelName, "gpt-4o-mini") {
			return "GPT-4"
		} else if strings.Contains(modelName, "gpt-4o") {
			return "GPT-4"
		} else if strings.Contains(modelName, "gpt-4.5") {
			return "GPT-4"
		} else if strings.Contains(modelName, "gpt-4") {
			return "GPT-4"
		} else if strings.Contains(modelName, "gpt-3.5") {
			return "GPT-3.5"
		} else if strings.HasPrefix(modelName, "davinci") ||
			strings.HasPrefix(modelName, "curie") ||
			strings.HasPrefix(modelName, "babbage") ||
			strings.HasPrefix(modelName, "ada") ||
			strings.Contains(modelName, "embedding") ||
			strings.Contains(modelName, "tts") ||
			strings.Contains(modelName, "whisper") {
			return "Other"
		}
	case provider == "anthropic" || strings.Contains(modelName, "claude"):
		if strings.Contains(modelName, "claude-3.7") {
			return "Claude 3.7"
		} else if strings.Contains(modelName, "claude-3.5") {
			return "Claude 3.5"
		} else if strings.Contains(modelName, "claude-3") {
			if strings.Contains(modelName, "sonnet") {
				return "Sonnet"
			} else if strings.Contains(modelName, "haiku") {
				return "Haiku"
			} else if strings.Contains(modelName, "opus") {
				return "Opus"
			}
			return "Claude 3"
		} else if strings.Contains(modelName, "claude-2") {
			return "Claude 2"
		} else if strings.Contains(modelName, "claude-1") || strings.Contains(modelName, "claude-instant") {
			return "Claude 1"
		}
	case provider == "gemini" || strings.Contains(modelName, "gemini"):
		// For Gemini models, categorize by type (Flash, Pro, etc.) first
		if strings.Contains(modelName, "flash-lite") || strings.Contains(modelName, "flash lite") {
			return "Flash Lite"
		} else if strings.Contains(modelName, "flash") {
			return "Flash"
		} else if strings.Contains(modelName, "pro") {
			return "Pro"
		} else if strings.Contains(modelName, "ultra") {
			return "Ultra"
		} else if strings.Contains(modelName, "thinking") {
			return "Thinking"
		} else if strings.Contains(modelName, "embedding") ||
			strings.Contains(modelName, "embed") ||
			strings.Contains(modelName, "bison") ||
			strings.Contains(modelName, "gemma") ||
			strings.Contains(modelName, "aqa") {
			return "Other"
		} else if strings.Contains(modelName, "vision") {
			return "Vision"
		}
	case strings.Contains(modelName, "llama") || strings.Contains(modelName, "hermes"):
		return "LLaMA"
	case strings.Contains(modelName, "mistral") || strings.Contains(modelName, "mixtral"):
		return "Mistral"
	case strings.Contains(modelName, "palm"):
		return "PaLM"
	}

	return "Other"
}

// determineModelType guesses the model type based on name and family
func determineModelType(modelName, family, provider string) string {
	modelName = strings.ToLower(modelName)
	provider = strings.ToLower(provider)

	// Normalize OpenRouter model names
	normalizedName := normalizeModelName(modelName, provider)
	if normalizedName != modelName {
		modelName = normalizedName
	}

	// Check if this is a multimodal model
	if strings.Contains(modelName, "vision") ||
		strings.Contains(modelName, "vl") ||
		strings.Contains(modelName, "visual") ||
		strings.Contains(modelName, "dall-e") {
		return "Multimodal"
	}

	switch {
	case provider == "openai":
		if strings.Contains(modelName, "turbo") {
			return "Turbo"
		} else if strings.Contains(modelName, "o1-mini") {
			return "O1 Mini"
		} else if strings.Contains(modelName, "o1") {
			return "O1"
		} else if strings.Contains(modelName, "gpt-4o-mini") {
			return "GPT-4o Mini"
		} else if strings.Contains(modelName, "gpt-4o") {
			return "GPT-4o"
		} else if strings.Contains(modelName, "gpt-4.5") {
			return "GPT-4.5"
		} else if strings.Contains(family, "GPT-4o") {
			// Already handled above
			return "Standard"
		}
	case provider == "anthropic" || strings.Contains(modelName, "claude"):
		if strings.Contains(modelName, "opus") {
			return "Opus"
		} else if strings.Contains(modelName, "sonnet") {
			return "Sonnet"
		} else if strings.Contains(modelName, "haiku") {
			return "Haiku"
		} else if strings.Contains(modelName, "instant") {
			return "Instant"
		}
	case provider == "gemini" || strings.Contains(modelName, "gemini"):
		// For Gemini models, categorize by version (1.0, 1.5, 2.0, etc.)
		if strings.Contains(modelName, "gemini-1.0") {
			return "Gemini 1.0"
		} else if strings.Contains(modelName, "gemini-1.5") {
			return "Gemini 1.5"
		} else if strings.Contains(modelName, "gemini-2.0") {
			return "Gemini 2.0"
		} else if strings.Contains(modelName, "gemini-2.5") {
			return "Gemini 2.5"
		} else {
			return "Gemini"
		}
	case provider == "openrouter":
		return "LLM"
	}

	return "Standard"
}

// Initialize the provider manager with the configuration
func initializeProviderManager(cfg *config.Configuration) *ProviderManager {
	return &ProviderManager{
		OpenAI:     providers.NewOpenAIProvider(cfg),
		Anthropic:  providers.NewAnthropicProvider(cfg),
		Gemini:     providers.NewGeminiProvider(cfg),
		OpenRouter: providers.NewOpenRouterProvider(cfg),
		Config:     cfg,
	}
}

// Initialize the model registry
func initializeModelRegistry() {
	// Initialize registry maps
	modelRegistry.Models["openai"] = make(map[string]ModelMetadata)
	modelRegistry.Models["anthropic"] = make(map[string]ModelMetadata)
	modelRegistry.Models["gemini"] = make(map[string]ModelMetadata)
	modelRegistry.Models["openrouter"] = make(map[string]ModelMetadata)

	// Load models from providers
	loadModelsFromProviders()
}

// Load models from all configured providers
func loadModelsFromProviders() {
	// Load OpenAI models
	if providerManager.OpenAI.APIKey != "" {
		log.Println("Loading models from OpenAI...")
		models, err := providerManager.OpenAI.GetAvailableModels()
		if err != nil {
			log.Printf("Error loading models from OpenAI: %v", err)
		} else {
			log.Printf("Loaded %d models from OpenAI", len(models))
			for _, modelID := range models {
				registerModel("openai", modelID, ModelMetadata{
					Family: determineModelFamily(modelID, "openai"),
					Type:   determineModelType(modelID, determineModelFamily(modelID, "openai"), "openai"),
				})
			}
		}
	}

	// Load Anthropic models
	if providerManager.Anthropic.APIKey != "" {
		log.Println("Loading models from Anthropic...")
		models, err := providerManager.Anthropic.GetAvailableModels()
		if err != nil {
			log.Printf("Error loading models from Anthropic: %v", err)
		} else {
			log.Printf("Loaded %d models from Anthropic", len(models))
			for _, modelID := range models {
				modelInfo, _ := providerManager.Anthropic.GetModelInfo(modelID)

				var capabilities []string
				if caps, ok := modelInfo["capabilities"].([]string); ok {
					capabilities = caps
				}

				var contextWindow int
				if ctx, ok := modelInfo["context_window"].(int); ok {
					contextWindow = ctx
				}

				var version string
				if v, ok := modelInfo["version"].(string); ok {
					version = v
				}

				registerModel("anthropic", modelID, ModelMetadata{
					Family:        modelInfo["family"].(string),
					Type:          modelInfo["type"].(string),
					Capabilities:  capabilities,
					ContextWindow: contextWindow,
					Version:       version,
				})
			}
		}
	}

	// Load Gemini models
	if providerManager.Gemini.APIKey != "" {
		log.Println("Loading models from Gemini...")
		models, err := providerManager.Gemini.GetAvailableModels()
		if err != nil {
			log.Printf("Error loading models from Gemini: %v", err)
		} else {
			log.Printf("Loaded %d models from Gemini", len(models))
			for _, modelID := range models {
				modelInfo, _ := providerManager.Gemini.GetModelInfo(modelID)

				var capabilities []string
				if caps, ok := modelInfo["capabilities"].([]string); ok {
					capabilities = caps
				}

				var contextWindow int
				if ctx, ok := modelInfo["context_window"].(int); ok {
					contextWindow = ctx
				}

				var version string
				if v, ok := modelInfo["version"].(string); ok {
					version = v
				}

				registerModel("gemini", modelID, ModelMetadata{
					Family:        modelInfo["family"].(string),
					Type:          modelInfo["type"].(string),
					Capabilities:  capabilities,
					ContextWindow: contextWindow,
					Version:       version,
				})
			}
		}
	}

	// Load OpenRouter models
	if providerManager.OpenRouter.APIKey != "" {
		log.Println("Loading models from OpenRouter...")
		models, err := providerManager.OpenRouter.GetAvailableModels()
		if err != nil {
			log.Printf("Error loading models from OpenRouter: %v", err)
		} else {
			log.Printf("Loaded %d models from OpenRouter", len(models))
			for _, modelID := range models {
				modelInfo, err := providerManager.OpenRouter.GetModelInfo(modelID)
				if err != nil {
					continue
				}

				var family, modelType string
				if f, ok := modelInfo["family"].(string); ok {
					family = f
				}
				if t, ok := modelInfo["type"].(string); ok {
					modelType = t
				}

				var contextWindow int
				if ctx, ok := modelInfo["context_window"].(int); ok {
					contextWindow = ctx
				}

				registerModel("openrouter", modelID, ModelMetadata{
					ID:            modelID,
					Provider:      "openrouter",
					Family:        family,
					Type:          modelType,
					ContextWindow: contextWindow,
				})
			}
		}
	}

	// If no models were loaded, add some fallback models
	if len(modelRegistry.Models["openai"]) == 0 &&
		len(modelRegistry.Models["anthropic"]) == 0 &&
		len(modelRegistry.Models["gemini"]) == 0 &&
		len(modelRegistry.Models["openrouter"]) == 0 {
		log.Println("No models loaded from providers, adding fallback models...")

		// OpenAI models
		registerModel("openai", "gpt-4o", ModelMetadata{
			Family:        "GPT-4",
			Type:          "GPT-4o",
			Version:       "1.0.0",
			Capabilities:  []string{"vision", "function-calling"},
			ContextWindow: 128000,
		})

		registerModel("openai", "gpt-4o-mini", ModelMetadata{
			Family:        "GPT-4",
			Type:          "GPT-4o Mini",
			Version:       "1.0.0",
			Capabilities:  []string{"vision", "function-calling"},
			ContextWindow: 128000,
		})

		registerModel("openai", "gpt-4-turbo", ModelMetadata{
			Family:        "GPT-4",
			Type:          "Turbo",
			Version:       "1.0.0",
			Capabilities:  []string{"function-calling"},
			ContextWindow: 128000,
		})

		registerModel("openai", "gpt-3.5-turbo", ModelMetadata{
			Family:        "GPT-3.5",
			Type:          "Turbo",
			Version:       "1.0.0",
			Capabilities:  []string{"function-calling"},
			ContextWindow: 16000,
		})

		// Anthropic models
		registerModel("anthropic", "claude-3-opus-20240229", ModelMetadata{
			Family:        "Claude 3",
			Type:          "Opus",
			Version:       "20240229",
			Capabilities:  []string{"vision", "function-calling"},
			ContextWindow: 200000,
		})

		registerModel("anthropic", "claude-3-sonnet-20240229", ModelMetadata{
			Family:        "Claude 3",
			Type:          "Sonnet",
			Version:       "20240229",
			Capabilities:  []string{"vision", "function-calling"},
			ContextWindow: 200000,
		})

		registerModel("anthropic", "claude-3-haiku-20240307", ModelMetadata{
			Family:        "Claude 3",
			Type:          "Haiku",
			Version:       "20240307",
			Capabilities:  []string{"vision", "function-calling"},
			ContextWindow: 200000,
		})

		// Gemini models
		registerModel("gemini", "gemini-1.5-pro", ModelMetadata{
			Family:        "Gemini 1.5",
			Type:          "Pro",
			Version:       "1.0.0",
			Capabilities:  []string{"vision", "function-calling"},
			ContextWindow: 1000000,
		})

		registerModel("gemini", "gemini-1.5-flash", ModelMetadata{
			Family:        "Gemini 1.5",
			Type:          "Flash",
			Version:       "1.0.0",
			Capabilities:  []string{"vision", "function-calling"},
			ContextWindow: 1000000,
		})
	}
}

// Register a model in the registry
func registerModel(provider, modelID string, metadata ModelMetadata) {
	if modelRegistry.Models[provider] == nil {
		modelRegistry.Models[provider] = make(map[string]ModelMetadata)
	}

	metadata.ID = modelID
	metadata.Provider = provider
	modelRegistry.Models[provider][modelID] = metadata

	// Clear cache when registry changes
	modelCache.Flush()
}

// isDefaultModelName checks if a model name is a default/canonical version
func isDefaultModelName(modelID string) bool {
	// List of exact matches for default model names (without version numbers or suffixes)
	defaultModels := []string{
		"gpt-4o",
		"gpt-4",
		"gpt-3.5-turbo",
		"o1",
		"gpt-4o-mini",
		"o1-mini",
		"gemini-1.0-pro",
		"gemini-1.5-pro",
		"gemini-1.5-flash",
		"gemini-2.0-pro",
		"gemini-2.0-flash",
		"claude-3-opus",
		"claude-3-sonnet",
		"claude-3-haiku",
	}

	for _, defaultModel := range defaultModels {
		if modelID == defaultModel {
			return true
		}
	}

	// Also check for models that have "latest" in their name
	if strings.Contains(modelID, "latest") {
		return true
	}

	return false
}

// processGeminiModels handles Gemini models in a special way to organize by type first, then version
func processGeminiModels(models map[string]ModelMetadata, includeExperimental bool) map[string]map[string]map[string]interface{} {
	// For Gemini, we'll organize as: Type -> Version -> Models
	result := make(map[string]map[string]map[string]interface{})

	// Group models by type and version
	typeVersionGroups := make(map[string]map[string][]string)

	for modelID, model := range models {
		if !includeExperimental && model.IsExperimental {
			continue
		}

		// Check for image generation models first
		if strings.Contains(strings.ToLower(modelID), "imagen") ||
			(strings.Contains(strings.ToLower(modelID), "image") &&
				strings.Contains(strings.ToLower(modelID), "generat")) {
			// Skip image generation models - they're handled separately
			continue
		}

		// Determine model type and version
		var modelType, version string

		// Determine type first
		if strings.Contains(modelID, "flash-lite") || strings.Contains(modelID, "flash lite") {
			modelType = "Flash Lite"
		} else if strings.Contains(modelID, "flash") {
			modelType = "Flash"
		} else if strings.Contains(modelID, "pro") {
			modelType = "Pro"
		} else if strings.Contains(modelID, "ultra") {
			modelType = "Ultra"
		} else if strings.Contains(modelID, "thinking") {
			modelType = "Thinking"
		} else if strings.Contains(modelID, "vision") {
			modelType = "Vision"
		} else if strings.Contains(modelID, "embedding") ||
			strings.Contains(modelID, "embed") ||
			strings.Contains(modelID, "bison") ||
			strings.Contains(modelID, "gemma") ||
			strings.Contains(modelID, "text-") ||
			strings.Contains(modelID, "aqa") {
			modelType = "Other"
		} else {
			modelType = "Other"
		}

		// Then determine version
		if strings.Contains(modelID, "gemini-1.0") {
			version = "Gemini 1.0"
		} else if strings.Contains(modelID, "gemini-1.5") {
			version = "Gemini 1.5"
		} else if strings.Contains(modelID, "gemini-2.0") {
			version = "Gemini 2.0"
		} else if strings.Contains(modelID, "gemini-2.5") {
			version = "Gemini 2.5"
		} else {
			version = "Gemini"
		}

		// Initialize maps if needed
		if typeVersionGroups[modelType] == nil {
			typeVersionGroups[modelType] = make(map[string][]string)
		}

		// Add model to the appropriate group
		typeVersionGroups[modelType][version] = append(typeVersionGroups[modelType][version], modelID)
	}

	// Process groups into result format
	for modelType, versionGroups := range typeVersionGroups {
		if result[modelType] == nil {
			result[modelType] = make(map[string]map[string]interface{})
		}

		for version, modelIDs := range versionGroups {
			if result[modelType][version] == nil {
				result[modelType][version] = make(map[string]interface{})
			}

			// Sort models for consistency
			sort.Strings(modelIDs)

			// Find the latest version
			var latestModel string
			var otherVersions []string

			if len(modelIDs) > 0 {
				// First, look for a default/canonical model name
				for _, id := range modelIDs {
					if isDefaultModelName(id) {
						latestModel = id
						break
					}
				}

				// If no default found, try to find a model with "latest" in the name
				if latestModel == "" {
					for _, id := range modelIDs {
						if strings.Contains(id, "latest") {
							latestModel = id
							break
						}
					}
				}

				// If still no model found, use the one that appears newest
				if latestModel == "" {
					latestModel = modelIDs[0]
					for _, id := range modelIDs[1:] {
						if strings.Contains(id, "preview") && !strings.Contains(latestModel, "preview") {
							latestModel = id
						} else if isNewerVersion(id, latestModel) {
							latestModel = id
						}
					}
				}

				// Add all other models to other_versions
				for _, id := range modelIDs {
					if id != latestModel {
						otherVersions = append(otherVersions, id)
					}
				}
			}

			// Add to result
			result[modelType][version]["latest"] = latestModel
			if len(otherVersions) > 0 {
				result[modelType][version]["other_versions"] = otherVersions
			} else {
				result[modelType][version]["other_versions"] = nil
			}
		}
	}

	return result
}

// getImageGenerationModels returns all image generation models across providers
func getImageGenerationModels(includeExperimental bool) map[string]map[string]interface{} {
	// Provider -> Model details
	result := make(map[string]map[string]interface{})

	// Process each provider to find image generation models
	for provider, models := range modelRegistry.Models {
		var imageModels []string
		var displayName string

		// Determine display name for the provider
		switch provider {
		case "openai":
			displayName = "DALL-E by OpenAI"
		case "gemini":
			displayName = "Imagen by Google"
		case "stability":
			displayName = "Stable Diffusion"
		case "midjourney":
			displayName = "Midjourney"
		default:
			displayName = provider
		}

		for modelID, model := range models {
			if !includeExperimental && model.IsExperimental {
				continue
			}

			// Check if this is an image generation model
			modelLower := strings.ToLower(modelID)
			if strings.Contains(modelLower, "dall-e") ||
				strings.Contains(modelLower, "imagen") ||
				strings.Contains(modelLower, "midjourney") ||
				strings.Contains(modelLower, "stable-diffusion") ||
				(strings.Contains(modelLower, "image") && strings.Contains(modelLower, "generat")) {
				imageModels = append(imageModels, modelID)
			}
		}

		// If we found image generation models for this provider
		if len(imageModels) > 0 {
			// Sort for consistency
			sort.Strings(imageModels)

			// Find the "latest" model
			var latestModel string
			var otherModels []string

			// First look for a model with "latest" in the name
			for _, id := range imageModels {
				if strings.Contains(id, "latest") {
					latestModel = id
					break
				}
			}

			// If not found, try to find a default/canonical name
			if latestModel == "" {
				for _, id := range imageModels {
					if isDefaultModelName(id) {
						latestModel = id
						break
					}
				}
			}

			// If still not found, take the one that appears newest
			if latestModel == "" {
				latestModel = imageModels[0]
				for _, id := range imageModels[1:] {
					if strings.Contains(id, "3") && !strings.Contains(latestModel, "3") {
						// Prefer models with "3" in the name (like DALL-E 3)
						latestModel = id
					} else if isNewerVersion(id, latestModel) {
						latestModel = id
					}
				}
			}

			// Add all other models to other_versions
			for _, id := range imageModels {
				if id != latestModel {
					otherModels = append(otherModels, id)
				}
			}

			// Add to result using the display name
			result[displayName] = map[string]interface{}{
				"latest":         latestModel,
				"other_versions": otherModels,
			}
		}
	}

	return result
}

// getCategorizedModels returns models categorized by provider, family, and type
func getCategorizedModels(includeExperimental bool) map[string]map[string]map[string]map[string]interface{} {
	cacheKey := fmt.Sprintf("categorized-models-%v", includeExperimental)
	if cached, found := modelCache.Get(cacheKey); found {
		return cached.(map[string]map[string]map[string]map[string]interface{})
	}

	// Top level is provider -> family -> type -> model versions
	result := make(map[string]map[string]map[string]map[string]interface{})

	// Add image generation models as a special category
	imageGenerationModels := getImageGenerationModels(includeExperimental)
	if len(imageGenerationModels) > 0 {
		result["image_generation"] = make(map[string]map[string]map[string]interface{})
		for provider, models := range imageGenerationModels {
			if result["image_generation"]["Models"] == nil {
				result["image_generation"]["Models"] = make(map[string]map[string]interface{})
			}
			result["image_generation"]["Models"][provider] = models
		}
	}

	// Process each provider
	for provider, models := range modelRegistry.Models {
		// Skip if no models for this provider
		if len(models) == 0 {
			continue
		}

		// Special handling for Gemini models
		if provider == "gemini" {
			geminiModels := processGeminiModels(models, includeExperimental)
			result["gemini"] = geminiModels
			continue
		}

		// Convert map to slice for grouping
		var modelList []ModelMetadata
		for _, m := range models {
			if !includeExperimental && m.IsExperimental {
				continue
			}

			// Skip image generation models - they're handled separately
			modelLower := strings.ToLower(m.ID)
			if strings.Contains(modelLower, "dall-e") ||
				strings.Contains(modelLower, "imagen") ||
				strings.Contains(modelLower, "midjourney") ||
				strings.Contains(modelLower, "stable-diffusion") ||
				(strings.Contains(modelLower, "image") && strings.Contains(modelLower, "generat")) {
				continue
			}

			// Make a copy to avoid modifying the original
			model := m

			// Ensure family and type are set
			if model.Family == "" {
				model.Family = determineModelFamily(model.ID, provider)
			}

			if model.Type == "" {
				model.Type = determineModelType(model.ID, model.Family, provider)
			}

			modelList = append(modelList, model)
		}

		// Add to result
		if result[provider] == nil {
			result[provider] = make(map[string]map[string]map[string]interface{})
		}

		// Group by family and type
		familyTypeGroups := make(map[string]map[string][]ModelMetadata)

		for _, model := range modelList {
			family := model.Family
			modelType := model.Type

			// Initialize maps if needed
			if familyTypeGroups[family] == nil {
				familyTypeGroups[family] = make(map[string][]ModelMetadata)
			}

			// Group models by type within family
			familyTypeGroups[family][modelType] = append(familyTypeGroups[family][modelType], model)
		}

		// Sort and organize models within each type
		for family, typeGroups := range familyTypeGroups {
			if result[provider][family] == nil {
				result[provider][family] = make(map[string]map[string]interface{})
			}

			for modelType, typeModels := range typeGroups {
				if result[provider][family][modelType] == nil {
					result[provider][family][modelType] = make(map[string]interface{})
				}

				// Find the latest version
				var latestModel string
				var otherVersions []string

				// Sort models by version (if available) or by name
				if len(typeModels) > 0 {
					// First, look for a default/canonical model name
					for _, model := range typeModels {
						if isDefaultModelName(model.ID) {
							latestModel = model.ID
							break
						}
					}

					// If no default found, try to find a "latest" version explicitly
					if latestModel == "" {
						for _, model := range typeModels {
							if strings.Contains(model.ID, "latest") {
								latestModel = model.ID
								break
							}
						}
					}

					// If no "latest" was found, use version information
					if latestModel == "" {
						// Find the model with the highest version number
						latestModelMetadata := typeModels[0]

						for _, model := range typeModels[1:] {
							if model.Version != "" && latestModelMetadata.Version != "" {
								if isNewerVersion(model.Version, latestModelMetadata.Version) {
									latestModelMetadata = model
								}
							} else if strings.Contains(model.ID, "preview") && !strings.Contains(latestModelMetadata.ID, "preview") {
								// Preview models are usually newer
								latestModelMetadata = model
							} else if isNewerVersion(model.ID, latestModelMetadata.ID) {
								latestModelMetadata = model
							}
						}

						latestModel = latestModelMetadata.ID
					}

					// Add all other models to other_versions
					for _, model := range typeModels {
						if model.ID != latestModel {
							otherVersions = append(otherVersions, model.ID)
						}
					}

					// Sort other_versions alphabetically for consistency
					sort.Strings(otherVersions)
				}

				// Add to result
				result[provider][family][modelType]["latest"] = latestModel
				if len(otherVersions) > 0 {
					result[provider][family][modelType]["other_versions"] = otherVersions
				} else {
					result[provider][family][modelType]["other_versions"] = nil
				}
			}
		}
	}

	// Cache the result
	modelCache.Set(cacheKey, result, cache.DefaultExpiration)

	return result
}

// structuredData holds the full hierarchy:
// vendor -> series -> variant -> ModelDetail.
type structuredData map[string]map[string]map[string]ProviderModels

// getVendor returns a vendor name based on the raw model string.
func getVendor(model string) string {
	lower := strings.ToLower(model)
	switch {
	case strings.Contains(lower, "claude"):
		return "Anthropic"
	case strings.Contains(lower, "gemini"):
		return "Gemini"
	case strings.Contains(lower, "gpt"), strings.Contains(lower, "o1"):
		return "OpenAI"
	default:
		return "Unknown Models"
	}
}

// getSeriesAndVariant returns series and variant names based on the raw model string.
func getSeriesAndVariant(model string) (series string, variant string) {
	lower := strings.ToLower(model)

	// For Anthropic models.
	if strings.Contains(lower, "claude") {
		if strings.Contains(lower, "sonnet") {
			series = "Sonnet"
			if strings.Contains(lower, "3") {
				variant = "Claude 3"
			} else {
				variant = "Claude 1"
			}
			return
		} else if strings.Contains(lower, "haiku") {
			series = "Haiku"
			if strings.Contains(lower, "3") {
				variant = "Claude 3"
			} else {
				variant = "Claude 1"
			}
			return
		} else if strings.Contains(lower, "opus") {
			series = "Opus"
			if strings.Contains(lower, "3") {
				variant = "Claude 3"
			} else {
				variant = "Claude 2"
			}
			return
		}
	}

	// For Gemini models.
	if strings.Contains(lower, "gemini") {
		// For Gemini models, categorize by type (Flash, Pro, etc.) first, then version
		var modelType, version string

		// Determine type first
		if strings.Contains(lower, "flash-lite") || strings.Contains(lower, "flash lite") {
			modelType = "Flash Lite"
		} else if strings.Contains(lower, "flash") {
			modelType = "Flash"
		} else if strings.Contains(lower, "pro") {
			modelType = "Pro"
		} else if strings.Contains(lower, "ultra") {
			modelType = "Ultra"
		} else if strings.Contains(lower, "thinking") {
			modelType = "Thinking"
		} else if strings.Contains(lower, "vision") {
			modelType = "Vision"
		} else if strings.Contains(lower, "embedding") ||
			strings.Contains(lower, "embed") ||
			strings.Contains(lower, "bison") ||
			strings.Contains(lower, "gemma") ||
			strings.Contains(lower, "aqa") {
			modelType = "Other"
		} else {
			modelType = "Other"
		}

		// Then determine version
		if strings.Contains(lower, "gemini-1.0") {
			version = "Gemini 1.0"
		} else if strings.Contains(lower, "gemini-1.5") {
			version = "Gemini 1.5"
		} else if strings.Contains(lower, "gemini-2.0") {
			version = "Gemini 2.0"
		} else if strings.Contains(lower, "gemini-2.5") {
			version = "Gemini 2.5"
		} else {
			version = "Gemini"
		}

		series = modelType
		variant = version
		return
	}

	// For OpenAI models.
	if strings.Contains(lower, "openai") || strings.Contains(lower, "gpt") || strings.Contains(lower, "o1") {
		// Check O Series first.
		if strings.Contains(lower, "o1-mini") {
			series = "O Series"
			variant = "O1 Mini"
			return
		} else if strings.Contains(lower, "o1") {
			series = "O Series"
			variant = "O1"
			return
		} else if strings.Contains(lower, "gpt-3.5") {
			series = "GPT-3.5"
			variant = "Turbo"
			return
		} else if strings.Contains(lower, "gpt-4o-mini") {
			series = "GPT-4"
			variant = "GPT-4o Mini"
			return
		} else if strings.Contains(lower, "gpt-4o") {
			series = "GPT-4"
			variant = "GPT-4o"
			return
		} else if strings.Contains(lower, "gpt-4.5") {
			series = "GPT-4"
			variant = "GPT-4.5"
			return
		} else if strings.Contains(lower, "dall-e") {
			series = "DALL-E"
			variant = "DALL-E"
			return
		} else if strings.HasPrefix(lower, "davinci") ||
			strings.HasPrefix(lower, "curie") ||
			strings.HasPrefix(lower, "babbage") ||
			strings.HasPrefix(lower, "ada") ||
			strings.Contains(lower, "embedding") ||
			strings.Contains(lower, "tts") ||
			strings.Contains(lower, "whisper") {
			series = "Other"
			variant = "Legacy"
			return
		}
	}

	// Fallback in case no rule matches.
	series = "Other"
	variant = "Other"
	return
}

// getStructuredModelData returns models in the structuredData format
func getStructuredModelData() structuredData {
	cacheKey := "structured-model-data"
	if cached, found := modelCache.Get(cacheKey); found {
		return cached.(structuredData)
	}

	// Initialize our structured data
	data := structuredData{}

	// Get all model IDs from the registry
	var allModels []string
	for _, providerModels := range modelRegistry.Models {
		for modelID := range providerModels {
			allModels = append(allModels, modelID)
		}
	}

	// Process each model
	for _, model := range allModels {
		vendor := getVendor(model)
		series, variant := getSeriesAndVariant(model)

		// Initialize maps if needed
		if _, exists := data[vendor]; !exists {
			data[vendor] = make(map[string]map[string]ProviderModels)
		}
		if _, exists := data[vendor][series]; !exists {
			data[vendor][series] = make(map[string]ProviderModels)
		}

		// If this variant already exists, add this model as another version
		if existingModel, exists := data[vendor][series][variant]; exists {
			// If the Latest is empty, set it
			if existingModel.Latest == "" {
				existingModel.Latest = model
			} else {
				// Check if this might be a default/canonical model name
				if isDefaultModelName(model) && !isDefaultModelName(existingModel.Latest) {
					// This is a default model name, make it the latest
					if existingModel.OtherVersions == nil {
						existingModel.OtherVersions = []string{}
					}
					existingModel.OtherVersions = append(existingModel.OtherVersions, existingModel.Latest)
					existingModel.Latest = model
				} else if isDefaultModelName(model) && isDefaultModelName(existingModel.Latest) {
					// Both are default models, check for "latest" in the name
					if strings.Contains(model, "latest") && !strings.Contains(existingModel.Latest, "latest") {
						// This has "latest" in the name, make it the latest
						if existingModel.OtherVersions == nil {
							existingModel.OtherVersions = []string{}
						}
						existingModel.OtherVersions = append(existingModel.OtherVersions, existingModel.Latest)
						existingModel.Latest = model
					} else if !strings.Contains(model, "latest") && !strings.Contains(existingModel.Latest, "latest") {
						// Both are default models without "latest", check which is newer
						if isNewerVersion(model, existingModel.Latest) {
							if existingModel.OtherVersions == nil {
								existingModel.OtherVersions = []string{}
							}
							existingModel.OtherVersions = append(existingModel.OtherVersions, existingModel.Latest)
							existingModel.Latest = model
						} else {
							// Not newer, add to OtherVersions
							if existingModel.OtherVersions == nil {
								existingModel.OtherVersions = []string{}
							}
							existingModel.OtherVersions = append(existingModel.OtherVersions, model)
						}
					} else {
						// Not a special case, add to OtherVersions
						if existingModel.OtherVersions == nil {
							existingModel.OtherVersions = []string{}
						}
						existingModel.OtherVersions = append(existingModel.OtherVersions, model)
					}
				} else if !isDefaultModelName(model) && !isDefaultModelName(existingModel.Latest) {
					// Neither are default models, check for "latest" in the name
					if strings.Contains(model, "latest") && !strings.Contains(existingModel.Latest, "latest") {
						// This has "latest" in the name, make it the latest
						if existingModel.OtherVersions == nil {
							existingModel.OtherVersions = []string{}
						}
						existingModel.OtherVersions = append(existingModel.OtherVersions, existingModel.Latest)
						existingModel.Latest = model
					} else if isNewerVersion(model, existingModel.Latest) {
						// This is newer, move current latest to OtherVersions
						if existingModel.OtherVersions == nil {
							existingModel.OtherVersions = []string{}
						}
						existingModel.OtherVersions = append(existingModel.OtherVersions, existingModel.Latest)
						existingModel.Latest = model
					} else {
						// Not newer, add to OtherVersions
						if existingModel.OtherVersions == nil {
							existingModel.OtherVersions = []string{}
						}
						existingModel.OtherVersions = append(existingModel.OtherVersions, model)
					}
				} else {
					// Not a special case, add to OtherVersions
					if existingModel.OtherVersions == nil {
						existingModel.OtherVersions = []string{}
					}
					existingModel.OtherVersions = append(existingModel.OtherVersions, model)
				}
			}
			data[vendor][series][variant] = existingModel
		} else {
			// Create new entry for this variant
			data[vendor][series][variant] = ProviderModels{
				Latest:        model,
				OtherVersions: nil,
			}
		}
	}

	// Cache the result
	modelCache.Set(cacheKey, data, cache.DefaultExpiration)

	return data
}

// Handler for getting all providers
func getProvidersHandler(w http.ResponseWriter, r *http.Request) {
	providers := make([]string, 0, len(modelRegistry.Models))
	for provider := range modelRegistry.Models {
		providers = append(providers, provider)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(providers)
}

// Handler for getting models for a specific provider
func getProviderModelsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	provider := vars["provider"]

	// Find the provider (case insensitive)
	var models map[string]ModelMetadata
	for p, m := range modelRegistry.Models {
		if strings.EqualFold(p, provider) {
			models = m
			break
		}
	}

	if models == nil {
		http.Error(w, fmt.Sprintf("Provider '%s' not found", provider), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models)
}

// Handler for getting categorized models
func getCategorizedModelsHandler(w http.ResponseWriter, r *http.Request) {
	includeExperimental := r.URL.Query().Get("experimental") == "true"
	result := getCategorizedModels(includeExperimental)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// Handler for getting models in structured data format
func getStructuredModelsHandler(w http.ResponseWriter, r *http.Request) {
	result := getStructuredModelData()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// Handler for registering a new model
func registerModelHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Provider string        `json:"provider"`
		Model    string        `json:"model"`
		Metadata ModelMetadata `json:"metadata"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if payload.Provider == "" || payload.Model == "" {
		http.Error(w, "Provider and model name are required", http.StatusBadRequest)
		return
	}

	registerModel(payload.Provider, payload.Model, payload.Metadata)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Model %s from %s registered successfully", payload.Model, payload.Provider),
	})
}

// Health check handler
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	// Count models by provider
	modelCounts := make(map[string]int)
	for provider, models := range modelRegistry.Models {
		modelCounts[provider] = len(models)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"time":   time.Now().Format(time.RFC3339),
		"models": modelCounts,
	})
}

// Reload models from providers
func reloadModelsHandler(w http.ResponseWriter, r *http.Request) {
	// Clear the registry
	for provider := range modelRegistry.Models {
		modelRegistry.Models[provider] = make(map[string]ModelMetadata)
	}

	// Reload models
	loadModelsFromProviders()

	// Clear cache
	modelCache.Flush()

	// Count models by provider
	modelCounts := make(map[string]int)
	for provider, models := range modelRegistry.Models {
		modelCounts[provider] = len(models)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Models reloaded successfully",
		"models":  modelCounts,
	})
}

func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Error loading configuration: %v", err)
	}

	// Initialize provider manager
	providerManager = initializeProviderManager(cfg)

	// Initialize sample data
	initializeModelRegistry()

	// Create router
	r := mux.NewRouter()

	// Define routes correctly with fixed order to avoid path conflicts
	r.HandleFunc("/health", healthCheckHandler).Methods("GET")
	r.HandleFunc("/models/categorized", getCategorizedModelsHandler).Methods("GET")
	r.HandleFunc("/models/structured", getStructuredModelsHandler).Methods("GET")
	r.HandleFunc("/models/register", registerModelHandler).Methods("POST")
	r.HandleFunc("/models/reload", reloadModelsHandler).Methods("POST")
	r.HandleFunc("/models", getProvidersHandler).Methods("GET")
	r.HandleFunc("/models/{provider}", getProviderModelsHandler).Methods("GET")

	// Add CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	// Start server
	port := cfg.Port
	fmt.Printf("Model Categorizer microservice running on port %s...\n", port)
	log.Printf("Configured providers: OpenAI=%v, Anthropic=%v, Gemini=%v, OpenRouter=%v",
		providerManager.OpenAI.APIKey != "",
		providerManager.Anthropic.APIKey != "",
		providerManager.Gemini.APIKey != "",
		providerManager.OpenRouter.APIKey != "")
	log.Fatal(http.ListenAndServe(":"+port, c.Handler(r)))
}
