use std::collections::HashMap;

// Internal representation of a single LLM model
#[derive(Debug, Clone)]
pub struct Model {
    pub id: String,
    pub name: Option<String>,
    pub context_size: i32,
    pub max_tokens: i32,
    pub provider: String,
    pub original_provider: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub cost_per_token: f64,
    pub capabilities: Vec<String>,
    pub family: Option<String>,
    pub model_type: Option<String>,
    pub series: Option<String>,
    pub variant: Option<String>,
    pub is_default: bool,
    pub is_multimodal: bool,
    pub is_experimental: bool,
    pub version: Option<String>,
    pub metadata: HashMap<String, String>,
}

// List of models input for classification
#[derive(Debug, Clone)]
pub struct LoadedModelList {
    pub models: Vec<Model>,
    pub default_provider: Option<String>,
    pub default_model: Option<String>,
}

// Property by which models can be classified
#[derive(Debug, Clone)]
pub struct ClassificationProperty {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub possible_values: Vec<String>,
}

// Group of models classified by a property
#[derive(Debug, Clone)]
pub struct ClassifiedModelGroup {
    pub property_name: String,
    pub property_value: String,
    pub models: Vec<Model>,
}

// Criteria for filtering/classifying models
#[derive(Debug, Clone)]
pub struct ClassificationCriteria {
    pub properties: Vec<String>,
    pub include_experimental: bool,
    pub include_deprecated: bool,
    pub min_context_size: i32,
    pub hierarchical: bool,
}

// Response for classification
#[derive(Debug, Clone)]
pub struct ClassifiedModelResponse {
    pub classified_groups: Vec<ClassifiedModelGroup>,
    pub available_properties: Vec<ClassificationProperty>,
    pub error_message: Option<String>,
    pub hierarchical_groups: Vec<HierarchicalModelGroup>,
}

// Hierarchical grouping of models (nested)
#[derive(Debug, Clone)]
pub struct HierarchicalModelGroup {
    pub group_name: String,
    pub group_value: String,
    pub models: Vec<Model>,
    pub children: Vec<HierarchicalModelGroup>,
}

// Available classification properties for use in responses
pub fn available_classification_properties() -> Vec<ClassificationProperty> {
    let mut properties = vec![
        ClassificationProperty {
            name: "provider".to_string(),
            display_name: Some("Provider".to_string()),
            description: Some("The AI provider that offers the model".to_string()),
            possible_values: vec![
                "openai", "anthropic", "gemini", "meta", "mistral", "cohere", "openrouter", "other",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        },
        ClassificationProperty {
            name: "family".to_string(),
            display_name: Some("Model Family".to_string()),
            description: Some("The family or generation that the model belongs to".to_string()),
            possible_values: vec![
                "GPT-4", "GPT-3.5", "Claude 3", "Claude 2", "Gemini 1.5", "Gemini 1.0", "Llama", "Mistral",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        },
        ClassificationProperty {
            name: "type".to_string(),
            display_name: Some("Model Type".to_string()),
            description: Some("The specific type or version of the model".to_string()),
            possible_values: vec![
                "Vision", "Standard", "Pro", "Flash", "Gemma", "Opus", "Sonnet", "Haiku", "Embedding", "O Series", "GPT 3.5", "GPT 4", "GPT 4.5", "Mini", "Flash Lite", "Thinking", "Image Generation",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        },
        ClassificationProperty {
            name: "context_window".to_string(),
            display_name: Some("Context Window".to_string()),
            description: Some("Grouping based on context window size".to_string()),
            possible_values: vec![
                "Small (< 10K)", "Medium (10K-100K)", "Large (100K-200K)", "Very Large (> 200K)",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        },
        ClassificationProperty {
            name: "capability".to_string(),
            display_name: Some("Capabilities".to_string()),
            description: Some("Special model capabilities".to_string()),
            possible_values: vec![
                "vision", "function-calling", "embedding", "streaming", "chat", "audio",
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        },
    ];
    // Sort capabilities alphabetically for consistency
    if let Some(prop) = properties.iter_mut().find(|p| p.name == "capability") {
        prop.possible_values
            .sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    }
    properties
} 