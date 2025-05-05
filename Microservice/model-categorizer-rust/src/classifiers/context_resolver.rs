use std::collections::HashMap;

/// Handles determining the context window size for models
pub struct ContextResolver {
    context_sizes: HashMap<String, i32>,
}

impl ContextResolver {
    /// Creates a new context window size resolver
    pub fn new() -> Self {
        let mut context_sizes = HashMap::new();
        // OpenAI
        context_sizes.insert("gpt-4o".into(), 128000);
        context_sizes.insert("gpt-4o-mini".into(), 128000);
        context_sizes.insert("gpt-4-turbo".into(), 128000);
        context_sizes.insert("gpt-4-vision".into(), 128000);
        context_sizes.insert("gpt-4-32k".into(), 32768);
        context_sizes.insert("gpt-4".into(), 8192);
        context_sizes.insert("gpt-4.5".into(), 128000);
        context_sizes.insert("gpt-3.5-turbo-16k".into(), 16385);
        context_sizes.insert("gpt-3.5-turbo".into(), 4096);
        context_sizes.insert("o1".into(), 32768);
        context_sizes.insert("o1-mini".into(), 32768);
        // Claude
        context_sizes.insert("claude-3-opus".into(), 200000);
        context_sizes.insert("claude-3-sonnet".into(), 200000);
        context_sizes.insert("claude-3-haiku".into(), 200000);
        context_sizes.insert("claude-3.5-sonnet".into(), 200000);
        context_sizes.insert("claude-3.7-opus".into(), 200000);
        context_sizes.insert("claude-2".into(), 100000);
        context_sizes.insert("claude-instant".into(), 100000);
        // Gemini
        context_sizes.insert("gemini-1.0-pro".into(), 32768);
        context_sizes.insert("gemini-1.5-pro".into(), 1_000_000);
        context_sizes.insert("gemini-1.5-flash".into(), 1_000_000);
        context_sizes.insert("gemini-2.0-pro".into(), 2_000_000);
        context_sizes.insert("gemini-2.0-flash".into(), 1_000_000);
        context_sizes.insert("gemini-2.0-flash-lite".into(), 1_000_000);

        ContextResolver { context_sizes }
    }

    /// Determine a model's context window based on its ID
    pub fn get_context_size(&self, model_id: &str) -> i32 {
        let lower = model_id.to_lowercase();
        // Exact match first
        for (model, &size) in &self.context_sizes {
            if lower.contains(model) {
                return size;
            }
        }
        // Fallback to family heuristics
        self.get_context_size_by_family(&lower)
    }

    /// Heuristics for common model families
    fn get_context_size_by_family(&self, lower: &str) -> i32 {
        // GPT family
        if lower.contains("gpt-4.5") {
            return 128000;
        }
        if lower.contains("gpt-4") {
            if lower.contains("32k") {
                return 32768;
            }
            if lower.contains("turbo") || lower.contains('o') {
                return 128000;
            }
            return 8192;
        }
        if lower.contains("gpt-3.5") {
            if lower.contains("16k") {
                return 16385;
            }
            return 4096;
        }
        // Claude family
        if lower.contains("claude-3") {
            return 200000;
        }
        if lower.contains("claude-2") || lower.contains("claude-instant") {
            return 100000;
        }
        // Gemini family
        if lower.contains("gemini-1.0") {
            return 32768;
        }
        if lower.contains("gemini-1.5") || lower.contains("gemini-2.0") {
            return if lower.contains("flash-lite") || lower.contains("flash") || lower.contains("pro") {
                1_000_000
            } else {
                1_000_000
            };
        }
        // Default
        0
    }
} 