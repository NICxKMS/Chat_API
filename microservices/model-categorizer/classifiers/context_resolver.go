package classifiers

import "strings"

// ContextResolver handles determining the context window size for models
type ContextResolver struct {
	// Map of known context sizes for specific models
	contextSizes map[string]int
}

// NewContextResolver creates a new context window size resolver
func NewContextResolver() *ContextResolver {
	// Context sizes for common models
	contextSizes := map[string]int{
		// OpenAI
		"gpt-4o":            128000,
		"gpt-4o-mini":       128000,
		"gpt-4-turbo":       128000,
		"gpt-4-vision":      128000,
		"gpt-4-32k":         32768,
		"gpt-4":             8192,
		"gpt-4.5":           128000,
		"gpt-3.5-turbo-16k": 16385,
		"gpt-3.5-turbo":     4096,
		"o1":                32768,
		"o1-mini":           32768,

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
	}

	return &ContextResolver{
		contextSizes: contextSizes,
	}
}

// getContextSize determines a model's context window based on its name
func (cr *ContextResolver) getContextSize(modelName string) int {
	modelLower := strings.ToLower(modelName)

	// Check for exact matches first
	for model, size := range cr.contextSizes {
		if strings.Contains(modelLower, model) {
			return size
		}
	}

	// If no exact match, use heuristics based on model family
	return cr.getContextSizeByFamily(modelLower)
}

// getContextSizeByFamily uses heuristics to determine context size for common model families
func (cr *ContextResolver) getContextSizeByFamily(modelLower string) int {
	// GPT model families
	if strings.Contains(modelLower, "gpt-4.5") {
		return 128000
	}

	if strings.Contains(modelLower, "gpt-4") {
		if strings.Contains(modelLower, "32k") {
			return 32768
		}
		if strings.Contains(modelLower, "turbo") || strings.Contains(modelLower, "o") {
			return 128000
		}
		return 8192
	}

	if strings.Contains(modelLower, "gpt-3.5") {
		if strings.Contains(modelLower, "16k") {
			return 16385
		}
		return 4096
	}

	// Claude model families
	if strings.Contains(modelLower, "claude-3") {
		return 200000
	}

	if strings.Contains(modelLower, "claude-2") || strings.Contains(modelLower, "claude-instant") {
		return 100000
	}

	// Gemini model families
	if strings.Contains(modelLower, "gemini-1.0") {
		return 32768
	}

	if strings.Contains(modelLower, "gemini-1.5") || strings.Contains(modelLower, "gemini-2.0") {
		// Check for flash-lite first to ensure proper handling
		if strings.Contains(modelLower, "flash-lite") {
			return 1000000
		}
		if strings.Contains(modelLower, "flash") {
			return 1000000
		}
		if strings.Contains(modelLower, "pro") {
			return 1000000
		}
		return 1000000 // Default for Gemini 1.5/2.0
	}

	// Default if no match
	return 0
}
