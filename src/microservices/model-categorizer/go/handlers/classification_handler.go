package handlers

import (
	"context"
	"encoding/json"
	"log"
	"strings"

	"github.com/chat-api/model-categorizer/classifiers"
	"github.com/chat-api/model-categorizer/models"
	"github.com/chat-api/model-categorizer/models/proto"
)

// Constants for property names
const (
	PropertyProvider      = "provider"
	PropertyFamily        = "family"
	PropertyType          = "type"
	PropertySeries        = "series"
	PropertyVariant       = "variant"
	PropertyCapability    = "capability"
	PropertyContextWindow = "context_window"
	PropertyMultimodal    = "multimodal"
)

// DefaultClassificationProperties returns the default properties for classification
var DefaultClassificationProperties = []string{PropertyProvider, PropertyFamily, PropertyType, PropertyCapability}

// ModelClassificationHandler handles gRPC requests for model classification
type ModelClassificationHandler struct {
	proto.UnimplementedModelClassificationServiceServer
	classifier    *classifiers.ModelClassifier
	enableLogging bool
}

// NewModelClassificationHandler creates a new handler for model classification
func NewModelClassificationHandler(enableLogging bool) *ModelClassificationHandler {
	return &ModelClassificationHandler{
		classifier:    classifiers.NewModelClassifier(),
		enableLogging: enableLogging,
	}
}

// logRequest logs the request if logging is enabled
func (h *ModelClassificationHandler) logRequest(method string, req interface{}) {
	if !h.enableLogging {
		return
	}

	requestJSON, err := json.MarshalIndent(req, "", "  ")
	if err != nil {
		log.Printf("Error serializing request for logging: %v", err)
		return
	}

	log.Printf("REQUEST [%s]:\n%s", method, string(requestJSON))
}

// logResponse logs the response if logging is enabled
func (h *ModelClassificationHandler) logResponse(method string, resp interface{}) {
	if !h.enableLogging {
		return
	}

	responseJSON, err := json.MarshalIndent(resp, "", "  ")
	if err != nil {
		log.Printf("Error serializing response for logging: %v", err)
		return
	}

	log.Printf("RESPONSE [%s]:\n%s", method, string(responseJSON))
}

// ClassifyModels classifies a list of models
func (h *ModelClassificationHandler) ClassifyModels(ctx context.Context, req *proto.LoadedModelList) (*proto.ClassifiedModelResponse, error) {
	log.Printf("Received request to classify %d models", len(req.Models))
	h.logRequest("ClassifyModels", req)

	// Convert proto models to our internal model representation
	internalModels := convertProtoModelsToInternal(req.Models)
	log.Printf("[DEBUG] Converted %d proto models to internal models", len(internalModels))

	// Enhance and classify models with hierarchical structure by default
	result := &proto.ClassifiedModelResponse{
		AvailableProperties: convertToProtoProperties(models.AvailableClassificationProperties()),
	}

	// Enhance models with classification properties
	enhancedModels := h.enhanceModels(internalModels)

	// Build hierarchical model groups by default
	log.Printf("[DEBUG] Building model hierarchy from %d enhanced models...", len(enhancedModels))
	rootGroups := h.buildModelHierarchy(enhancedModels)

	// Convert internal root groups to proto format
	for _, group := range rootGroups {
		protoGroup := convertInternalHierarchicalGroupToProto(group)
		result.HierarchicalGroups = append(result.HierarchicalGroups, protoGroup)
	}

	// log.Printf("Returning hierarchical classification with %d root groups", len(result.HierarchicalGroups))
	// h.logResponse("ClassifyModels", result)
	return result, nil
}

// ClassifyModelsWithCriteria classifies models based on specific criteria
func (h *ModelClassificationHandler) ClassifyModelsWithCriteria(ctx context.Context, req *proto.ClassificationCriteria) (*proto.ClassifiedModelResponse, error) {
	// log.Printf("Received request to classify models with criteria: %+v", req)
	// h.logRequest("ClassifyModelsWithCriteria", req)

	// Create response with available properties
	result := &proto.ClassifiedModelResponse{
		AvailableProperties: convertToProtoProperties(models.AvailableClassificationProperties()),
	}

	// Get models from context
	modelsList, err := h.getModelsFromContext(ctx)
	if err != nil {
		result.ErrorMessage = err.Error()
		log.Printf("Error: %s", err.Error())
		return result, nil
	}

	// Properties to classify by (use from request or default)
	properties := req.Properties
	if len(properties) == 0 {
		properties = DefaultClassificationProperties
	}

	// Filter models based on criteria
	filteredModels := h.filterModelsByCriteria(modelsList, req)

	// Enhance models with classification properties
	enhancedModels := h.enhanceModels(filteredModels)

	// Default to hierarchical=true unless explicitly set to false
	useHierarchical := true
	if req != nil && !req.Hierarchical {
		useHierarchical = false
	}

	// Check if hierarchical classification is requested or defaulted
	if useHierarchical {
		// Use hierarchical classification
		log.Printf("Using hierarchical classification by provider > type > version")
		rootGroups := h.buildModelHierarchy(enhancedModels)

		// Convert internal root groups to proto format and add to response
		for _, group := range rootGroups {
			protoGroup := convertInternalHierarchicalGroupToProto(group)
			result.HierarchicalGroups = append(result.HierarchicalGroups, protoGroup)
		}

		log.Printf("Returning hierarchical classification with %d root groups and %d models",
			len(result.HierarchicalGroups), len(filteredModels))
	} else {
		// Use flat classification (original behavior)
		// Create classification groups for each property
		for _, property := range properties {
			groups := h.classifyModelsByProperty(enhancedModels, property)
			result.ClassifiedGroups = append(result.ClassifiedGroups, groups...)
		}

		// log.Printf("Returning %d classification groups with %d models after filtering",
		// 	len(result.ClassifiedGroups), len(filteredModels))
	}

	// h.logResponse("ClassifyModelsWithCriteria", result)
	return result, nil
}

// getModelsFromContext extracts and validates models from the context
func (h *ModelClassificationHandler) getModelsFromContext(ctx context.Context) ([]*models.Model, error) {
	modelCtx := ctx.Value("models")
	if modelCtx == nil {
		return nil, &classificationError{"No models found in request context"}
	}

	loadedModels, ok := modelCtx.(*models.LoadedModelList)
	if !ok {
		return nil, &classificationError{"Invalid model format in request context"}
	}

	return loadedModels.Models, nil
}

// buildClassificationResponse creates a full classification response for the given models and properties
func (h *ModelClassificationHandler) buildClassificationResponse(modelsList []*models.Model, properties []string) *proto.ClassifiedModelResponse {
	// Create response with available properties
	result := &proto.ClassifiedModelResponse{
		AvailableProperties: convertToProtoProperties(models.AvailableClassificationProperties()),
	}

	// Enhance models with classification properties
	enhancedModels := h.enhanceModels(modelsList)

	// Create classification groups for each property
	for _, property := range properties {
		groups := h.classifyModelsByProperty(enhancedModels, property)
		result.ClassifiedGroups = append(result.ClassifiedGroups, groups...)
	}

	return result
}

// enhanceModels enhances models with classification properties
func (h *ModelClassificationHandler) enhanceModels(modelsList []*models.Model) []*models.Model {
	log.Printf("[DEBUG] Starting model enhancement for %d models...", len(modelsList))
	for i, model := range modelsList {
		// Use the unified ClassifyModel method to get all metadata at once
		metadata := h.classifier.ClassifyModel(model.Name, model.Provider)
		h.applyModelMetadata(model, metadata)
		if i%10 == 0 && i > 0 {
			log.Printf("[DEBUG] Enhanced %d/%d models...", i, len(modelsList))
		}
	}
	log.Printf("[DEBUG] Finished model enhancement for %d models.", len(modelsList))
	return modelsList
}

// applyModelMetadata applies the classification metadata to a model
func (h *ModelClassificationHandler) applyModelMetadata(model *models.Model, metadata classifiers.ModelMetadata) {
	// Set family if not already set
	if model.Family == "" {
		model.Family = metadata.Series
	}

	// Set type if not already set
	if model.Type == "" {
		model.Type = metadata.Type
	}

	// Set context size if not already set
	if model.ContextSize == 0 {
		model.ContextSize = int32(metadata.Context)
	}

	// Set capabilities if not already set
	if len(model.Capabilities) == 0 {
		model.Capabilities = metadata.Capabilities
	}

	// Set multimodal flag
	model.IsMultimodal = metadata.IsMultimodal ||
		containsAny(model.Capabilities, []string{"vision", "multimodal"}) ||
		strings.Contains(strings.ToLower(model.Name), "vision") ||
		strings.Contains(strings.ToLower(model.Name), "gpt-4") ||
		strings.Contains(strings.ToLower(model.Name), "claude-3") ||
		strings.Contains(strings.ToLower(model.Name), "gemini")

	// Set experimental flag
	model.IsExperimental = metadata.IsExperimental ||
		model.IsExperimental ||
		strings.Contains(strings.ToLower(model.Name), "experimental") ||
		strings.Contains(strings.ToLower(model.Name), "preview")

	// Check if model is a default one
	model.IsDefault = h.classifier.IsDefaultModelName(model.Name)

	// Determine series and variant if not set
	if model.Series == "" {
		model.Series = metadata.Series
	}
	if model.Variant == "" {
		model.Variant = metadata.Variant
	}
}

// classifyModelsByProperty classifies models based on a specific property
func (h *ModelClassificationHandler) classifyModelsByProperty(modelsList []*models.Model, property string) []*proto.ClassifiedModelGroup {
	var groups []*proto.ClassifiedModelGroup
	propertyGroups := make(map[string][]*models.Model)

	for _, model := range modelsList {
		var propertyValue string

		switch property {
		case PropertyProvider:
			propertyValue = model.Provider
		case PropertyFamily:
			propertyValue = model.Family
		case PropertyType:
			propertyValue = model.Type
		case PropertySeries:
			propertyValue = model.Series
		case PropertyVariant:
			propertyValue = model.Variant
		case PropertyCapability:
			// For capabilities, create a group for each capability
			for _, capability := range model.Capabilities {
				if len(capability) > 0 {
					propertyGroups[capability] = append(propertyGroups[capability], model)
				}
			}
			continue
		case PropertyContextWindow:
			propertyValue = h.categorizeContextWindow(model.ContextSize)
		case PropertyMultimodal:
			propertyValue = h.boolToYesNo(model.IsMultimodal)
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

// categorizeContextWindow categorizes a context window size into a human-readable category
func (h *ModelClassificationHandler) categorizeContextWindow(size int32) string {
	if size <= 10000 {
		return "Small (< 10K)"
	} else if size <= 100000 {
		return "Medium (10K-100K)"
	} else if size <= 200000 {
		return "Large (100K-200K)"
	}
	return "Very Large (> 200K)"
}

// boolToYesNo converts a boolean to a "Yes" or "No" string
func (h *ModelClassificationHandler) boolToYesNo(value bool) string {
	if value {
		return "Yes"
	}
	return "No"
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

// buildModelHierarchy creates a hierarchical grouping of models by provider, type, and version
func (h *ModelClassificationHandler) buildModelHierarchy(modelsList []*models.Model) []*models.HierarchicalModelGroup {
	log.Printf("[DEBUG] buildModelHierarchy: Received %d models to build hierarchy.", len(modelsList))
	// First, group by provider
	providerGroups := make(map[string][]*models.Model)

	for _, model := range modelsList {
		provider := model.Provider
		if provider == "" {
			provider = "Other"
		}
		providerGroups[provider] = append(providerGroups[provider], model)
	}
	log.Printf("[DEBUG] buildModelHierarchy: Created %d provider groups.", len(providerGroups))

	// Build the hierarchy
	var rootGroups []*models.HierarchicalModelGroup

	for provider, providerModels := range providerGroups {
		log.Printf("[DEBUG] buildModelHierarchy: Processing provider group '%s' with %d models.", provider, len(providerModels))
		// Create the provider group
		providerGroup := &models.HierarchicalModelGroup{
			GroupName:  "provider",
			GroupValue: provider,
		}

		// Group by type within this provider
		typeGroups := make(map[string][]*models.Model)
		for _, model := range providerModels {
			modelType := model.Type
			if modelType == "" {
				// Default to "Standard" as per classifier logic if empty after enhancement
				modelType = classifiers.TypeStandard
			}
			typeGroups[modelType] = append(typeGroups[modelType], model)
		}
		log.Printf("[DEBUG] buildModelHierarchy: Provider '%s' has %d type groups.", provider, len(typeGroups))

		// Add type groups as children to provider group
		for modelType, typeModels := range typeGroups {
			log.Printf("[DEBUG] buildModelHierarchy:   Processing type group '%s' with %d models.", modelType, len(typeModels))
			typeGroup := &models.HierarchicalModelGroup{
				GroupName:  "type",
				GroupValue: modelType,
			}

			// Group by version/variant within this type
			versionGroups := make(map[string][]*models.Model)
			for _, model := range typeModels {
				// Use Variant if available, otherwise default
				version := model.Variant
				if version == "" {
					version = "Default" // Consistent default
				}
				versionGroups[version] = append(versionGroups[version], model)
			}
			log.Printf("[DEBUG] buildModelHierarchy:     Type '%s' has %d version groups.", modelType, len(versionGroups))

			// Add version groups as children to type group
			for version, versionModels := range versionGroups {
				log.Printf("[DEBUG] buildModelHierarchy:       Adding version group '%s' with %d models.", version, len(versionModels))
				versionGroup := &models.HierarchicalModelGroup{
					GroupName:  "version",
					GroupValue: version,
					Models:     versionModels, // Assign actual models here
				}
				// Ensure Models field is populated in the proto conversion later
				typeGroup.Children = append(typeGroup.Children, versionGroup)
			}

			providerGroup.Children = append(providerGroup.Children, typeGroup)
		}

		rootGroups = append(rootGroups, providerGroup)
	}

	log.Printf("[DEBUG] buildModelHierarchy: Finished building hierarchy, returning %d root groups.", len(rootGroups))
	return rootGroups
}

// Helper Functions

// classificationError represents an error during model classification
type classificationError struct {
	message string
}

func (e *classificationError) Error() string {
	return e.message
}

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

// convertInternalHierarchicalGroupToProto converts an internal hierarchical group to proto format
func convertInternalHierarchicalGroupToProto(internalGroup *models.HierarchicalModelGroup) *proto.HierarchicalModelGroup {
	// Ensure models are converted even if the group itself has no direct models (only children)
	protoModels := convertInternalModelsToProto(internalGroup.Models) // Convert models at this level

	protoGroup := &proto.HierarchicalModelGroup{
		GroupName:  internalGroup.GroupName,
		GroupValue: internalGroup.GroupValue,
		Models:     protoModels, // Assign converted models
	}

	// Convert children recursively
	for _, child := range internalGroup.Children {
		protoGroup.Children = append(protoGroup.Children, convertInternalHierarchicalGroupToProto(child))
	}

	return protoGroup
}

// convertProtoHierarchicalGroupToInternal converts a proto hierarchical group to internal format
func convertProtoHierarchicalGroupToInternal(protoGroup *proto.HierarchicalModelGroup) *models.HierarchicalModelGroup {
	internalGroup := &models.HierarchicalModelGroup{
		GroupName:  protoGroup.GroupName,
		GroupValue: protoGroup.GroupValue,
		Models:     convertProtoModelsToInternal(protoGroup.Models),
	}

	// Convert children recursively
	for _, child := range protoGroup.Children {
		internalGroup.Children = append(internalGroup.Children, convertProtoHierarchicalGroupToInternal(child))
	}

	return internalGroup
}
