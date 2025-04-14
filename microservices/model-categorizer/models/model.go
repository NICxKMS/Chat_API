package models

import (
	"sort"
)

// Model represents a single LLM model
type Model struct {
	ID             string            `json:"id"`
	Name           string            `json:"name,omitempty"`
	ContextSize    int32             `json:"context_size,omitempty"`
	MaxTokens      int32             `json:"max_tokens,omitempty"`
	Provider       string            `json:"provider"`
	OriginalProvider string          `json:"-"` // Store original provider but don't serialize
	DisplayName    string            `json:"display_name,omitempty"`
	Description    string            `json:"description,omitempty"`
	CostPerToken   float64           `json:"cost_per_token,omitempty"`
	Capabilities   []string          `json:"capabilities,omitempty"`
	Family         string            `json:"family,omitempty"`
	Type           string            `json:"type,omitempty"`
	Series         string            `json:"series,omitempty"`
	Variant        string            `json:"variant,omitempty"`
	IsDefault      bool              `json:"is_default,omitempty"`
	IsMultimodal   bool              `json:"is_multimodal,omitempty"`
	IsExperimental bool              `json:"is_experimental,omitempty"`
	Version        string            `json:"version,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

// LoadedModelList represents a list of models to be classified
type LoadedModelList struct {
	Models          []*Model `json:"models"`
	DefaultProvider string   `json:"default_provider,omitempty"`
	DefaultModel    string   `json:"default_model,omitempty"`
}

// ClassificationProperty represents a property by which models can be classified
type ClassificationProperty struct {
	Name           string   `json:"name"`
	DisplayName    string   `json:"display_name,omitempty"`
	Description    string   `json:"description,omitempty"`
	PossibleValues []string `json:"possible_values,omitempty"`
}

// ClassifiedModelGroup represents a group of models classified by a property
type ClassifiedModelGroup struct {
	PropertyName  string   `json:"property_name"`
	PropertyValue string   `json:"property_value"`
	Models        []*Model `json:"models"`
}

// ClassificationCriteria defines how models should be classified
type ClassificationCriteria struct {
	Properties          []string `json:"properties,omitempty"`
	IncludeExperimental bool     `json:"include_experimental,omitempty"`
	IncludeDeprecated   bool     `json:"include_deprecated,omitempty"`
	MinContextSize      int32    `json:"min_context_size,omitempty"`
	Hierarchical        bool     `json:"hierarchical,omitempty"`
}

// ClassifiedModelResponse represents the response from the classification server
type ClassifiedModelResponse struct {
	ClassifiedGroups    []*ClassifiedModelGroup   `json:"classified_groups"`
	AvailableProperties []*ClassificationProperty `json:"available_properties,omitempty"`
	ErrorMessage        string                    `json:"error_message,omitempty"`
}

// AvailableClassificationProperties returns the list of available classification properties
func AvailableClassificationProperties() []*ClassificationProperty {
	properties := []*ClassificationProperty{
		{
			Name:        "provider",
			DisplayName: "Provider",
			Description: "The AI provider that offers the model",
			PossibleValues: []string{
				"openai", "anthropic", "gemini", "meta", "mistral", "cohere", "openrouter", "other",
			},
		},
		{
			Name:        "family",
			DisplayName: "Model Family",
			Description: "The family or generation that the model belongs to",
			PossibleValues: []string{
				"GPT-4", "GPT-3.5", "Claude 3", "Claude 2", "Gemini 1.5", "Gemini 1.0", "Llama", "Mistral",
			},
		},
		{
			Name:        "type",
			DisplayName: "Model Type",
			Description: "The specific type or version of the model",
			PossibleValues: []string{
				"Vision", "Standard", "Pro", "Flash","Gemma", "Opus", "Sonnet", "Haiku", "Embedding", "O Series", "GPT 3.5", "GPT 4", "GPT 4.5", "Mini", "Flash Lite", "Thinking", "Image Generation",
			},
		},
		{
			Name:        "context_window",
			DisplayName: "Context Window",
			Description: "Grouping based on context window size",
			PossibleValues: []string{
				"Small (< 10K)", "Medium (10K-100K)", "Large (100K-200K)", "Very Large (> 200K)",
			},
		},
		{
			Name:        "capability",
			DisplayName: "Capabilities",
			Description: "Special model capabilities",
			PossibleValues: []string{
				"vision", "function-calling", "embedding", "streaming", "chat", "audio",
			},
		},
	}
	
	// Sort capability possible values alphabetically
	for _, prop := range properties {
		if prop.Name == "capability" {
			sort.Strings(prop.PossibleValues)
			break
		}
	}
	
	return properties
}

// HierarchicalModelGroup represents a hierarchical grouping of models
type HierarchicalModelGroup struct {
	GroupName  string                    `json:"group_name"`
	GroupValue string                    `json:"group_value"`
	Models     []*Model                  `json:"models,omitempty"`
	Children   []*HierarchicalModelGroup `json:"children,omitempty"`
}