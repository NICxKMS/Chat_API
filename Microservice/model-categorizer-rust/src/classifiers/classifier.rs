use crate::classifiers::{PatternMatcher, ContextResolver, DefaultModels,
    PROVIDER_OPENAI, PROVIDER_ANTHROPIC, PROVIDER_GEMINI, PROVIDER_OTHER, PROVIDER_OPENROUTER,
    TYPE_STANDARD, TYPE_EMBEDDING, TYPE_IMAGE,
    VERSION_10, VERSION_15, VERSION_20, VERSION_25, VERSION_30,
    VERSION_35, VERSION_37, VERSION_40, VERSION_45,
    CAP_VISION, CAP_EMBEDDING, CAP_CHAT};

/// Structured metadata for a model
#[derive(Debug, Clone)]
pub struct ModelMetadata {
    pub provider: String,
    pub series: String,
    pub model_type: String,
    pub variant: String,
    pub context: i32,
    pub capabilities: Vec<String>,
    pub is_multimodal: bool,
    pub is_experimental: bool,
    pub display_name: String,
}

/// Classifier for model identification and metadata population
pub struct ModelClassifier {
    patterns: PatternMatcher,
    context: ContextResolver,
    defaults: DefaultModels,
}

impl ModelClassifier {
    /// Create a new classifier instance
    pub fn new() -> Self {
        Self {
            patterns: PatternMatcher::new(),
            context: ContextResolver::new(),
            defaults: DefaultModels::new(),
        }
    }

    /// Classify a model ID into metadata
    pub fn classify_model(&self, model_id: &str, provider_hint: &str) -> ModelMetadata {
        let model_lower = model_id.to_lowercase();
        if self.is_image_generation_model(&model_lower) {
            return self.create_image_generation_metadata(&model_lower, provider_hint);
        }
        if self.is_embedding_model(&model_lower) {
            return self.create_embedding_model_metadata(&model_lower, provider_hint);
        }
        self.build_standard_model_metadata(&model_lower, provider_hint)
    }

    fn create_image_generation_metadata(&self, model_name: &str, provider_hint: &str) -> ModelMetadata {
        let provider = self.determine_provider(model_name, provider_hint);
        ModelMetadata {
            provider: provider.clone(),
            series: TYPE_IMAGE.to_string(),
            model_type: TYPE_IMAGE.to_string(),
            variant: "Image Generation".to_string(),
            context: 0,
            capabilities: vec![TYPE_IMAGE.to_string()],
            is_multimodal: false,
            is_experimental: false,
            display_name: model_name.to_string(),
        }
    }

    fn create_embedding_model_metadata(&self, model_name: &str, provider_hint: &str) -> ModelMetadata {
        let provider = self.determine_provider(model_name, provider_hint);
        ModelMetadata {
            provider: provider.clone(),
            series: TYPE_EMBEDDING.to_string(),
            model_type: TYPE_EMBEDDING.to_string(),
            variant: "Embedding".to_string(),
            context: 0,
            capabilities: vec![CAP_EMBEDDING.to_string()],
            is_multimodal: false,
            is_experimental: false,
            display_name: model_name.to_string(),
        }
    }

    fn build_standard_model_metadata(&self, model_name: &str, provider_hint: &str) -> ModelMetadata {
        let provider = self.determine_provider(model_name, provider_hint);
        let series = self.determine_series(model_name, &provider);
        let model_type = self.determine_type(model_name, &provider, &series);
        let variant = self.determine_variant(model_name, &provider, &series);
        let context = self.context.get_context_size(model_name);
        let caps = self.detect_capabilities(model_name, &provider, &series);
        let is_multimodal = self.is_multimodal(model_name, &caps, &series);
        let is_experimental = self.is_experimental(model_name);
        ModelMetadata {
            provider,
            series,
            model_type,
            variant,
            context,
            capabilities: caps,
            is_multimodal,
            is_experimental,
            display_name: model_name.to_string(),
        }
    }

    fn determine_provider(&self, model_name: &str, provider_hint: &str) -> String {
        if !provider_hint.is_empty() {
            let hint = provider_hint.to_lowercase();
            let p = self.patterns.match_provider_by_name(&hint);
            if !p.is_empty() {
                return p;
            }
        }
        if let Some((pref, _)) = model_name.split_once('/') {
            let p = self.patterns.match_provider_by_name(&pref.to_lowercase());
            if !p.is_empty() { return p; }
        }
        let p = self.patterns.match_provider_by_pattern(model_name);
        if !p.is_empty() { p } else { PROVIDER_OTHER.to_string() }
    }

    fn determine_series(&self, model_name: &str, provider: &str) -> String {
        match provider {
            PROVIDER_OPENAI => {
                let c0 = model_name.chars().next().unwrap_or_default();
                if c0 == 'o' { return "O".into(); }
                if c0 == 'g' { return "GPT".into(); }
                if c0 == 'd' { return "DALL-E".into(); }
            }
            PROVIDER_ANTHROPIC => {
                let v = self.patterns.match_claude_version(model_name);
                if !v.is_empty() { return v; }
            }
            PROVIDER_GEMINI => return self.patterns.match_gemini_version(model_name),
            _ => {}
        }
        let v = self.patterns.match_series_by_pattern(model_name);
        if !v.is_empty() { v } else { "General".into() }
    }

    fn determine_type(&self, model_name: &str, provider: &str, series: &str) -> String {
        match provider {
            PROVIDER_OPENAI => return self.patterns.match_openai_type(model_name),
            PROVIDER_ANTHROPIC => return self.patterns.match_anthropic_type(model_name),
            PROVIDER_GEMINI => return self.patterns.match_gemini_type(model_name),
            _ => {}
        }
        let t = self.patterns.match_type_by_pattern(model_name);
        if !t.is_empty() { t } else { TYPE_STANDARD.to_string() }
    }

    fn determine_variant(&self, model_name: &str, provider: &str, series: &str) -> String {
        match provider {
            PROVIDER_OPENAI => {
                let v = self.patterns.match_openai_variant(model_name);
                if !v.is_empty() { return v; }
            }
            PROVIDER_ANTHROPIC => {
                let v = self.patterns.match_anthropic_variant(model_name);
                if !v.is_empty() { return v; }
            }
            PROVIDER_GEMINI => {
                let v = self.patterns.build_gemini_variant(model_name);
                if !v.is_empty() { return v; }
            }
            _ => {}
        }
        // Fallback to version-based variant
        let v = extract_version_variant(model_name, series);
        if !v.is_empty() {
            v
        } else {
            series.to_string()
        }
    }

    fn detect_capabilities(&self, model_name: &str, provider: &str, series: &str) -> Vec<String> {
        let mut caps = std::collections::HashMap::new();
        self.patterns.add_capabilities(&mut caps, &self.determine_type(model_name, provider, series), model_name, provider, series);
        caps.insert(CAP_CHAT.to_string(), true);
        // Collect capabilities set to true and sort them alphabetically for consistency
        let mut caps_list: Vec<String> = caps.into_iter()
            .filter(|(_, v)| *v)
            .map(|(k, _)| k)
            .collect();
        caps_list.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        caps_list
    }

    fn is_embedding_model(&self, model_name: &str) -> bool {
        model_name.contains("embedding") || model_name.contains("embed") || model_name.contains("text-embedding")
    }

    fn is_image_generation_model(&self, model_name: &str) -> bool {
        model_name.contains("image") || model_name.contains("dall-e") || model_name.contains("stable-diffusion")
    }

    fn is_multimodal(&self, model_name: &str, caps: &[String], series: &str) -> bool {
        caps.iter().any(|c| c == CAP_VISION) || series.contains("Vision")
    }

    fn is_experimental(&self, model_name: &str) -> bool {
        model_name.contains("alpha") || model_name.contains("beta") || model_name.contains("experimental")
    }

    /// Get model hierarchy fields
    pub fn get_model_hierarchy(&self, model_id: &str, provider: &str) -> (String, String, String, String) {
        let md = self.classify_model(model_id, provider);
        (md.provider, md.series, md.model_type, md.variant)
    }

    /// Get series and variant only
    pub fn get_series_and_variant(model_id: &str) -> (String, String) {
        let mc = ModelClassifier::new();
        let md = mc.classify_model(model_id, "");
        (md.series, md.variant)
    }

    /// Normalize OpenRouter names
    pub fn normalize_model_name(model_id: &str, provider: &str) -> String {
        if provider.eq_ignore_ascii_case(PROVIDER_OPENROUTER) {
            if let Some((pref, rest)) = model_id.split_once('/') {
                let known = [PROVIDER_ANTHROPIC, PROVIDER_OPENAI, "google", "meta-llama", "mistralai"];
                if known.iter().any(|p| pref.eq_ignore_ascii_case(p)) {
                    return rest.to_string();
                }
            }
        }
        model_id.to_string()
    }

    /// Standardize version numbers
    pub fn get_standardized_version(model_name: &str) -> String {
        let m = model_name.to_lowercase();
        if m.contains("4.5") { return VERSION_45.to_string(); }
        if m.contains("4.0") || m.contains("4o") { return VERSION_40.to_string(); }
        if m.contains("3.7") { return VERSION_37.to_string(); }
        if m.contains("3.5") { return VERSION_35.to_string(); }
        if m.contains("3.0") { return VERSION_30.to_string(); }
        if m.contains("2.5") { return VERSION_25.to_string(); }
        if m.contains("2.0") { return VERSION_20.to_string(); }
        if m.contains("1.5") { return VERSION_15.to_string(); }
        if m.contains("1.0") { return VERSION_10.to_string(); }
        "".to_string()
    }
}

/// Extract version variant like "Series 4.5"
fn extract_version_variant(model_name: &str, series: &str) -> String {
    let nums = extract_version_numbers(model_name);
    if nums.is_empty() { return String::new(); }
    let vs: Vec<String> = nums.iter().map(|n| n.to_string()).collect();
    format!("{} {}", series, vs.join("."))
}

/// Extract numeric version parts
fn extract_version_numbers(s: &str) -> Vec<i32> {
    let filtered: String = s.chars()
        .map(|c| if c.is_digit(10) || c == '.' { c } else { ' ' })
        .collect();
    filtered.split_whitespace().filter_map(|part| part.parse::<i32>().ok()).collect()
}

/// Compare version strings
fn is_newer_version(a: &str, b: &str) -> bool {
    let na = extract_version_numbers(a);
    let nb = extract_version_numbers(b);
    na > nb
} 