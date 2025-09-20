use std::collections::HashSet;

/// Handles detection of default model configurations
pub struct DefaultModels {
    default_models: HashSet<String>,
}

impl DefaultModels {
    /// Creates a new default model detector
    pub fn new() -> Self {
        let models = [
            "gpt-3.5-turbo",
            "gpt-4",
            "gpt-4o",
            "claude-3-sonnet",
            "claude-3-opus",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-2.0-pro",
        ];
        let default_models = models.iter().map(|s| s.to_string()).collect();
        DefaultModels { default_models }
    }

    /// Checks if a model ID corresponds to a default model
    pub fn is_default_model(&self, model_id: &str) -> bool {
        if self.default_models.contains(model_id) {
            return true;
        }
        let model_lower = model_id.to_lowercase();
        self.default_models
            .iter()
            .any(|m| m.eq_ignore_ascii_case(&model_lower))
    }
} 