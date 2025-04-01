package classifiers

import "strings"

// PatternMatcher handles all pattern-based identification for models
type PatternMatcher struct {
	// Provider detection patterns
	providerPatterns map[string][]string

	// Series detection patterns
	seriesPatterns map[string][]string

	// Type detection patterns
	typePatterns map[string][]string

	// Capability detection patterns
	capabilityPatterns map[string][]string
}

// NewPatternMatcher creates a new pattern matcher with all patterns
func NewPatternMatcher() *PatternMatcher {
	// Initialize provider detection patterns
	providerPatterns := map[string][]string{
		ProviderOpenAI:     {"openai", "gpt", "o1", "dall-e"},
		ProviderAnthropicA: {"anthropic", "claude"},
		ProviderGemini:     {"gemini", "google"},
		ProviderMeta:       {"meta", "llama", "meta-llama"},
		ProviderMistral:    {"mistral", "mixtral"},
	}

	// Initialize series detection patterns
	seriesPatterns := map[string][]string{
		SeriesClaude3:         {"claude-3", "claude3", "claude-3.5", "claude-3.7"},
		SeriesClaude2:         {"claude-2", "claude2"},
		SeriesClaude1:         {"claude-1", "claude1", "claude-instant"},
		"Gemini " + Version10: {"gemini-1.0", "gemini-1.0-pro"},
		"Gemini " + Version15: {"gemini-1.5", "gemini-1.5-pro", "gemini-1.5-flash"},
		"Gemini " + Version20: {"gemini-2.0", "gemini-2.0-pro", "gemini-2.0-flash"},
		"Gemini " + Version25: {"gemini-2.5", "gemini-2.5-pro", "gemini-2.5-flash"},
		"Gemma 2":             {"gemma-2"},
		TypeImage:             {"dall-e", "imagen", "midjourney", "stable-diffusion"},
		TypeEmbedding:         {"embedding", "text-embedding", "embed"},
	}

	// Initialize type detection patterns
	typePatterns := map[string][]string{
		TypeO:         {"o1", "o3"},
		Type35:        {"gpt-3.5", "gpt3.5"},
		Type4:         {"gpt-4", "gpt4", "gpt-4o"},
		Type45:        {"gpt-4.5", "gpt4.5"},
		TypeMini:      {"mini"},
		TypeOpus:      {"opus"},
		TypeSonnet:    {"sonnet"},
		TypeHaiku:     {"haiku"},
		TypePro:       {"pro"},
		TypeFlashLite: {"flash-lite"},
		TypeFlash:     {"flash"},
		TypeThinking:  {"thinking"},
		TypeVision:    {"vision", "multimodal"},
		TypeEmbedding: {"embedding", "embed", "tts"},
	}

	// Initialize capability patterns
	capabilityPatterns := map[string][]string{
		CapVision:          {"vision", "image", "multimodal"},
		CapFunctionCalling: {"function", "tool", "api"},
		CapEmbedding:       {"embedding", "embed", "vector"},
		"audio":            {"whisper", "tts", "speech", "audio"},
		CapChat:            {"chat", "conversation", "completion"},
	}

	return &PatternMatcher{
		providerPatterns:   providerPatterns,
		seriesPatterns:     seriesPatterns,
		typePatterns:       typePatterns,
		capabilityPatterns: capabilityPatterns,
	}
}

// matchProviderByName matches a provider by exact name
func (pm *PatternMatcher) matchProviderByName(providerName string) string {
	for provider := range pm.providerPatterns {
		if providerName == strings.ToLower(provider) {
			return provider
		}
	}
	return ""
}

// matchProviderByPattern matches a provider based on patterns
func (pm *PatternMatcher) matchProviderByPattern(modelName string) string {
	modelLower := strings.ToLower(modelName)
	for provider, patterns := range pm.providerPatterns {
		for _, pattern := range patterns {
			if strings.Contains(modelLower, pattern) {
				return provider
			}
		}
	}
	return ""
}

// matchClaudeVersion matches Claude series version
func (pm *PatternMatcher) matchClaudeVersion(modelName string) string {
	modelLower := strings.ToLower(modelName)

	// Check for Claude series versions
	for _, pattern := range pm.seriesPatterns[SeriesClaude3] {
		if strings.Contains(modelLower, pattern) {
			return SeriesClaude3
		}
	}

	for _, pattern := range pm.seriesPatterns[SeriesClaude2] {
		if strings.Contains(modelLower, pattern) {
			return SeriesClaude2
		}
	}

	for _, pattern := range pm.seriesPatterns[SeriesClaude1] {
		if strings.Contains(modelLower, pattern) {
			return SeriesClaude1
		}
	}

	return ""
}

// matchGeminiVersion matches Gemini version series
func (pm *PatternMatcher) matchGeminiVersion(modelName string) string {
	modelLower := strings.ToLower(modelName)

	if strings.Contains(modelLower, "2.5") {
		return "Gemini " + Version25
	}
	if strings.Contains(modelLower, "2.0") {
		return "Gemini " + Version20
	}
	if strings.Contains(modelLower, "1.5") {
		return "Gemini " + Version15
	}
	if strings.Contains(modelLower, "1.0") {
		return "Gemini " + Version10
	}

	return "Gemini " + Version10
}

// matchSeriesByPattern matches model series by patterns
func (pm *PatternMatcher) matchSeriesByPattern(modelName string) string {
	modelLower := strings.ToLower(modelName)

	for series, patterns := range pm.seriesPatterns {
		for _, pattern := range patterns {
			if strings.Contains(modelLower, pattern) {
				return series
			}
		}
	}

	return ""
}

// matchOpenAIType matches OpenAI model types
func (pm *PatternMatcher) matchOpenAIType(modelName string) string {
	modelLower := strings.ToLower(modelName)

	if strings.Contains(modelLower, "mini") {
		return TypeMini
	}

	// Handle O series models
	if strings.Contains(modelLower, "o1") || strings.Contains(modelLower, "o3") {
		return TypeO
	}

	// Handle GPT-4.5 models
	if strings.Contains(modelLower, "gpt-4.5") || strings.Contains(modelLower, "gpt4.5") {
		return Type45
	}

	// Handle GPT-4 models
	if strings.Contains(modelLower, "gpt-4") || strings.Contains(modelLower, "gpt4") {
		return Type4
	}

	// Handle GPT-3.5 models
	if strings.Contains(modelLower, "gpt-3.5") || strings.Contains(modelLower, "gpt3.5") {
		return Type35
	}

	return TypeStandard
}

// matchAnthropicType matches Anthropic model types
func (pm *PatternMatcher) matchAnthropicType(modelName string) string {
	if strings.Contains(modelName, "opus") {
		return TypeOpus
	}
	if strings.Contains(modelName, "sonnet") {
		return TypeSonnet
	}
	if strings.Contains(modelName, "haiku") {
		return TypeHaiku
	}

	return TypeStandard
}

// matchGeminiType matches Gemini model types
func (pm *PatternMatcher) matchGeminiType(modelName string) string {
	if strings.Contains(modelName, "flash-lite") || strings.Contains(modelName, "flash lite") {
		return TypeFlashLite
	}
	if strings.Contains(modelName, "thinking") {
		return TypeThinking
	}
	if strings.Contains(modelName, "flash") {
		return TypeFlash
	}
	if strings.Contains(modelName, "pro") {
		return TypePro
	}
	if strings.Contains(modelName, "gemma") {
		return TypeGemma
	}
	return TypeStandard
}

// matchTypeByPattern matches model type by generic patterns
func (pm *PatternMatcher) matchTypeByPattern(modelName string) string {
	for type_, patterns := range pm.typePatterns {
		for _, pattern := range patterns {
			if strings.Contains(modelName, pattern) {
				return type_
			}
		}
	}

	return ""
}

// matchOpenAIVariant matches OpenAI variant names
func (pm *PatternMatcher) matchOpenAIVariant(modelName string) string {
	modelLower := strings.ToLower(modelName)

	switch {
	case strings.Contains(modelLower, "gpt-4.5"):
		return "GPT-" + Version45
	case strings.Contains(modelLower, "gpt-4o-mini"):
		return "GPT-4o Mini"
	case strings.Contains(modelLower, "gpt-4o"):
		return "GPT-4o"
	case strings.Contains(modelLower, "gpt-4-turbo"):
		return "GPT-4 Turbo"
	case strings.Contains(modelLower, "gpt-4-vision"):
		return "GPT-4 Vision"
	case strings.Contains(modelLower, "o1-mini"):
		return "O1 Mini"
	case strings.Contains(modelLower, "o1"):
		return "O1"
	default:
		return ""
	}
}

// matchAnthropicVariant matches Anthropic variant names
func (pm *PatternMatcher) matchAnthropicVariant(modelName string) string {
	modelLower := strings.ToLower(modelName)

	switch {
	case strings.Contains(modelLower, "claude-3.7"):
		return "Claude " + Version37
	case strings.Contains(modelLower, "claude-3.5"):
		return "Claude " + Version35
	case strings.Contains(modelLower, "claude-3"):
		return "Claude " + Version30
	case strings.Contains(modelLower, "claude-2"):
		return "Claude " + Version20
	case strings.Contains(modelLower, "claude-instant"):
		return "Claude Instant"
	default:
		return ""
	}
}

// buildGeminiVariant builds Gemini variant string
func (pm *PatternMatcher) buildGeminiVariant(modelName string) string {
	modelLower := strings.ToLower(modelName)

	// Combine version with type
	version := ""
	if strings.Contains(modelLower, "2.5") {
		version = Version25
	} else if strings.Contains(modelLower, "2.0") {
		version = Version20
	} else if strings.Contains(modelLower, "1.5") {
		version = Version15
	} else if strings.Contains(modelLower, "1.0") {
		version = Version10
	}

	type_ := ""
	if strings.Contains(modelLower, "flash-lite") || strings.Contains(modelLower, "flash lite") {
		type_ = TypeFlashLite
	} else if strings.Contains(modelLower, "thinking") {
		type_ = TypeThinking
	} else if strings.Contains(modelLower, "flash") {
		type_ = TypeFlash
	} else if strings.Contains(modelLower, "pro") {
		type_ = TypePro
	}

	if version != "" && type_ != "" {
		return "Gemini " + version + " " + type_
	} else if version != "" {
		return "Gemini " + version
	} else if type_ != "" {
		return "Gemini " + type_
	}

	return ""
}

// addCapabilities adds capabilities to the capabilities map based on model traits
func (pm *PatternMatcher) addCapabilities(capabilities map[string]bool, modelType, modelName, provider, series string) {
	// Vision capability
	if strings.Contains(modelName, "vision") ||
		strings.Contains(modelName, "multimodal") ||
		modelType == Type4 || modelType == Type45 || modelType == TypeO ||
		series == SeriesClaude3 ||
		strings.Contains(series, "Gemini") {
		capabilities[CapVision] = true
	}

	// Function calling capability
	// Most modern LLMs support function calling
	if modelType == Type4 || modelType == Type45 || modelType == Type35 || modelType == TypeO ||
		series == SeriesClaude3 ||
		strings.Contains(series, "Gemini") {
		capabilities[CapFunctionCalling] = true
	}
}
