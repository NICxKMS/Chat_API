// Declare utilities sub-module
mod utils;

// External imports
use tonic::{Request, Response, Status};
use tonic::async_trait;

// gRPC types
use crate::proto::modelservice::{LoadedModelList, ClassificationCriteria, ClassifiedModelResponse};
use crate::proto::modelservice::model_classification_service_server::ModelClassificationService;

// Internal imports
use crate::classifiers::ModelClassifier;
use crate::classifiers::TYPE_STANDARD;
use crate::handlers::utils::{
    convert_proto_models_to_internal,
    convert_internal_hierarchical_group_to_proto,
    convert_to_proto_properties,
    categorize_context_window,
    bool_to_yes_no,
    filter_models_by_criteria,
    sort_models,
    classify_models_by_property,
};
use crate::models::{available_classification_properties, Model, HierarchicalModelGroup};

/// gRPC handler for model classification
pub struct ModelClassificationHandler {
    classifier: ModelClassifier,
}

impl Default for ModelClassificationHandler {
    fn default() -> Self {
        Self { classifier: ModelClassifier::new() }
    }
}

#[async_trait]
impl ModelClassificationService for ModelClassificationHandler {
    /// Hierarchical classification endpoint
    async fn classify_models(
        &self,
        request: Request<LoadedModelList>,
    ) -> Result<Response<ClassifiedModelResponse>, Status> {
        let req = request.into_inner();
        // Convert to internal models
        let mut internal = convert_proto_models_to_internal(&req.models);
        // Enhance models with classifier metadata
        for m in &mut internal {
            let meta = self.classifier.classify_model(&m.id, &m.provider);
            // apply classification metadata fields onto m
            m.provider = meta.provider;
            m.series = Some(meta.series.clone());
            m.model_type = Some(meta.model_type.clone());
            m.variant = Some(meta.variant.clone());
            // only override context_size if not already set in request
            if m.context_size == 0 {
                m.context_size = meta.context;
            }
            m.capabilities = meta.capabilities.clone();
            m.is_multimodal = meta.is_multimodal;
            m.is_experimental = meta.is_experimental;
            // only override display_name if not already set in request
            if m.display_name.is_none() {
                m.display_name = Some(meta.display_name.clone());
            }
        }
        // Build hierarchical groups
        let root_groups = build_model_hierarchy(&internal);
        // Convert to proto
        let proto_groups: Vec<_> = root_groups.iter()
            .map(convert_internal_hierarchical_group_to_proto)
            .collect();
        // Available properties
        let props = available_classification_properties();
        let available = convert_to_proto_properties(&props);
        // Construct response
        let response = ClassifiedModelResponse {
            classified_groups: Vec::new(),
            available_properties: available,
            error_message: String::new(),
            hierarchical_groups: proto_groups,
        };
        Ok(Response::new(response))
    }

    /// Classification with filtering criteria
    async fn classify_models_with_criteria(
        &self,
        request: Request<ClassificationCriteria>,
    ) -> Result<Response<ClassifiedModelResponse>, Status> {
        let _req = request.into_inner();
        // TODO: implement filtering and both flat/hierarchical classification as in Go version
        Err(Status::unimplemented("ClassifyModelsWithCriteria is not yet implemented"))
    }
}

/// Helper to build hierarchical groups (ported from Go)
fn build_model_hierarchy(
    models: &[crate::models::Model]
) -> Vec<crate::models::HierarchicalModelGroup> {
    // Clone and sort models
    let mut sorted = models.to_vec();
    sort_models(&mut sorted);
    let mut root_groups: Vec<crate::models::HierarchicalModelGroup> = Vec::new();
    let mut provider_idx: Option<usize> = None;
    let mut type_idx: Option<usize> = None;
    let mut version_idx: Option<usize> = None;

    for m in sorted.into_iter() {
        // Determine grouping keys
        let mut provider = m.original_provider.clone().unwrap_or_else(|| m.provider.clone());
        if provider.is_empty() { provider = "Other".to_string(); }
        let mut model_type = m.model_type.clone().unwrap_or_else(|| TYPE_STANDARD.to_string());
        if model_type.is_empty() { model_type = TYPE_STANDARD.to_string(); }
        let mut version = m.variant.clone().unwrap_or_else(|| "Default".to_string());
        if version.is_empty() { version = "Default".to_string(); }

        // Provider group
        if provider_idx.is_none()
            || root_groups[provider_idx.unwrap()].group_value != provider {
            root_groups.push(crate::models::HierarchicalModelGroup {
                group_name: "provider".to_string(),
                group_value: provider.clone(),
                models: Vec::new(),
                children: Vec::new(),
            });
            provider_idx = Some(root_groups.len() - 1);
            type_idx = None;
            version_idx = None;
        }
        let pg = &mut root_groups[provider_idx.unwrap()];

        // Type group
        if type_idx.is_none()
            || pg.children[type_idx.unwrap()].group_value != model_type {
            pg.children.push(crate::models::HierarchicalModelGroup {
                group_name: "type".to_string(),
                group_value: model_type.clone(),
                models: Vec::new(),
                children: Vec::new(),
            });
            type_idx = Some(pg.children.len() - 1);
            version_idx = None;
        }
        let tg = &mut pg.children[type_idx.unwrap()];

        // Version group
        if version_idx.is_none()
            || tg.children[version_idx.unwrap()].group_value != version {
            tg.children.push(crate::models::HierarchicalModelGroup {
                group_name: "version".to_string(),
                group_value: version.clone(),
                models: Vec::new(),
                children: Vec::new(),
            });
            version_idx = Some(tg.children.len() - 1);
        }
        let vg = &mut tg.children[version_idx.unwrap()];

        // Add model to version group
        vg.models.push(m);
    }
    root_groups
} 