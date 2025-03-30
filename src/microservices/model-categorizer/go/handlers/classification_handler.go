package handlers

import (
	"context"
	"log"
	"strings"

	"github.com/chat-api/model-categorizer/classifiers"
	"github.com/chat-api/model-categorizer/models"
	"github.com/chat-api/model-categorizer/models/proto"
)

// ModelClassificationHandler handles gRPC requests for model classification
type ModelClassificationHandler struct {
	proto.UnimplementedModelClassificationServiceServer
	classifier *classifiers.ModelClassifier
}

// NewModelClassificationHandler creates a new handler for model classification
func NewModelClassificationHandler() *ModelClassificationHandler {
	return &ModelClassificationHandler{
		classifier: classifiers.NewModelClassifier(),
	}
}

// ClassifyModels classifies a list of models
func (h *ModelClassificationHandler) ClassifyModels(ctx context.Context, req *proto.LoadedModelList) (*proto.ClassifiedModelResponse, error) {
	log.Printf("Received request to classify %d models", len(req.Models))

	// Convert proto models to our internal model representation
	internalModels := convertProtoModelsToInternal(req.Models)

	// Enhance models with classification properties
	enhancedModels := h.enhanceModels(internalModels)

	// Classify models by different properties
	result := &proto.ClassifiedModelResponse{
		AvailableProperties: convertToProtoProperties(models.AvailableClassificationProperties()),
	}

	// Default properties to classify by
	properties := []string{"provider", "family", "type", "capability"}

	// Create classification groups for each property
	for _, property := range properties {
		groups := h.classifyModelsByProperty(enhancedModels, property)
		result.ClassifiedGroups = append(result.ClassifiedGroups, groups...)
	}

	log.Printf("Returning %d classification groups", len(result.ClassifiedGroups))
	return result, nil
}

// ClassifyModelsWithCriteria classifies models based on specific criteria
func (h *ModelClassificationHandler) ClassifyModelsWithCriteria(ctx context.Context, req *proto.ClassificationCriteria) (*proto.ClassifiedModelResponse, error) {
	log.Printf("Received request to classify models with criteria: %+v", req)

	// Create response
	result := &proto.ClassifiedModelResponse{
		AvailableProperties: convertToProtoProperties(models.AvailableClassificationProperties()),
	}

	// Get all models from request context (in a real system, this might come from a database)
	// For this example, we'll simulate having models
	simulatedModels := h.getSimulatedModels()

	// Filter models based on criteria
	filteredModels := h.filterModelsByCriteria(simulatedModels, req)

	// Properties to classify by (use from request or default)
	properties := req.Properties
	if len(properties) == 0 {
		properties = []string{"provider", "family", "type", "capability"}
	}

	// Create classification groups for each property
	for _, property := range properties {
		groups := h.classifyModelsByProperty(filteredModels, property)
		result.ClassifiedGroups = append(result.ClassifiedGroups, groups...)
	}

	log.Printf("Returning %d classification groups with %d models after filtering",
		len(result.ClassifiedGroups), len(filteredModels))
	return result, nil
}

// enhanceModels enhances models with classification properties
func (h *ModelClassificationHandler) enhanceModels(modelsList []*models.Model) []*models.Model {
	for _, model := range modelsList {
		// Set family if not already set
		if model.Family == "" {
			model.Family = h.classifier.DetermineModelFamily(model.Name, model.Provider)
		}

		// Set type if not already set
		if model.Type == "" {
			model.Type = h.classifier.DetermineModelType(model.Name, model.Family, model.Provider)
		}

		// Set context size if not already set
		if model.ContextSize == 0 {
			model.ContextSize = int32(h.classifier.GetContextWindow(model.Name))
		}

		// Set capabilities if not already set
		if len(model.Capabilities) == 0 {
			model.Capabilities = h.classifier.DetectCapabilities(model.Name, model.Capabilities)
		}

		// Set multimodal flag
		model.IsMultimodal = containsAny(model.Capabilities, []string{"vision", "multimodal"}) ||
			strings.Contains(strings.ToLower(model.Name), "vision") ||
			strings.Contains(strings.ToLower(model.Name), "gpt-4") ||
			strings.Contains(strings.ToLower(model.Name), "claude-3") ||
			strings.Contains(strings.ToLower(model.Name), "gemini")

		// Set experimental flag
		model.IsExperimental = model.IsExperimental ||
			strings.Contains(strings.ToLower(model.Name), "experimental") ||
			strings.Contains(strings.ToLower(model.Name), "preview")

		// Check if model is a default one
		model.IsDefault = h.classifier.IsDefaultModelName(model.Name)

		// Determine series and variant if not set
		if model.Series == "" || model.Variant == "" {
			series, variant := classifiers.GetSeriesAndVariant(model.Name)
			if model.Series == "" {
				model.Series = series
			}
			if model.Variant == "" {
				model.Variant = variant
			}
		}
	}

	return modelsList
}

// classifyModelsByProperty classifies models based on a specific property
func (h *ModelClassificationHandler) classifyModelsByProperty(modelsList []*models.Model, property string) []*proto.ClassifiedModelGroup {
	var groups []*proto.ClassifiedModelGroup
	propertyGroups := make(map[string][]*models.Model)

	for _, model := range modelsList {
		var propertyValue string

		switch property {
		case "provider":
			propertyValue = model.Provider
		case "family":
			propertyValue = model.Family
		case "type":
			propertyValue = model.Type
		case "series":
			propertyValue = model.Series
		case "variant":
			propertyValue = model.Variant
		case "capability":
			// For capabilities, create a group for each capability
			for _, capability := range model.Capabilities {
				if len(capability) > 0 {
					propertyGroups[capability] = append(propertyGroups[capability], model)
				}
			}
			continue
		case "context_window":
			// Group by context window size ranges
			if model.ContextSize <= 10000 {
				propertyValue = "Small (< 10K)"
			} else if model.ContextSize <= 100000 {
				propertyValue = "Medium (10K-100K)"
			} else if model.ContextSize <= 200000 {
				propertyValue = "Large (100K-200K)"
			} else {
				propertyValue = "Very Large (> 200K)"
			}
		case "multimodal":
			if model.IsMultimodal {
				propertyValue = "Yes"
			} else {
				propertyValue = "No"
			}
		default:
			// Skip unknown properties
			continue
		}

		if propertyValue != "" {
			propertyGroups[propertyValue] = append(propertyGroups[propertyValue], model)
		}
	}

	// Convert the map to a slice of groups
	for value, modelGroup := range propertyGroups {
		group := &proto.ClassifiedModelGroup{
			PropertyName:  property,
			PropertyValue: value,
			Models:        convertInternalModelsToProto(modelGroup),
		}
		groups = append(groups, group)
	}

	return groups
}

// filterModelsByCriteria filters models based on classification criteria
func (h *ModelClassificationHandler) filterModelsByCriteria(modelsList []*models.Model, criteria *proto.ClassificationCriteria) []*models.Model {
	var result []*models.Model

	for _, model := range modelsList {
		// Skip models that don't meet the criteria
		if criteria.MinContextSize > 0 && model.ContextSize < criteria.MinContextSize {
			continue
		}

		if !criteria.IncludeExperimental && model.IsExperimental {
			continue
		}

		if !criteria.IncludeDeprecated {
			if deprecated, ok := model.Metadata["deprecated"]; ok && deprecated == "true" {
				continue
			}
		}

		// Model passes all filters
		result = append(result, model)
	}

	return result
}

// getSimulatedModels returns a list of simulated models for testing
func (h *ModelClassificationHandler) getSimulatedModels() []*models.Model {
	// In a real implementation, this would fetch models from a database
	// For this example, we'll create a sample set of models
	return []*models.Model{
		{
			ID:           "gpt-4",
			Name:         "GPT-4",
			Provider:     "openai",
			Family:       "GPT-4",
			Type:         "Standard",
			ContextSize:  8192,
			Capabilities: []string{"function-calling"},
			IsDefault:    true,
		},
		{
			ID:           "gpt-4o",
			Name:         "GPT-4o",
			Provider:     "openai",
			Family:       "GPT-4",
			Type:         "GPT-4o",
			ContextSize:  128000,
			Capabilities: []string{"vision", "function-calling"},
			IsMultimodal: true,
		},
		{
			ID:           "gpt-3.5-turbo",
			Name:         "GPT-3.5 Turbo",
			Provider:     "openai",
			Family:       "GPT-3.5",
			Type:         "Turbo",
			ContextSize:  16385,
			Capabilities: []string{"function-calling"},
			IsDefault:    true,
		},
		{
			ID:           "claude-3-opus",
			Name:         "Claude 3 Opus",
			Provider:     "anthropic",
			Family:       "Claude 3",
			Type:         "Opus",
			ContextSize:  200000,
			Capabilities: []string{"vision", "function-calling"},
			IsMultimodal: true,
		},
		{
			ID:           "claude-3-sonnet",
			Name:         "Claude 3 Sonnet",
			Provider:     "anthropic",
			Family:       "Claude 3",
			Type:         "Sonnet",
			ContextSize:  200000,
			Capabilities: []string{"vision", "function-calling"},
			IsMultimodal: true,
			IsDefault:    true,
		},
		{
			ID:           "gemini-1.5-pro",
			Name:         "Gemini 1.5 Pro",
			Provider:     "gemini",
			Family:       "Gemini 1.5",
			Type:         "Pro",
			ContextSize:  1000000,
			Capabilities: []string{"vision", "function-calling"},
			IsMultimodal: true,
			IsDefault:    true,
		},
		{
			ID:           "gemini-1.5-flash",
			Name:         "Gemini 1.5 Flash",
			Provider:     "gemini",
			Family:       "Gemini 1.5",
			Type:         "Flash",
			ContextSize:  1000000,
			Capabilities: []string{"vision", "function-calling"},
			IsMultimodal: true,
		},
		{
			ID:           "llama-3-70b",
			Name:         "Llama 3 70B",
			Provider:     "meta",
			Family:       "Llama",
			Type:         "Standard",
			ContextSize:  8000,
			Capabilities: []string{"function-calling"},
		},
		{
			ID:           "mistral-large",
			Name:         "Mistral Large",
			Provider:     "mistral",
			Family:       "Mistral",
			Type:         "Large",
			ContextSize:  32000,
			Capabilities: []string{"function-calling"},
			IsDefault:    true,
		},
		{
			ID:             "text-embedding-ada-002",
			Name:           "Text Embedding Ada 002",
			Provider:       "openai",
			Family:         "Embedding",
			Type:           "Embedding",
			Capabilities:   []string{"embedding"},
			IsExperimental: true,
		},
	}
}

// Helper Functions

// convertProtoModelsToInternal converts proto models to internal models
func convertProtoModelsToInternal(protoModels []*proto.Model) []*models.Model {
	var result []*models.Model

	for _, protoModel := range protoModels {
		model := &models.Model{
			ID:             protoModel.Id,
			Name:           protoModel.Name,
			ContextSize:    protoModel.ContextSize,
			MaxTokens:      protoModel.MaxTokens,
			Provider:       protoModel.Provider,
			DisplayName:    protoModel.DisplayName,
			Description:    protoModel.Description,
			CostPerToken:   protoModel.CostPerToken,
			Capabilities:   protoModel.Capabilities,
			Family:         protoModel.Family,
			Type:           protoModel.Type,
			Series:         protoModel.Series,
			Variant:        protoModel.Variant,
			IsDefault:      protoModel.IsDefault,
			IsMultimodal:   protoModel.IsMultimodal,
			IsExperimental: protoModel.IsExperimental,
			Version:        protoModel.Version,
			Metadata:       protoModel.Metadata,
		}
		result = append(result, model)
	}

	return result
}

// convertInternalModelsToProto converts internal models to proto models
func convertInternalModelsToProto(internalModels []*models.Model) []*proto.Model {
	var result []*proto.Model

	for _, model := range internalModels {
		protoModel := &proto.Model{
			Id:             model.ID,
			Name:           model.Name,
			ContextSize:    model.ContextSize,
			MaxTokens:      model.MaxTokens,
			Provider:       model.Provider,
			DisplayName:    model.DisplayName,
			Description:    model.Description,
			CostPerToken:   model.CostPerToken,
			Capabilities:   model.Capabilities,
			Family:         model.Family,
			Type:           model.Type,
			Series:         model.Series,
			Variant:        model.Variant,
			IsDefault:      model.IsDefault,
			IsMultimodal:   model.IsMultimodal,
			IsExperimental: model.IsExperimental,
			Version:        model.Version,
			Metadata:       model.Metadata,
		}
		result = append(result, protoModel)
	}

	return result
}

// convertToProtoProperties converts classification properties to proto format
func convertToProtoProperties(properties []*models.ClassificationProperty) []*proto.ClassificationProperty {
	var result []*proto.ClassificationProperty

	for _, prop := range properties {
		protoProp := &proto.ClassificationProperty{
			Name:           prop.Name,
			DisplayName:    prop.DisplayName,
			Description:    prop.Description,
			PossibleValues: prop.PossibleValues,
		}
		result = append(result, protoProp)
	}

	return result
}

// containsAny checks if a slice contains any of the given values
func containsAny(slice []string, values []string) bool {
	for _, item := range slice {
		for _, value := range values {
			if item == value {
				return true
			}
		}
	}
	return false
}
