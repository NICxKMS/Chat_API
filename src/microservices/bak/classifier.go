package classifiers

import (
	"strconv"
	"strings"
	"time"
)

// ModelClassifier helps efficiently classify models using a single compiled pattern matching approach
type ModelClassifier struct {
	// Pre-compiled patterns for different model attributes
	ImageGenPatterns   []string
	FamilyPatterns     map[string][]string
	TypePatterns       map[string][]string
	CapabilityPatterns map[string][]string

	// Maps for direct lookup
	DefaultModels   map[string]bool
	ProviderAliases map[string]string
}

// NewModelClassifier creates and initializes a model classifier
func NewModelClassifier() *ModelClassifier {
	mc := &ModelClassifier{
		// Image generation model patterns
		ImageGenPatterns: []string{
			"dall-e", "imagen", "midjourney", "stable-diffusion",
		},

		// Family classification patterns
		FamilyPatterns: map[string][]string{
			"O Series":   {"o1"},
			"GPT-4":      {"gpt-4", "gpt-4o"},
			"GPT-3.5":    {"gpt-3.5"},
			"Claude 3.7": {"claude-3.7"},
			"Claude 3.5": {"claude-3.5"},
			"Claude 3":   {"claude-3"},
			"Sonnet":     {"sonnet"},
			"Haiku":      {"haiku"},
			"Opus":       {"opus"},
			"Claude 2":   {"claude-2"},
			"Claude 1":   {"claude-1", "claude-instant"},
			"Claude":     {"claude"},
			"Flash Lite": {"flash-lite", "flash lite"},
			"Flash":      {"flash"},
			"Pro":        {"pro"},
			"Ultra":      {"ultra"},
			"Thinking":   {"thinking"},
			"Vision":     {"vision"},
			"LLaMA":      {"llama", "hermes"},
			"Mistral":    {"mistral", "mixtral"},
			"PaLM":       {"palm"},
			"Gemini":     {"gemini"},
			"DALL-E":     {"dall-e"},
			"Embeddings": {"embedding", "embed"},
			"Whisper":    {"whisper"},
			"TTS":        {"tts"},
		},

		// Type classification patterns
		TypePatterns: map[string][]string{
			"Multimodal":       {"vision", "vl", "visual"},
			"Turbo":            {"turbo"},
			"O1 Mini":          {"o1-mini"},
			"O1":               {"o1"},
			"GPT-4o Mini":      {"gpt-4o-mini"},
			"GPT-4o":           {"gpt-4o"},
			"O-Series":         {"o1", "gpt-4o"},
			"GPT-4.5":          {"gpt-4.5"},
			"Opus":             {"opus"},
			"Sonnet":           {"sonnet"},
			"Haiku":            {"haiku"},
			"Instant":          {"instant"},
			"Gemini 1.0":       {"gemini-1.0"},
			"Gemini 1.5":       {"gemini-1.5"},
			"Gemini 2.0":       {"gemini-2.0"},
			"Gemini 2.5":       {"gemini-2.5"},
			"Standard":         {"standard"},
			"Vision":           {"vision"},
			"Flash":            {"flash"},
			"Pro":              {"pro"},
			"Ultra":            {"ultra"},
			"Thinking":         {"thinking"},
			"Image Generation": {"dall-e"},
			"Embedding":        {"embedding", "embed"},
			"Speech":           {"whisper", "speech-to-text"},
			"Text-to-Speech":   {"tts"},
			"Transcribe":       {"transcribe"},
		},

		// Capability patterns
		CapabilityPatterns: map[string][]string{
			"vision":           {"vision", "visual", "vl", "image"},
			"function-calling": {"function", "tool", "api"},
			"code":             {"code", "programming", "developer"},
			"search":           {"search", "browse", "web"},
			"embedding":        {"embedding", "embed"},
			"embeddings":       {"embedding", "embed"},
			"audio":            {"audio", "voice", "speech", "whisper", "tts"},
			"image-generation": {"dall-e", "image-gen", "imagen"},
			"json-mode":        {"json"},
			"speech-to-text":   {"whisper", "speech-to-text", "stt"},
			"text-to-speech":   {"tts", "text-to-speech"},
			"transcribe":       {"transcribe"},
		},

		// Default model names for quick lookup
		DefaultModels: map[string]bool{
			// OpenAI models
			"gpt-4o":                 true,
			"gpt-4":                  true,
			"gpt-3.5-turbo":          true,
			"o1":                     true,
			"o1-mini":                true,
			"gpt-4o-mini":            true,
			"gpt-4o-mini-tts":        true,
			"gpt-4o-transcribe":      true,
			"gpt-4o-mini-transcribe": true,
			"dall-e-3":               true,
			"dall-e-2":               true,
			"text-embedding-3-large": true,
			"text-embedding-3-small": true,
			"text-embedding-ada-002": true,
			"whisper-1":              true,

			// Gemini models
			"gemini-1.0-pro":        true,
			"gemini-1.5-pro":        true,
			"gemini-1.5-flash":      true,
			"gemini-1.5-flash-lite": true,
			"gemini-2.0-pro":        true,
			"gemini-2.0-flash":      true,
			"gemini-2.0-ultra":      true,
			"gemini-2.0-thinking":   true,
			"gemini-2.0-vision":     true,
			"gemini-2.5-pro":        true,
			"gemini-2.5-flash":      true,

			// Anthropic models
			"claude-3-opus":   true,
			"claude-3-sonnet": true,
			"claude-3-haiku":  true,
			"claude-3.5":      true,
			"claude-3.7":      true,
			"claude-2":        true,
			"claude-instant":  true,

			// Mistral models
			"mistral-tiny":    true,
			"mistral-small":   true,
			"mistral-medium":  true,
			"mistral-large":   true,
			"mistral-large-2": true,
			"mixtral-8x7b":    true,

			// Meta/LLaMA models
			"llama-3-8b":   true,
			"llama-3-70b":  true,
			"llama-3-405b": true,
			"llama-2-7b":   true,
			"llama-2-13b":  true,
			"llama-2-70b":  true,
		},

		// Provider alias mapping
		ProviderAliases: map[string]string{
			"openai":     "openai",
			"anthropic":  "anthropic",
			"claude":     "anthropic",
			"gemini":     "gemini",
			"google":     "gemini",
			"mistral":    "mistral",
			"mistralai":  "mistral",
			"llama":      "meta",
			"meta":       "meta",
			"meta-llama": "meta",
			"cohere":     "cohere",
			"stability":  "stability",
		},
	}

	return mc
}

// IsDefaultModelName checks if a model is a default/canonical version
func (mc *ModelClassifier) IsDefaultModelName(modelID string) bool {
	return mc.DefaultModels[modelID] || strings.Contains(modelID, "latest")
}

// IsImageGenerationModel checks if a model is for image generation
func (mc *ModelClassifier) IsImageGenerationModel(modelID string) bool {
	modelLower := strings.ToLower(modelID)

	// Check for exact pattern matches
	for _, pattern := range mc.ImageGenPatterns {
		if strings.Contains(modelLower, pattern) {
			return true
		}
	}

	// Check for the "image generation" pattern
	return strings.Contains(modelLower, "image") && strings.Contains(modelLower, "generat")
}

// DetermineModelFamily determines the model family based on patterns
func (mc *ModelClassifier) DetermineModelFamily(modelName, provider string) string {
	modelLower := strings.ToLower(modelName)
	providerLower := strings.ToLower(provider)

	// Handle specific families first to avoid pattern conflicts

	// Special case for embeddings
	if strings.Contains(modelLower, "embedding") || strings.Contains(modelLower, "embed") {
		return "Embeddings"
	}

	// Special case for DALL-E
	if strings.Contains(modelLower, "dall-e") {
		return "DALL-E"
	}

	// Special case for Whisper
	if strings.Contains(modelLower, "whisper") {
		return "Whisper"
	}

	// Special case for TTS
	if strings.Contains(modelLower, "tts") {
		return "TTS"
	}

	// Check for image generation models
	if mc.IsImageGenerationModel(modelLower) {
		return "Image Generation"
	}

	// Normalize model name if it's from OpenRouter
	if providerLower == "openrouter" {
		parts := strings.SplitN(modelLower, "/", 2)
		if len(parts) == 2 {
			subProvider := strings.ToLower(parts[0])
			if _, exists := mc.ProviderAliases[subProvider]; exists {
				modelLower = parts[1]
			}
		}
	}

	// Look for family matches in preferred order
	for family, patterns := range mc.FamilyPatterns {
		for _, pattern := range patterns {
			if strings.Contains(modelLower, pattern) {
				// Special case for determining Claude family more precisely
				if family == "Claude" || family == "Claude 1" || family == "Claude 2" || family == "Claude 3" {
					// Already have specific versions detected
					if strings.Contains(modelLower, "claude-3.7") {
						return "Claude 3.7"
					} else if strings.Contains(modelLower, "claude-3.5") {
						return "Claude 3.5"
					} else if strings.Contains(modelLower, "claude-3") {
						if strings.Contains(modelLower, "sonnet") {
							return "Sonnet"
						} else if strings.Contains(modelLower, "haiku") {
							return "Haiku"
						} else if strings.Contains(modelLower, "opus") {
							return "Opus"
						}
						return "Claude 3"
					} else if strings.Contains(modelLower, "claude-2") {
						return "Claude 2"
					} else if strings.Contains(modelLower, "claude-1") || strings.Contains(modelLower, "claude-instant") {
						return "Claude 1"
					}
				}

				// Special case for GPT-4 family
				if family == "GPT-4" && (strings.Contains(modelLower, "gpt-4o") || strings.Contains(modelLower, "o1")) {
					return "O Series"
				}

				// Special case for Gemini with more complex matching
				if pattern == "flash" && strings.Contains(modelLower, "flash-lite") {
					return "Flash Lite"
				}

				return family
			}
		}
	}

	return "Other"
}

// DetermineModelType determines the model type based on patterns
func (mc *ModelClassifier) DetermineModelType(modelName, family, provider string) string {
	modelLower := strings.ToLower(modelName)
	providerLower := strings.ToLower(provider)

	// Handle specific types for certain providers/families

	// Image Generation type
	if family == "DALL-E" || family == "Image Generation" {
		return "Image Generation"
	}

	// Embedding type
	if family == "Embeddings" {
		return "Embedding"
	}

	// Speech type
	if family == "Whisper" {
		return "Speech"
	}

	// TTS type
	if family == "TTS" {
		return "Text-to-Speech"
	}

	// Special handling for O Series (GPT-4o/o1)
	if family == "O Series" {
		if strings.Contains(modelLower, "o1-mini") {
			return "O1 Mini"
		} else if strings.Contains(modelLower, "o1") {
			return "O1"
		} else if strings.Contains(modelLower, "gpt-4o-mini") {
			return "GPT-4o Mini"
		} else if strings.Contains(modelLower, "gpt-4o") {
			return "GPT-4o"
		}

		// Default for O Series is O-Series
		return "O-Series"
	}

	// Check for specific capabilities that determine type
	if strings.Contains(modelLower, "transcribe") {
		return "Transcribe"
	}

	// Check for multimodal capabilities
	for _, pattern := range mc.TypePatterns["Multimodal"] {
		if strings.Contains(modelLower, pattern) {
			return "Multimodal"
		}
	}

	// Check provider-specific patterns
	switch {
	case providerLower == "openai" || strings.Contains(providerLower, "gpt"):
		for typeName, patterns := range mc.TypePatterns {
			if typeName == "Multimodal" ||
				typeName == "Embedding" ||
				typeName == "Image Generation" ||
				typeName == "Speech" ||
				typeName == "Text-to-Speech" {
				continue // Already checked special cases
			}

			for _, pattern := range patterns {
				if strings.Contains(modelLower, pattern) {
					return typeName
				}
			}
		}

	case providerLower == "anthropic" || strings.Contains(providerLower, "claude"):
		for _, typeName := range []string{"Opus", "Sonnet", "Haiku", "Instant"} {
			for _, pattern := range mc.TypePatterns[typeName] {
				if strings.Contains(modelLower, pattern) {
					return typeName
				}
			}
		}

	case providerLower == "gemini":
		// Check for Gemini version patterns (1.0, 1.5, etc.)
		for typeName, patterns := range mc.TypePatterns {
			if strings.HasPrefix(typeName, "Gemini") {
				for _, pattern := range patterns {
					if strings.Contains(modelLower, pattern) {
						return typeName
					}
				}
			}
		}

		// Check for Gemini model types
		for _, typeName := range []string{"Pro", "Flash", "Flash Lite", "Ultra", "Thinking", "Vision"} {
			for _, pattern := range mc.TypePatterns[typeName] {
				if strings.Contains(modelLower, pattern) {
					return typeName
				}
			}
		}
		return "Gemini"

	case providerLower == "mistral" || strings.Contains(providerLower, "mistral"):
		// Check for specific Mistral model types
		if strings.Contains(modelLower, "large") {
			return "Large"
		} else if strings.Contains(modelLower, "medium") {
			return "Medium"
		} else if strings.Contains(modelLower, "small") {
			return "Small"
		} else if strings.Contains(modelLower, "tiny") {
			return "Tiny"
		} else if strings.Contains(modelLower, "mixtral") {
			return "Mixtral"
		}
		return "Standard"

	case providerLower == "meta" || strings.Contains(providerLower, "llama"):
		// Check for LLaMA model types
		if strings.Contains(modelLower, "llama-3") {
			return "LLaMA 3"
		} else if strings.Contains(modelLower, "llama-2") {
			return "LLaMA 2"
		}
		return "LLM"

	case providerLower == "openrouter":
		return "LLM"
	}

	return "Standard"
}

// DetectCapabilities infers model capabilities from name and metadata
func (mc *ModelClassifier) DetectCapabilities(modelName string, existingCaps []string) []string {
	// If we already have capabilities, use those
	if len(existingCaps) > 0 {
		return existingCaps
	}

	modelLower := strings.ToLower(modelName)
	var capabilities []string

	// Check for known capability patterns
	for capability, patterns := range mc.CapabilityPatterns {
		for _, pattern := range patterns {
			if strings.Contains(modelLower, pattern) {
				capabilities = append(capabilities, capability)
				break // Only add each capability once
			}
		}
	}

	// Add specific capabilities based on direct model type identification

	// Special handling for DALL-E models
	if strings.Contains(modelLower, "dall-e") {
		addCapabilityIfMissing(&capabilities, "image-generation")
	}

	// Special handling for embedding models
	if strings.Contains(modelLower, "embedding") || strings.Contains(modelLower, "embed") {
		addCapabilityIfMissing(&capabilities, "embeddings")
	}

	// Special handling for Whisper models
	if strings.Contains(modelLower, "whisper") {
		addCapabilityIfMissing(&capabilities, "speech-to-text")
	}

	// Special handling for TTS models
	if strings.Contains(modelLower, "tts") {
		addCapabilityIfMissing(&capabilities, "text-to-speech")
	}

	// Special handling for transcribe models
	if strings.Contains(modelLower, "transcribe") {
		addCapabilityIfMissing(&capabilities, "transcribe")
	}

	// Check for vision/multimodal capabilities
	if strings.Contains(modelLower, "vision") ||
		strings.Contains(modelLower, "visual") ||
		strings.Contains(modelLower, "-vl") ||
		strings.Contains(modelLower, "gpt-4o") ||
		strings.Contains(modelLower, "claude-3") ||
		strings.Contains(modelLower, "claude-3.5") ||
		strings.Contains(modelLower, "claude-3.7") ||
		strings.Contains(modelLower, "gemini") {
		addCapabilityIfMissing(&capabilities, "vision")
	}

	// Check for function calling capabilities
	if strings.Contains(modelLower, "gpt-4") ||
		strings.Contains(modelLower, "gpt-3.5") ||
		strings.Contains(modelLower, "o1") ||
		strings.Contains(modelLower, "claude-3") ||
		strings.Contains(modelLower, "claude-3.5") ||
		strings.Contains(modelLower, "claude-3.7") ||
		strings.Contains(modelLower, "gemini") ||
		strings.Contains(modelLower, "llama-3") ||
		strings.Contains(modelLower, "mistral-large") ||
		strings.Contains(modelLower, "mistral-medium") {
		addCapabilityIfMissing(&capabilities, "function-calling")
	}

	// Check for JSON mode capabilities (OpenAI models primarily)
	if strings.Contains(modelLower, "gpt-4") ||
		strings.Contains(modelLower, "gpt-3.5") ||
		strings.Contains(modelLower, "o1") {
		addCapabilityIfMissing(&capabilities, "json-mode")
	}

	// Check for code capabilities
	if strings.Contains(modelLower, "gpt-4") ||
		strings.Contains(modelLower, "claude-3") ||
		strings.Contains(modelLower, "claude-3.5") ||
		strings.Contains(modelLower, "claude-3.7") ||
		strings.Contains(modelLower, "gemini") ||
		strings.Contains(modelLower, "llama-3") ||
		strings.Contains(modelLower, "mistral-large") ||
		strings.Contains(modelLower, "mistral-medium") ||
		strings.Contains(modelLower, "codellama") ||
		strings.Contains(modelLower, "code-") {
		addCapabilityIfMissing(&capabilities, "code")
	}

	return capabilities
}

// Helper function to add a capability if it doesn't already exist
func addCapabilityIfMissing(capabilities *[]string, capability string) {
	for _, cap := range *capabilities {
		if cap == capability {
			return // Already exists
		}
	}
	*capabilities = append(*capabilities, capability)
}

// NormalizeModelName removes provider prefixes from OpenRouter model IDs
func NormalizeModelName(modelID, provider string) string {
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

// ExtractVersionNumbers extracts numeric parts from version strings
func ExtractVersionNumbers(version string) []int {
	var numbers []int
	var currentNumber string

	for _, c := range version {
		if c >= '0' && c <= '9' {
			currentNumber += string(c)
		} else if currentNumber != "" {
			if num, err := ParseVersionPart(currentNumber); err == nil {
				numbers = append(numbers, num)
			}
			currentNumber = ""
		}
	}

	// Don't forget the last number
	if currentNumber != "" {
		if num, err := ParseVersionPart(currentNumber); err == nil {
			numbers = append(numbers, num)
		}
	}

	return numbers
}

// ParseVersionPart safely parses a version part to an integer
func ParseVersionPart(part string) (int, error) {
	return strconv.Atoi(part)
}
