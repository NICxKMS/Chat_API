package classifiers

import "strings"

// DefaultModels handles detection of default model configurations
type DefaultModels struct {
	// Map of known default models
	defaultModels map[string]bool
}

// NewDefaultModels creates a new default model detector
func NewDefaultModels() *DefaultModels {
	// Known default models
	defaultModels := map[string]bool{
		"gpt-3.5-turbo":    true,
		"gpt-4":            true,
		"gpt-4o":           true,
		"claude-3-sonnet":  true,
		"claude-3-opus":    true,
		"gemini-1.5-pro":   true,
		"gemini-1.5-flash": true,
		"gemini-2.0-pro":   true,
	}

	return &DefaultModels{
		defaultModels: defaultModels,
	}
}

// IsDefaultModel checks if a model is a default version
func (dm *DefaultModels) IsDefaultModel(modelID string) bool {
	// Check direct match in default models map
	if dm.defaultModels[modelID] {
		return true
	}

	// Check for normalized version (case insensitive)
	modelLower := strings.ToLower(modelID)
	for model := range dm.defaultModels {
		if modelLower == strings.ToLower(model) {
			return true
		}
	}

	return false
}
