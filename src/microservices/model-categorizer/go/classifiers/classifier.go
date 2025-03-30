package classifiers

import (
	"strconv"
	"strings"
	"time"
)

// Constants for common model types and capabilities
const (
	// Model families
	FamilyGPT4      = "gpt-4"
	FamilyGPT35     = "gpt-3.5"
	FamilyClaude3   = "Claude 3"
	FamilyClaude2   = "Claude 2"
	FamilyClaude1   = "Claude 1"
	FamilyGemini    = "Gemini"
	FamilyLlama     = "llama"
	FamilyMistral   = "mistral"
	FamilyEmbedding = "Embedding"
	FamilyOther     = "Other"

	// Model types
	TypeMultimodal = "Multimodal"
	TypeVision     = "Vision"
	TypeEmbedding  = "Embedding"
	TypeStandard   = "Standard"
	TypePro        = "Pro"
	TypeFlash      = "Flash"
	TypeLLM        = "LLM"

	// Capabilities
	CapVision          = "vision"
	CapFunctionCalling = "function-calling"
	CapEmbedding       = "embedding"
	CapChat            = "chat"
)

// modelClassifier helps efficiently classify models using a single compiled pattern matching approach
type ModelClassifier struct {
	// Pre-compiled patterns for different model attributes
	imageGenPatterns   []string
	familyPatterns     map[string][]string
	typePatterns       map[string][]string
	capabilityPatterns map[string][]string

	// Maps for direct lookup
	defaultModels   map[string]bool
	providerAliases map[string]string
}

// NewModelClassifier creates a new model classifier with default patterns
func NewModelClassifier() *ModelClassifier {
	// Initialize patterns for different model families
	familyPatterns := map[string][]string{
		FamilyGPT4:      {"gpt-4", "gpt4", "gpt-4o", "gpt-4-turbo"},
		FamilyGPT35:     {"gpt-3.5", "gpt3.5", "gpt-3.5-turbo"},
		FamilyClaude3:   {"claude-3", "claude3", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3.7", "claude-3.5"},
		FamilyClaude2:   {"claude-2", "claude2"},
		FamilyClaude1:   {"claude-1", "claude1", "claude-instant"},
		FamilyGemini:    {"gemini", "gemini-pro", "gemini-flash", "gemini-1.0", "gemini-1.5", "gemini-2.0"},
		FamilyLlama:     {"llama", "meta-llama"},
		FamilyMistral:   {"mistral", "mixtral"},
		"falcon":        {"falcon"},
		"palm":          {"palm", "text-bison"},
		FamilyEmbedding: {"embedding", "text-embedding", "embed"},
		TypeVision:      {"vision", "dall-e", "imagen", "midjourney"},
	}

	// Initialize patterns for different model types
	typePatterns := map[string][]string{
		TypeVision:    {"vision", "image", "multimodal", "dall-e"},
		TypeLLM:       {"turbo", "pro", "opus", "sonnet", "haiku"},
		TypeEmbedding: {"embedding", "embed", "text-embedding"},
		"audio":       {"whisper", "tts", "audio", "speech"},
	}

	// Initialize patterns for different capabilities
	capabilityPatterns := map[string][]string{
		CapVision:          {"vision", "image", "-v", "multimodal", "dall-e"},
		CapFunctionCalling: {"function", "tool", "api"},
		CapEmbedding:       {"embedding", "embed", "vector"},
		"streaming":        {"stream"},
		"audio":            {"whisper", "tts", "speech", "audio"},
		CapChat:            {"gpt", "claude", "gemini", "llama", "mistral"},
	}

	// Known default model names, used for matching "latest" models
	defaultModels := map[string]bool{
		"gpt-3.5-turbo":     true,
		"gpt-4":             true,
		"claude-instant":    true,
		"claude-2":          true,
		"claude-3-opus":     true,
		"gemini-pro":        true,
		"gemini-pro-vision": true,
		"gemini-1.5-pro":    true,
		"gemini-1.5-flash":  true,
		"gemini-2.0-pro":    true,
		"gemini-2.0-flash":  true,
	}

	// Provider name aliases for normalization
	providerAliases := map[string]string{
		"google":     "gemini",
		"gpt":        "openai",
		"openai":     "openai",
		"claude":     "anthropic",
		"anthropic":  "anthropic",
		"meta":       "meta",
		"llama":      "meta",
		"meta-llama": "meta",
		"mistral":    "mistral",
	}

	return &ModelClassifier{
		familyPatterns:     familyPatterns,
		typePatterns:       typePatterns,
		capabilityPatterns: capabilityPatterns,
		defaultModels:      defaultModels,
		providerAliases:    providerAliases,
		imageGenPatterns:   []string{"dalle", "dall-e", "image", "img", "imagen", "midjourney"},
	}
}

// IsDefaultModelName checks if a model is a default/canonical version
func (mc *ModelClassifier) IsDefaultModelName(modelID string) bool {
	return mc.defaultModels[modelID] || strings.Contains(modelID, "latest")
}

// IsImageGenerationModel checks if a model is for image generation
func (mc *ModelClassifier) IsImageGenerationModel(modelID string) bool {
	modelLower := strings.ToLower(modelID)

	// Check for exact pattern matches
	for _, pattern := range mc.imageGenPatterns {
		if strings.Contains(modelLower, pattern) {
			return true
		}
	}

	// Check for the "image generation" pattern
	return strings.Contains(modelLower, "image") && strings.Contains(modelLower, "generat")
}

// stringContainsAny checks if a string contains any of the provided patterns
func stringContainsAny(s string, patterns []string) bool {
	for _, pattern := range patterns {
		if strings.Contains(s, pattern) {
			return true
		}
	}
	return false
}

// DetermineModelFamily determines a model's family (e.g., GPT-4, Claude 3, etc.)
func (mc *ModelClassifier) DetermineModelFamily(modelName, provider string) string {
	modelLower := strings.ToLower(modelName)
	providerLower := strings.ToLower(provider)

	// Check for image generation models first
	if mc.IsImageGenerationModel(modelLower) {
		return "Image Generation"
	}

	// Normalize model name if it's from OpenRouter
	if providerLower == "openrouter" {
		parts := strings.SplitN(modelLower, "/", 2)
		if len(parts) == 2 {
			subProvider := strings.ToLower(parts[0])
			if _, exists := mc.providerAliases[subProvider]; exists {
				modelLower = parts[1]
			}
		}
	}

	// Special case for Claude models
	if strings.Contains(modelLower, "claude") {
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
			return FamilyClaude3
		} else if strings.Contains(modelLower, "claude-2") {
			return FamilyClaude2
		} else if strings.Contains(modelLower, "claude-1") || strings.Contains(modelLower, "claude-instant") {
			return FamilyClaude1
		}
		return "Claude"
	}

	// Special case for Gemini models
	if strings.Contains(modelLower, "gemini") {
		// Check specific versions first
		if strings.Contains(modelLower, "gemini-1.0") {
			return "Gemini 1.0"
		} else if strings.Contains(modelLower, "gemini-1.5") {
			return "Gemini 1.5"
		} else if strings.Contains(modelLower, "gemini-2.0") {
			return "Gemini 2.0"
		} else if strings.Contains(modelLower, "gemini-2.5") {
			return "Gemini 2.5"
		} else if strings.Contains(modelLower, "gemini-pro") {
			return FamilyGemini
		} else if strings.Contains(modelLower, "embedding") ||
			strings.Contains(modelLower, "text-embedding") {
			return "Gemini Embedding"
		}
		return FamilyGemini
	}

	// Look for family matches in patterns
	for family, patterns := range mc.familyPatterns {
		if stringContainsAny(modelLower, patterns) {
			// Special case for Flash Lite
			if family == TypeFlash && strings.Contains(modelLower, "flash-lite") {
				return "Flash Lite"
			}
			return family
		}
	}

	return FamilyOther
}

// DetermineModelType determines a model's type (e.g., Vision, Multimodal, etc.)
func (mc *ModelClassifier) DetermineModelType(modelName, family, provider string) string {
	modelLower := strings.ToLower(modelName)
	providerLower := strings.ToLower(provider)

	// Check for multimodal capabilities first
	if stringContainsAny(modelLower, mc.typePatterns[TypeMultimodal]) {
		return TypeMultimodal
	}

	// Check provider-specific patterns
	switch {
	case providerLower == "openai" || strings.Contains(providerLower, "gpt"):
		for typeName, patterns := range mc.typePatterns {
			if typeName == TypeMultimodal {
				continue // Already checked
			}
			if stringContainsAny(modelLower, patterns) {
				return typeName
			}
		}

	case providerLower == "anthropic" || strings.Contains(providerLower, "claude"):
		for _, typeName := range []string{"Opus", "Sonnet", "Haiku", "Instant"} {
			if stringContainsAny(modelLower, mc.typePatterns[typeName]) {
				return typeName
			}
		}

	case providerLower == "gemini":
		// For Gemini, determine based on model name
		if strings.Contains(modelLower, "embedding") || strings.Contains(modelLower, "text-embedding") {
			return TypeEmbedding
		} else if strings.Contains(modelLower, "flash-lite") {
			return "Flash Lite"
		} else if strings.Contains(modelLower, "flash") {
			return TypeFlash
		} else if strings.Contains(modelLower, "vision") {
			return TypeVision
		} else if strings.Contains(modelLower, "pro") {
			return TypePro
		}
		return TypeStandard

	case providerLower == "openrouter":
		return TypeLLM
	}

	return TypeStandard
}

// DetectCapabilities identifies model capabilities from the model name
func (mc *ModelClassifier) DetectCapabilities(modelName string, existingCaps []string) []string {
	// If capabilities are already detected, use those
	if len(existingCaps) > 0 {
		return existingCaps
	}

	capabilities := []string{}
	modelLower := strings.ToLower(modelName)

	// Models that should be excluded from certain capabilities
	isExcluded := strings.Contains(modelLower, "embedding") ||
		strings.Contains(modelLower, "whisper") ||
		strings.Contains(modelLower, "dall-e") ||
		strings.Contains(modelLower, "text-embedding")

	// Check for vision capabilities
	hasVisionPattern := strings.Contains(modelLower, "vision") ||
		strings.Contains(modelLower, "-v")

	hasVisionCapable := strings.Contains(modelLower, "gpt-4") && !strings.Contains(modelLower, "gpt-4-turbo") ||
		strings.Contains(modelLower, "gpt-4o") ||
		strings.Contains(modelLower, "claude-3") ||
		strings.Contains(modelLower, "claude-3.5") ||
		strings.Contains(modelLower, "claude-3.7") ||
		strings.Contains(modelLower, "gemini")

	// Add vision capability if pattern matches and not excluded
	if (hasVisionPattern || hasVisionCapable) && !isExcluded {
		capabilities = append(capabilities, CapVision)
	}

	// Check for function calling capabilities
	hasFunctionCallingCapable := strings.Contains(modelLower, "gpt-4") ||
		strings.Contains(modelLower, "gpt-3.5") ||
		strings.Contains(modelLower, "claude-3") ||
		strings.Contains(modelLower, "claude-3.5") ||
		strings.Contains(modelLower, "claude-3.7") ||
		strings.Contains(modelLower, "gemini")

	if hasFunctionCallingCapable && !isExcluded {
		capabilities = append(capabilities, CapFunctionCalling)
	}

	// Check for embedding capabilities
	if strings.Contains(modelLower, "embedding") ||
		strings.Contains(modelLower, "text-embedding") ||
		strings.Contains(modelLower, "text-embedding-ada") {
		capabilities = []string{CapEmbedding}
	}

	// Check for chat completion
	isChatModel := (strings.Contains(modelLower, "gpt") ||
		strings.Contains(modelLower, "claude") ||
		strings.Contains(modelLower, "gemini")) &&
		!isExcluded

	if isChatModel {
		capabilities = append(capabilities, CapChat)
	}

	return capabilities
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

// GetSeriesAndVariant returns series and variant names based on the raw model string.
func GetSeriesAndVariant(model string) (series string, variant string) {
	lower := strings.ToLower(model)

	// For Claude models
	if strings.Contains(lower, "claude") {
		return getClaudeSeriesAndVariant(lower)
	}

	// For Gemini models
	if strings.Contains(lower, "gemini") {
		return getGeminiSeriesAndVariant(lower)
	}

	// For OpenAI models
	if strings.Contains(lower, "openai") || strings.Contains(lower, "gpt") || strings.Contains(lower, "o1") {
		return getOpenAISeriesAndVariant(lower)
	}

	// Fallback
	return FamilyOther, FamilyOther
}

// getClaudeSeriesAndVariant handles Claude model series/variant identification
func getClaudeSeriesAndVariant(lower string) (series string, variant string) {
	switch {
	case strings.Contains(lower, "claude-3.7"):
		series = "Claude 3.7"
		variant = FamilyClaude3
	case strings.Contains(lower, "claude-3.5"):
		series = "Claude 3.5"
		variant = FamilyClaude3
	case strings.Contains(lower, "claude-3-opus"):
		series = "Opus"
		variant = FamilyClaude3
	case strings.Contains(lower, "claude-3-sonnet"):
		series = "Sonnet"
		variant = FamilyClaude3
	case strings.Contains(lower, "claude-3-haiku"):
		series = "Haiku"
		variant = FamilyClaude3
	case strings.Contains(lower, "claude-2"):
		if strings.Contains(lower, "opus") {
			series = "Opus"
		} else {
			series = TypeStandard
		}
		variant = FamilyClaude2
	case strings.Contains(lower, "claude-instant"):
		series = "Instant"
		variant = FamilyClaude1
	case strings.Contains(lower, "sonnet"):
		series = "Sonnet"
		variant = FamilyClaude1
	case strings.Contains(lower, "haiku"):
		series = "Haiku"
		variant = FamilyClaude1
	case strings.Contains(lower, "opus"):
		series = "Opus"
		variant = FamilyClaude2
	default:
		series = TypeStandard
		variant = "Claude"
	}
	return
}

// getGeminiSeriesAndVariant handles Gemini model series/variant identification
func getGeminiSeriesAndVariant(lower string) (series string, variant string) {
	// Determine type
	switch {
	case strings.Contains(lower, "flash-lite") || strings.Contains(lower, "flash lite"):
		series = "Flash Lite"
	case strings.Contains(lower, "flash"):
		series = TypeFlash
	case strings.Contains(lower, "pro"):
		series = TypePro
	case strings.Contains(lower, "ultra"):
		series = "Ultra"
	case strings.Contains(lower, "thinking"):
		series = "Thinking"
	case strings.Contains(lower, "vision"):
		series = TypeVision
	default:
		series = FamilyOther
	}

	// Determine version
	switch {
	case strings.Contains(lower, "gemini-1.0"):
		variant = "Gemini 1.0"
	case strings.Contains(lower, "gemini-1.5"):
		variant = "Gemini 1.5"
	case strings.Contains(lower, "gemini-2.0"):
		variant = "Gemini 2.0"
	case strings.Contains(lower, "gemini-2.5"):
		variant = "Gemini 2.5"
	default:
		variant = FamilyGemini
	}

	return
}

// getOpenAISeriesAndVariant handles OpenAI model series/variant identification
func getOpenAISeriesAndVariant(lower string) (series string, variant string) {
	switch {
	case strings.Contains(lower, "o1-mini"):
		series = "O Series"
		variant = "O1 Mini"
	case strings.Contains(lower, "o1"):
		series = "O Series"
		variant = "O1"
	case strings.Contains(lower, "gpt-3.5"):
		series = FamilyGPT35
		variant = "Turbo"
	case strings.Contains(lower, "gpt-4o-mini"):
		series = FamilyGPT4
		variant = "GPT-4o Mini"
	case strings.Contains(lower, "gpt-4o"):
		series = FamilyGPT4
		variant = "GPT-4o"
	case strings.Contains(lower, "gpt-4.5"):
		series = FamilyGPT4
		variant = "GPT-4.5"
	case strings.Contains(lower, "dall-e"):
		series = "DALL-E"
		variant = "DALL-E"
	case strings.HasPrefix(lower, "davinci"),
		strings.HasPrefix(lower, "curie"),
		strings.HasPrefix(lower, "babbage"),
		strings.HasPrefix(lower, "ada"),
		strings.Contains(lower, "embedding"),
		strings.Contains(lower, "tts"),
		strings.Contains(lower, "whisper"):
		series = FamilyOther
		variant = "Legacy"
	default:
		series = FamilyOther
		variant = FamilyOther
	}
	return
}

// GetContextWindow determines a model's context window based on its name
func (mc *ModelClassifier) GetContextWindow(modelName string) int {
	modelLower := strings.ToLower(modelName)

	// Context windows for different models - ordered by most specific first
	contextWindows := map[string]int{
		// OpenAI
		"gpt-4-turbo":       128000,
		"gpt-4o":            128000,
		"gpt-4-vision":      128000,
		"gpt-4-32k":         32768,
		"gpt-4":             8192,
		"gpt-3.5-turbo-16k": 16385,
		"gpt-3.5":           4096,

		// Claude
		"claude-3-opus":     200000,
		"claude-3-sonnet":   200000,
		"claude-3-haiku":    200000,
		"claude-3.5-sonnet": 200000,
		"claude-3.7-opus":   200000,
		"claude-2":          100000,
		"claude-instant":    100000,

		// Gemini
		"gemini-1.0-pro":        32768,
		"gemini-1.5-pro":        1000000,
		"gemini-1.5-flash":      1000000,
		"gemini-2.0-pro":        2000000,
		"gemini-2.0-flash":      1000000,
		"gemini-2.0-flash-lite": 1000000,
		"gemini-1.5-flash-8b":   1000000,
		"gemini":                32768,
	}

	// Find the most specific match
	for pattern, contextSize := range contextWindows {
		if strings.Contains(modelLower, pattern) {
			return contextSize
		}
	}

	return 0 // Default if no match
}
