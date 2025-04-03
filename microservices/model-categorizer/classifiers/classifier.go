package classifiers

import (
	"strconv"
	"strings"
	"time"
)

// Constants for model organization
const (
	// Providers
	ProviderOpenAI     = "openai"
	ProviderAnthropicA = "anthropic"
	ProviderGemini     = "gemini"
	ProviderMeta       = "meta"
	ProviderMistral    = "mistral"
	ProviderOther      = "other"

	// Series
	SeriesClaude3 = "Claude 3"
	SeriesClaude2 = "Claude 2"
	SeriesClaude1 = "Claude 1"

	// OpenAI Types
	TypeO    = "O Series"
	Type35   = "GPT 3.5"
	Type4    = "GPT 4"
	Type45   = "GPT 4.5"
	TypeMini = "Mini"

	// Other Types
	TypeOpus      = "Opus"
	TypeSonnet    = "Sonnet"
	TypeHaiku     = "Haiku"
	TypeThinking  = "Thinking"
	TypePro       = "Pro"
	TypeGemma     = "Gemma"
	TypeFlashLite = "Flash Lite"
	TypeFlash     = "Flash"
	TypeVision    = "Vision"
	TypeStandard  = "Standard"
	TypeEmbedding = "Embedding"
	TypeImage     = "Image Generation"

	// Version constants for improved consistency
	Version10 = "1.0"
	Version15 = "1.5"
	Version20 = "2.0"
	Version25 = "2.5"
	Version30 = "3.0"
	Version35 = "3.5"
	Version37 = "3.7"
	Version40 = "4.0"
	Version45 = "4.5"

	// Capabilities
	CapVision          = "vision"
	CapFunctionCalling = "function-calling"
	CapEmbedding       = "embedding"
	CapChat            = "chat"
)

// ModelMetadata contains organized model information
type ModelMetadata struct {
	Provider       string
	Series         string
	Type           string
	Variant        string
	Context        int
	Capabilities   []string
	IsMultimodal   bool
	IsExperimental bool
	DisplayName    string
}

// ModelClassifier helps efficiently classify models
type ModelClassifier struct {
	patterns *PatternMatcher
	context  *ContextResolver
	defaults *DefaultModels
}

// NewModelClassifier creates a new model classifier with improved hierarchical patterns
func NewModelClassifier() *ModelClassifier {
	return &ModelClassifier{
		patterns: NewPatternMatcher(),
		context:  NewContextResolver(),
		defaults: NewDefaultModels(),
	}
}

// ClassifyModel takes a model name and returns a structured metadata object
func (mc *ModelClassifier) ClassifyModel(modelName, providerHint string) ModelMetadata {
	origName := modelName
	modelLower := strings.ToLower(modelName)
	var metadata ModelMetadata
	if mc.isImageGenerationModel(modelLower) {
		metadata = mc.createImageGenerationMetadata(modelLower, providerHint)
	} else if mc.isEmbeddingModel(modelLower) {
		metadata = mc.createEmbeddingModelMetadata(modelLower, providerHint)
	} else {
		metadata = mc.buildStandardModelMetadata(modelLower, providerHint)
	}
	metadata.DisplayName = strings.ReplaceAll(origName, "-", " ")
	return metadata
}

// createImageGenerationMetadata creates metadata for image generation models
func (mc *ModelClassifier) createImageGenerationMetadata(modelName, providerHint string) ModelMetadata {
	return ModelMetadata{
		Provider:     mc.determineProvider(modelName, providerHint),
		Series:       TypeImage,
		Type:         TypeImage,
		Variant:      "Image Generation",
		Capabilities: []string{TypeImage},
		IsMultimodal: false,
	}
}

// createEmbeddingModelMetadata creates metadata for embedding models
func (mc *ModelClassifier) createEmbeddingModelMetadata(modelName, providerHint string) ModelMetadata {
	return ModelMetadata{
		Provider:     mc.determineProvider(modelName, providerHint),
		Series:       TypeEmbedding,
		Type:         TypeEmbedding,
		Variant:      "Embedding",
		Capabilities: []string{CapEmbedding},
		IsMultimodal: false,
	}
}

// buildStandardModelMetadata builds metadata for standard LLM models
func (mc *ModelClassifier) buildStandardModelMetadata(modelName, providerHint string) ModelMetadata {
	// Start with empty metadata
	metadata := ModelMetadata{
		Provider:     mc.determineProvider(modelName, providerHint),
		Capabilities: []string{},
	}

	// Determine series based on provider
	metadata.Series = mc.determineSeries(modelName, metadata.Provider)

	// Determine type based on provider and series
	metadata.Type = mc.determineType(modelName, metadata.Provider, metadata.Series)

	// Determine variant (version)
	metadata.Variant = mc.determineVariant(modelName, metadata.Provider, metadata.Series)

	// Determine context size
	metadata.Context = mc.getContextSize(modelName)

	// Determine capabilities
	metadata.Capabilities = mc.detectCapabilities(modelName, metadata.Provider, metadata.Series)

	// Set multimodal flag
	metadata.IsMultimodal = mc.isMultimodal(modelName, metadata.Capabilities, metadata.Series)

	// Set experimental flag
	metadata.IsExperimental = mc.isExperimental(modelName)

	return metadata
}

// determineProvider identifies the model provider from name
func (mc *ModelClassifier) determineProvider(modelName, providerHint string) string {
	// Check provider hint first if provided
	if providerHint != "" {
		providerLower := strings.ToLower(providerHint)
		if provider := mc.patterns.matchProviderByName(providerLower); provider != "" {
			return provider
		}
	}

	// Handle OpenRouter prefix: "provider/model"
	if strings.Contains(modelName, "/") {
		parts := strings.SplitN(modelName, "/", 2)
		potentialProvider := strings.ToLower(parts[0])
		if provider := mc.patterns.matchProviderByName(potentialProvider); provider != "" {
			return provider
		}
	}

	// Match provider by patterns
	if provider := mc.patterns.matchProviderByPattern(modelName); provider != "" {
		return provider
	}

	// Default provider if none matched
	return ProviderOther
}

// determineSeries identifies the model series based on name and provider
func (mc *ModelClassifier) determineSeries(modelName, provider string) string {
	// Provider-specific series determination
	switch provider {
	case ProviderOpenAI:
		if modelName[0] == 'o' {
			return "O"
		}
		if modelName[0] == 'g' {
			return "GPT"
		}
		if modelName[0] == 'd' {
			return "DALL-E"
		}
	case ProviderAnthropicA:
		if series := mc.patterns.matchClaudeVersion(modelName); series != "" {
			return series
		}

	case ProviderGemini:
		return mc.patterns.matchGeminiVersion(modelName)
	}

	// Generic fallback series detection
	if series := mc.patterns.matchSeriesByPattern(modelName); series != "" {
		return series
	}

	// Default series if none matched
	return "General"
}

// determineType identifies the model type based on name, provider and series
func (mc *ModelClassifier) determineType(modelName, provider, series string) string {
	modelLower := strings.ToLower(modelName)

	// Provider-specific type determination
	switch provider {
	case ProviderOpenAI:
		return mc.patterns.matchOpenAIType(modelLower)

	case ProviderAnthropicA:
		return mc.patterns.matchAnthropicType(modelLower)

	case ProviderGemini:
		return mc.patterns.matchGeminiType(modelLower)
	}

	// Generic type detection based on patterns
	if type_ := mc.patterns.matchTypeByPattern(modelLower); type_ != "" {
		return type_
	}

	// Default type if none matched
	return TypeStandard
}

// determineVariant extracts specific version information
func (mc *ModelClassifier) determineVariant(modelName, provider, series string) string {
	modelLower := strings.ToLower(modelName)

	// Provider-specific variant detection
	switch provider {
	case ProviderOpenAI:
		if variant := mc.patterns.matchOpenAIVariant(modelLower); variant != "" {
			return variant
		}

	case ProviderAnthropicA:
		if variant := mc.patterns.matchAnthropicVariant(modelLower); variant != "" {
			return variant
		}

	case ProviderGemini:
		if variant := mc.patterns.buildGeminiVariant(modelLower); variant != "" {
			return variant
		}
	}

	// If we couldn't determine a specific variant, try to extract version info
	if variant := extractVersionVariant(modelName, series); variant != "" {
		return variant
	}

	// Default to series name if no specific variant is found
	return series
}

// detectCapabilities identifies model capabilities from the model name
func (mc *ModelClassifier) detectCapabilities(modelName, provider, series string) []string {
	capabilities := make(map[string]bool)
	modelLower := strings.ToLower(modelName)

	// Get model type for provider-specific rules
	modelType := mc.determineType(modelLower, provider, series)

	// Add capabilities based on model traits
	mc.patterns.addCapabilities(capabilities, modelType, modelLower, provider, series)

	// Chat capability for all models (default)
	capabilities[CapChat] = true

	// Convert map to slice
	result := make([]string, 0, len(capabilities))
	for cap := range capabilities {
		result = append(result, cap)
	}

	return result
}

// isEmbeddingModel checks if a model is for embeddings
func (mc *ModelClassifier) isEmbeddingModel(modelName string) bool {
	modelLower := strings.ToLower(modelName)
	return strings.Contains(modelLower, "embedding") ||
		strings.Contains(modelLower, "embed") ||
		strings.Contains(modelLower, "text-embedding")
}

// isImageGenerationModel checks if a model is for image generation
func (mc *ModelClassifier) isImageGenerationModel(modelName string) bool {
	modelLower := strings.ToLower(modelName)
	return strings.Contains(modelLower, "dall-e") ||
		strings.Contains(modelLower, "image") ||
		strings.Contains(modelLower, "midjourney") ||
		strings.Contains(modelLower, "stable-diffusion")
}

// isMultimodal determines if a model has multimodal capabilities
func (mc *ModelClassifier) isMultimodal(modelName string, capabilities []string, series string) bool {
	// Check in capabilities
	for _, cap := range capabilities {
		if cap == CapVision {
			return true
		}
	}

	// Extract model type from name to handle models
	modelLower := strings.ToLower(modelName)
	modelType := mc.determineType(modelLower, mc.determineProvider(modelLower, ""), series)

	// Check for multimodal capabilities based on type and series
	if modelType == Type4 || modelType == Type45 || modelType == TypeO ||
		series == SeriesClaude3 || strings.Contains(series, "Gemini") {
		return true
	}

	// Check model name
	return strings.Contains(modelLower, "vision") ||
		strings.Contains(modelLower, "multimodal")
}

// isExperimental checks if a model is experimental
func (mc *ModelClassifier) isExperimental(modelName string) bool {
	modelLower := strings.ToLower(modelName)
	return strings.Contains(modelLower, "experimental") ||
		strings.Contains(modelLower, "preview") ||
		strings.Contains(modelLower, "alpha") ||
		strings.Contains(modelLower, "beta")
}

// IsDefaultModelName checks if a model is a default version
func (mc *ModelClassifier) IsDefaultModelName(modelName string) bool {
	return mc.defaults.isDefault(modelName) ||
		strings.Contains(strings.ToLower(modelName), "latest")
}

// getContextSize determines a model's context window based on its name
func (mc *ModelClassifier) getContextSize(modelName string) int {
	return mc.context.getContextSize(modelName)
}

// GetModelHierarchy returns hierarchy information (provider, series, type, variant)
func (mc *ModelClassifier) GetModelHierarchy(modelName string, provider string) (string, string, string, string) {
	metadata := mc.ClassifyModel(modelName, provider)
	return metadata.Provider, metadata.Series, metadata.Type, metadata.Variant
}

// GetSeriesAndVariant (maintained for backward compatibility)
func GetSeriesAndVariant(modelName string) (string, string) {
	classifier := NewModelClassifier()
	metadata := classifier.ClassifyModel(modelName, "")
	return metadata.Series, metadata.Variant
}

// NormalizeModelName removes provider prefixes from OpenRouter model IDs
func NormalizeModelName(modelID, provider string) string {
	// Handle OpenRouter models which often contain provider names
	if strings.ToLower(provider) == "openrouter" {
		// Remove provider prefixes like "anthropic/" or "openai/"
		parts := strings.SplitN(modelID, "/", 2)
		if len(parts) == 2 {
			// List of known providers
			knownProviders := []string{"anthropic", "openai", "google", "meta-llama", "mistralai"}
			subProvider := strings.ToLower(parts[0])

			for _, provider := range knownProviders {
				if subProvider == provider {
					return parts[1]
				}
			}
		}
	}
	return modelID
}

// extractVersionVariant extracts version info from a model name
func extractVersionVariant(modelName, series string) string {
	versionNumbers := ExtractVersionNumbers(modelName)

	if len(versionNumbers) > 0 {
		versionStr := strings.Join(strings.Fields(strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' || r == '.' {
				return r
			}
			return ' '
		}, modelName)), ".")

		if versionStr != "" {
			return series + " " + versionStr
		}
	}

	return ""
}

// ExtractVersionNumbers extracts numeric parts from version strings
func ExtractVersionNumbers(version string) []int {
	var numbers []int
	var currentNumber string

	for _, c := range version {
		if c >= '0' && c <= '9' {
			currentNumber += string(c)
		} else if currentNumber != "" {
			if num, err := strconv.Atoi(currentNumber); err == nil {
				numbers = append(numbers, num)
			}
			currentNumber = ""
		}
	}

	// Add the last number
	if currentNumber != "" {
		if num, err := strconv.Atoi(currentNumber); err == nil {
			numbers = append(numbers, num)
		}
	}

	return numbers
}

// IsNewerVersion compares version strings to determine if a is newer than b
func IsNewerVersion(a, b string) bool {
	// Handle date-based version strings (like "20240307")
	aDate, aErr := time.Parse("20060102", a)
	bDate, bErr := time.Parse("20060102", b)

	// If both are dates, compare them
	if aErr == nil && bErr == nil {
		return aDate.After(bDate)
	}

	// Extract numeric version parts if present
	aParts := ExtractVersionNumbers(a)
	bParts := ExtractVersionNumbers(b)

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

	// If one is a date and the other isn't, date is newer
	if aErr == nil {
		return true
	}
	if bErr == nil {
		return false
	}

	// Fallback to string comparison
	return a > b
}

// GetStandardizedVersion returns a standardized version string from a model name
func (mc *ModelClassifier) GetStandardizedVersion(modelName string) string {
	// Convert to lowercase for consistent matching
	modelLower := strings.ToLower(modelName)

	// Check for specific version numbers
	if strings.Contains(modelLower, "4.5") {
		return Version45
	} else if strings.Contains(modelLower, "4.0") || strings.Contains(modelLower, "4o") {
		return Version40
	} else if strings.Contains(modelLower, "3.7") {
		return Version37
	} else if strings.Contains(modelLower, "3.5") {
		return Version35
	} else if strings.Contains(modelLower, "3.0") {
		return Version30
	} else if strings.Contains(modelLower, "2.5") {
		return Version25
	} else if strings.Contains(modelLower, "2.0") {
		return Version20
	} else if strings.Contains(modelLower, "1.5") {
		return Version15
	} else if strings.Contains(modelLower, "1.0") {
		return Version10
	}

	// If no version is identified, return empty string
	return ""
}
