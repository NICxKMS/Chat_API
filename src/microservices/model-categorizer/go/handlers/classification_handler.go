package handlers

import (
	"context"
	"encoding/json"
	"log"
	"sort"
	"strconv"
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
	// Always overwrite with classifier results to ensure consistency
	model.Provider = metadata.Provider // Also ensure provider is consistent
	model.Family = metadata.Series
	model.Type = metadata.Type
	model.Series = metadata.Series // Assuming Family and Series are the same here based on previous logic
	model.Variant = metadata.Variant
	model.ContextSize = int32(metadata.Context)
	model.Capabilities = metadata.Capabilities

	// Set version information if it's not already set
	if model.Version == "" {
		// Extract standardized version number from model name and variant
		standardizedVersion := h.classifier.GetStandardizedVersion(model.Name)
		if standardizedVersion != "" {
			model.Version = standardizedVersion
		}
	}

	// Set multimodal flag based on metadata and other checks
	model.IsMultimodal = metadata.IsMultimodal ||
		containsAny(model.Capabilities, []string{"vision", "multimodal"}) ||
		strings.Contains(strings.ToLower(model.Name), "vision") ||
		strings.Contains(strings.ToLower(model.Name), "gpt-4") ||
		strings.Contains(strings.ToLower(model.Name), "claude-3") ||
		strings.Contains(strings.ToLower(model.Name), "gemini")

	// Set experimental flag based on metadata and name patterns
	model.IsExperimental = metadata.IsExperimental || // Base on classifier result first
		strings.Contains(strings.ToLower(model.Name), "preview") ||
		strings.Contains(strings.ToLower(model.Name), "experimental")

	// Check if model is a default one
	model.IsDefault = h.classifier.IsDefaultModelName(model.Name)
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

// sortModels sorts a list of models according to specified provider and model hierarchy
func (h *ModelClassificationHandler) sortModels(modelsList []*models.Model) {
	// Pre-parse models to avoid redundant computations
	type modelInfo struct {
		model      *models.Model
		lowerName  string
		provider   string
		modelType  string
		version    string
		versionNum float64 // Numeric version for comparison
	}

	// Provider priority map
	providerPriority := map[string]int{
		"gemini":    0,
		"openai":    1,
		"anthropic": 2,
		"claude":    2, // Treat claude same as anthropic
	}

	// Type priority maps for each provider
	geminiTypePriority := map[string]int{
		classifiers.TypeFlashLite: 0,
		classifiers.TypeFlash:     1,
		classifiers.TypePro:       2,
		classifiers.TypeThinking:  3,
		classifiers.TypeGemma:     4,
		classifiers.TypeStandard:  5,
	}

	openaiTypePriority := map[string]int{
		classifiers.TypeMini: 0, // Mini series
		classifiers.TypeO:    1, // O series
		classifiers.Type45:   2, // 4.5 series
		classifiers.Type4:    3, // GPT-4 series
		classifiers.Type35:   4, // GPT-3.5 series
		"other":              5, // Other OpenAI models
	}

	claudeTypePriority := map[string]int{
		classifiers.TypeSonnet: 0,
		classifiers.TypeOpus:   1,
		classifiers.TypeHaiku:  2,
		"other":                3,
	}

	// Parse each model once
	modelInfos := make([]modelInfo, len(modelsList))
	for i, model := range modelsList {
		lowerName := strings.ToLower(model.Name)
		provider := strings.ToLower(model.Provider)
		modelType := model.Type

		// Extract version as float for comparison
		versionNum := 0.0
		if model.Version != "" {
			// Extract numbers from version string
			nums := make([]string, 0)
			for _, r := range model.Version {
				if r >= '0' && r <= '9' || r == '.' {
					nums = append(nums, string(r))
				}
			}
			versionStr := strings.Join(nums, "")
			if versionFloat, err := strconv.ParseFloat(versionStr, 64); err == nil {
				versionNum = versionFloat
			}
		}

		// Special cases for OpenAI mini series
		if provider == "openai" {
			if strings.Contains(lowerName, "mini") {
				modelType = classifiers.TypeMini
			} else if lowerName[0] == 'o' {
				modelType = classifiers.TypeO
			}
		}

		modelInfos[i] = modelInfo{
			model:      model,
			lowerName:  lowerName,
			provider:   provider,
			modelType:  modelType,
			version:    model.Version,
			versionNum: versionNum,
		}
	}

	// Sort the models
	sort.SliceStable(modelInfos, func(i, j int) bool {
		a, b := modelInfos[i], modelInfos[j]

		// 1. Primary sort: Provider
		provPriorityA := providerPriority[a.provider]
		provPriorityB := providerPriority[b.provider]

		// If provider not in map, assign a high value (lower priority)
		if _, exists := providerPriority[a.provider]; !exists {
			provPriorityA = 100
		}
		if _, exists := providerPriority[b.provider]; !exists {
			provPriorityB = 100
		}

		if provPriorityA != provPriorityB {
			return provPriorityA < provPriorityB
		}

		// 2. Secondary sort: Model type/hierarchy (within each provider)
		switch a.provider {
		case "gemini":
			typeA := geminiTypePriority[a.modelType]
			typeB := geminiTypePriority[b.modelType]

			// Handle missing types
			if _, exists := geminiTypePriority[a.modelType]; !exists {
				typeA = geminiTypePriority[classifiers.TypeStandard]
			}
			if _, exists := geminiTypePriority[b.modelType]; !exists {
				typeB = geminiTypePriority[classifiers.TypeStandard]
			}

			if typeA != typeB {
				return typeA < typeB
			}

		case "openai":
			// --- Begin replacement of OpenAI mini sorting block ---
			if strings.ToLower(a.modelType) == "mini" && strings.ToLower(b.modelType) == "mini" {
				var priorityA, priorityB int
				if a.lowerName == "4o-mini" || a.lowerName == "gpt-4o-mini" {
					priorityA = 0
				} else if a.lowerName == "o1-mini" || a.lowerName == "gpt-o1-mini" {
					priorityA = 1
				} else if strings.Contains(a.lowerName, "4o-mini") {
					priorityA = 2
				} else if strings.Contains(a.lowerName, "o1-mini") {
					priorityA = 3
				} else {
					priorityA = 4
				}
				if b.lowerName == "4o-mini" || b.lowerName == "gpt-4o-mini" {
					priorityB = 0
				} else if b.lowerName == "o1-mini" || b.lowerName == "gpt-o1-mini" {
					priorityB = 1
				} else if strings.Contains(b.lowerName, "4o-mini") {
					priorityB = 2
				} else if strings.Contains(b.lowerName, "o1-mini") {
					priorityB = 3
				} else {
					priorityB = 4
				}
				if priorityA != priorityB {
					return priorityA < priorityB
				}
				if a.versionNum != b.versionNum {
					return a.versionNum > b.versionNum
				}
				return a.lowerName < b.lowerName
			}
			// --- End replacement of OpenAI mini sorting block ---

			// --- Handle non-Mini types ---
			typeA := openaiTypePriority[a.modelType]
			typeB := openaiTypePriority[b.modelType]

			// Handle missing types
			if _, exists := openaiTypePriority[a.modelType]; !exists {
				typeA = openaiTypePriority["other"]
			}
			if _, exists := openaiTypePriority[b.modelType]; !exists {
				typeB = openaiTypePriority["other"]
			}

			if typeA != typeB {
				return typeA < typeB
			}

			// Special handling for GPT-4 series
			if a.modelType == classifiers.Type4 && b.modelType == classifiers.Type4 {
				// Base 4o model first, then other 4o variants, then other gpt-4 models
				aIs4o := strings.Contains(a.lowerName, "4o") && !strings.Contains(a.lowerName, "4o-mini")
				bIs4o := strings.Contains(b.lowerName, "4o") && !strings.Contains(b.lowerName, "4o-mini")

				aIsBase4o := a.lowerName == "gpt-4o" || a.lowerName == "4o"
				bIsBase4o := b.lowerName == "gpt-4o" || b.lowerName == "4o"

				if aIsBase4o && !bIsBase4o {
					return true
				}
				if !aIsBase4o && bIsBase4o {
					return false
				}
				if aIs4o && !bIs4o {
					return true
				}
				if !aIs4o && bIs4o {
					return false
				}
			}

			// For the "other" category, sort by shortest name first
			if typeA == openaiTypePriority["other"] && typeB == openaiTypePriority["other"] {
				return len(a.lowerName) < len(b.lowerName)
			}

		case "anthropic", "claude":
			typeA := claudeTypePriority[a.modelType]
			typeB := claudeTypePriority[b.modelType]

			// Handle missing types
			if _, exists := claudeTypePriority[a.modelType]; !exists {
				typeA = claudeTypePriority["other"]
			}
			if _, exists := claudeTypePriority[b.modelType]; !exists {
				typeB = claudeTypePriority["other"]
			}

			if typeA != typeB {
				return typeA < typeB
			}
		}

		// 3. Tertiary sort: Version number (highest first)
		if a.versionNum != b.versionNum {
			return a.versionNum > b.versionNum // Descending order
		}

		// 4. Quaternary sort: Model name (tie-breaker)
		return a.lowerName < b.lowerName
	})

	// Reorder the original slice
	for i, info := range modelInfos {
		modelsList[i] = info.model
	}
}

// buildModelHierarchy creates a hierarchical grouping of models by provider, type, and version,
// preserving the order established by sortModels.
func (h *ModelClassificationHandler) buildModelHierarchy(modelsList []*models.Model) []*models.HierarchicalModelGroup {
	log.Printf("[DEBUG] buildModelHierarchy: Received %d models to build hierarchy.", len(modelsList))

	// 1. Sort models according to the specified criteria FIRST.
	h.sortModels(modelsList)
	log.Printf("[DEBUG] buildModelHierarchy: Finished sorting %d models.", len(modelsList))

	// 2. Build the hierarchy in a single pass over the sorted list.
	var rootGroups []*models.HierarchicalModelGroup
	if len(modelsList) == 0 {
		log.Printf("[DEBUG] buildModelHierarchy: No models to build hierarchy for.")
		return rootGroups
	}

	var currentProviderGroup *models.HierarchicalModelGroup
	var currentTypeGroup *models.HierarchicalModelGroup
	var currentVersionGroup *models.HierarchicalModelGroup

	for i, model := range modelsList {
		// Determine provider, type, and version/variant for the current model
		provider := model.Provider
		if provider == "" {
			provider = "Other"
		}
		modelType := model.Type
		if modelType == "" {
			modelType = classifiers.TypeStandard // Default if empty
		}
		version := model.Variant // Use Variant for the lowest level grouping
		if version == "" {
			version = "Default"
		}

		// Check if Provider changed or if it's the first model
		if i == 0 || currentProviderGroup == nil || provider != currentProviderGroup.GroupValue {
			log.Printf("[DEBUG] buildModelHierarchy: Creating new provider group: %s", provider)
			currentProviderGroup = &models.HierarchicalModelGroup{
				GroupName:  "provider",
				GroupValue: provider,
				Children:   []*models.HierarchicalModelGroup{},
			}
			rootGroups = append(rootGroups, currentProviderGroup)
			currentTypeGroup = nil    // Reset type group when provider changes
			currentVersionGroup = nil // Reset version group when provider changes
		}

		// Check if Type changed or if it's the first model in this provider group
		if currentTypeGroup == nil || modelType != currentTypeGroup.GroupValue {
			log.Printf("[DEBUG] buildModelHierarchy:   Creating new type group: %s (under %s)", modelType, provider)
			currentTypeGroup = &models.HierarchicalModelGroup{
				GroupName:  "type",
				GroupValue: modelType,
				Children:   []*models.HierarchicalModelGroup{},
			}
			currentProviderGroup.Children = append(currentProviderGroup.Children, currentTypeGroup)
			currentVersionGroup = nil // Reset version group when type changes
		}

		// Check if Version/Variant changed or if it's the first model in this type group
		if currentVersionGroup == nil || version != currentVersionGroup.GroupValue {
			log.Printf("[DEBUG] buildModelHierarchy:     Creating new version group: %s (under %s > %s)", version, provider, modelType)
			currentVersionGroup = &models.HierarchicalModelGroup{
				GroupName:  "version", // Corresponds to Variant in the model
				GroupValue: version,
				Models:     []*models.Model{}, // Initialize empty model slice
			}
			currentTypeGroup.Children = append(currentTypeGroup.Children, currentVersionGroup)
		}

		// Add the model to the current version group
		// log.Printf("[DEBUG] buildModelHierarchy:       Adding model '%s' to version group '%s'", model.Name, version)
		currentVersionGroup.Models = append(currentVersionGroup.Models, model)
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
