use std::collections::HashMap;
use super::{
    PROVIDER_OPENAI,
    PROVIDER_ANTHROPIC,
    PROVIDER_GEMINI,
    PROVIDER_META,
    PROVIDER_MISTRAL,
    PROVIDER_OPENROUTER,
    SERIES_CLAUDE3,
    SERIES_CLAUDE2,
    SERIES_CLAUDE1,
    TYPE_IMAGE,
    TYPE_EMBEDDING,
    TYPE_O,
    TYPE_35,
    TYPE_4,
    TYPE_45,
    TYPE_MINI,
    TYPE_OPUS,
    TYPE_SONNET,
    TYPE_HAIKU,
    TYPE_PRO,
    TYPE_GEMMA,
    TYPE_FLASH_LITE,
    TYPE_FLASH,
    TYPE_THINKING,
    TYPE_VISION,
    TYPE_STANDARD,
    CAP_VISION,
    CAP_FUNCTION_CALLING,
    CAP_EMBEDDING,
    CAP_CHAT,
    VERSION_10,
    VERSION_15,
    VERSION_20,
    VERSION_25,
    VERSION_30,
    VERSION_35,
    VERSION_37,
    VERSION_45,
};

/// PatternMatcher handles all pattern-based identification for models
pub struct PatternMatcher {
    pub provider_patterns: HashMap<String, Vec<String>>,
    pub series_patterns: HashMap<String, Vec<String>>,
    pub type_patterns: HashMap<String, Vec<String>>,
    pub capability_patterns: HashMap<String, Vec<String>>,
}

impl PatternMatcher {
    /// Creates a new PatternMatcher with predefined patterns
    pub fn new() -> Self {
        let mut provider_patterns = HashMap::new();
        provider_patterns.insert(PROVIDER_OPENAI.to_string(), vec!["openai".into(), "gpt".into(), "o1".into(), "dall-e".into()]);
        provider_patterns.insert(PROVIDER_ANTHROPIC.to_string(), vec!["anthropic".into(), "claude".into()]);
        provider_patterns.insert(PROVIDER_GEMINI.to_string(), vec!["gemini".into(), "google".into()]);
        provider_patterns.insert(PROVIDER_META.to_string(), vec!["meta".into(), "llama".into(), "meta-llama".into()]);
        provider_patterns.insert(PROVIDER_MISTRAL.to_string(), vec!["mistral".into(), "mixtral".into()]);
        provider_patterns.insert(PROVIDER_OPENROUTER.to_string(), vec!["openrouter".into()]);

        let mut series_patterns = HashMap::new();
        series_patterns.insert(SERIES_CLAUDE3.to_string(), vec!["claude-3".into(), "claude3".into(), "claude-3.5".into(), "claude-3.7".into()]);
        series_patterns.insert(SERIES_CLAUDE2.to_string(), vec!["claude-2".into(), "claude2".into()]);
        series_patterns.insert(SERIES_CLAUDE1.to_string(), vec!["claude-1".into(), "claude1".into(), "claude-instant".into()]);
        series_patterns.insert(format!("{} {}", "Gemini", VERSION_10), vec!["gemini-1.0".into(), "gemini-1.0-pro".into()]);
        series_patterns.insert(format!("{} {}", "Gemini", VERSION_15), vec!["gemini-1.5".into(), "gemini-1.5-pro".into(), "gemini-1.5-flash".into()]);
        series_patterns.insert(format!("{} {}", "Gemini", VERSION_20), vec!["gemini-2.0".into(), "gemini-2.0-pro".into(), "gemini-2.0-flash".into()]);
        series_patterns.insert(format!("{} {}", "Gemini", VERSION_25), vec!["gemini-2.5".into(), "gemini-2.5-pro".into(), "gemini-2.5-flash".into()]);
        series_patterns.insert("Gemma 2".into(), vec!["gemma-2".into()]);
        series_patterns.insert(TYPE_IMAGE.to_string(), vec!["dall-e".into(), "imagen".into(), "midjourney".into(), "stable-diffusion".into()]);
        series_patterns.insert(TYPE_EMBEDDING.to_string(), vec!["embedding".into(), "text-embedding".into(), "embed".into()]);

        let mut type_patterns = HashMap::new();
        type_patterns.insert(TYPE_O.to_string(), vec!["o1".into(), "o3".into(), "o4".into()]);
        type_patterns.insert(TYPE_35.to_string(), vec!["gpt-3.5".into(), "gpt3.5".into()]);
        type_patterns.insert(TYPE_4.to_string(), vec!["gpt-4".into(), "gpt4".into(), "gpt-4o".into()]);
        type_patterns.insert(TYPE_45.to_string(), vec!["gpt-4.5".into(), "gpt4.5".into()]);
        type_patterns.insert(TYPE_MINI.to_string(), vec!["mini".into()]);
        type_patterns.insert(TYPE_OPUS.to_string(), vec!["opus".into()]);
        type_patterns.insert(TYPE_SONNET.to_string(), vec!["sonnet".into()]);
        type_patterns.insert(TYPE_HAIKU.to_string(), vec!["haiku".into()]);
        type_patterns.insert(TYPE_PRO.to_string(), vec!["pro".into()]);
        type_patterns.insert(TYPE_FLASH_LITE.to_string(), vec!["flash-lite".into()]);
        type_patterns.insert(TYPE_FLASH.to_string(), vec!["flash".into()]);
        type_patterns.insert(TYPE_THINKING.to_string(), vec!["thinking".into()]);
        type_patterns.insert(TYPE_VISION.to_string(), vec!["vision".into(), "multimodal".into()]);
        type_patterns.insert(TYPE_EMBEDDING.to_string(), vec!["embedding".into(), "embed".into(), "tts".into()]);

        let mut capability_patterns = HashMap::new();
        capability_patterns.insert(CAP_VISION.to_string(), vec!["vision".into(), "image".into(), "multimodal".into()]);
        capability_patterns.insert(CAP_FUNCTION_CALLING.to_string(), vec!["function".into(), "tool".into(), "api".into()]);
        capability_patterns.insert(CAP_EMBEDDING.to_string(), vec!["embedding".into(), "embed".into(), "vector".into()]);
        capability_patterns.insert("audio".into(), vec!["whisper".into(), "tts".into(), "speech".into(), "audio".into()]);
        capability_patterns.insert(CAP_CHAT.to_string(), vec!["chat".into(), "conversation".into(), "completion".into()]);

        PatternMatcher { provider_patterns, series_patterns, type_patterns, capability_patterns }
    }

    /// Match a provider by exact name
    pub fn match_provider_by_name(&self, provider_name: &str) -> String {
        for provider in self.provider_patterns.keys() {
            if provider_name == provider.to_lowercase() {
                return provider.clone();
            }
        }
        "".into()
    }

    /// Match a provider based on patterns in the model name
    pub fn match_provider_by_pattern(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        for (provider, patterns) in &self.provider_patterns {
            for pat in patterns {
                if lower.contains(pat) {
                    return provider.clone();
                }
            }
        }
        "".into()
    }

    /// Match Claude series versions
    pub fn match_claude_version(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        for pat in &self.series_patterns[SERIES_CLAUDE3] { if lower.contains(pat) { return SERIES_CLAUDE3.into() } }
        for pat in &self.series_patterns[SERIES_CLAUDE2] { if lower.contains(pat) { return SERIES_CLAUDE2.into() } }
        for pat in &self.series_patterns[SERIES_CLAUDE1] { if lower.contains(pat) { return SERIES_CLAUDE1.into() } }
        "".into()
    }

    /// Match Gemini series versions
    pub fn match_gemini_version(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        if lower.contains("2.5") { return format!("{} {}", "Gemini", VERSION_25) }
        if lower.contains("2.0") { return format!("{} {}", "Gemini", VERSION_20) }
        if lower.contains("1.5") { return format!("{} {}", "Gemini", VERSION_15) }
        format!("{} {}", "Gemini", VERSION_10)
    }

    /// Match series by generic patterns
    pub fn match_series_by_pattern(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        for (series, patterns) in &self.series_patterns {
            for pat in patterns {
                if lower.contains(pat) { return series.clone() }
            }
        }
        "".into()
    }

    /// Match OpenAI-specific type
    pub fn match_openai_type(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        if lower.contains("mini") { return TYPE_MINI.into() }
        if lower.contains("o1") || lower.contains("o3") { return TYPE_O.into() }
        if lower.contains("gpt-4.5") { return TYPE_45.into() }
        if lower.contains("gpt-4") { return TYPE_4.into() }
        if lower.contains("gpt-3.5") { return TYPE_35.into() }
        TYPE_STANDARD.into()
    }

    /// Match Anthropic-specific type
    pub fn match_anthropic_type(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        if lower.contains("opus") { return TYPE_OPUS.into() }
        if lower.contains("sonnet") { return TYPE_SONNET.into() }
        if lower.contains("haiku") { return TYPE_HAIKU.into() }
        TYPE_STANDARD.into()
    }

    /// Match Gemini-specific type
    pub fn match_gemini_type(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        if lower.contains("flash-lite") { return TYPE_FLASH_LITE.into() }
        if lower.contains("thinking") { return TYPE_THINKING.into() }
        if lower.contains("flash") { return TYPE_FLASH.into() }
        if lower.contains("pro") { return TYPE_PRO.into() }
        if lower.contains("gemma") { return TYPE_GEMMA.into() }
        TYPE_STANDARD.into()
    }

    /// Generic type matching by patterns
    pub fn match_type_by_pattern(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        for (typ, patterns) in &self.type_patterns {
            for pat in patterns {
                if lower.contains(pat) { return typ.clone() }
            }
        }
        "".into()
    }

    /// Match OpenAI variant
    pub fn match_openai_variant(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        if lower.contains("gpt-4.5") { return format!("GPT-{}", VERSION_45) }
        if lower.contains("gpt-4o-mini") { return "GPT-4o Mini".into() }
        if lower.contains("gpt-4o") { return "GPT-4o".into() }
        if lower.contains("gpt-4-turbo") { return "GPT-4 Turbo".into() }
        if lower.contains("gpt-4-vision") { return "GPT-4 Vision".into() }
        if lower.contains("o1-mini") { return "O1 Mini".into() }
        if lower.contains("o1") { return "O1".into() }
        "".into()
    }

    /// Match Anthropic variant
    pub fn match_anthropic_variant(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        if lower.contains("claude-3.7") { return format!("Claude {}", VERSION_37) }
        if lower.contains("claude-3.5") { return format!("Claude {}", VERSION_35) }
        if lower.contains("claude-3") { return format!("Claude {}", VERSION_30) }
        if lower.contains("claude-2") { return format!("Claude {}", VERSION_20) }
        if lower.contains("claude-instant") { return "Claude Instant".into() }
        "".into()
    }

    /// Build Gemini variant combining version and type
    pub fn build_gemini_variant(&self, model_name: &str) -> String {
        let lower = model_name.to_lowercase();
        let version = if lower.contains("2.5") { VERSION_25 } else if lower.contains("2.0") { VERSION_20 } else if lower.contains("1.5") { VERSION_15 } else if lower.contains("1.0") { VERSION_10 } else { "" }
        .to_string();
        let typ = if lower.contains("flash-lite") { TYPE_FLASH_LITE } else if lower.contains("thinking") { TYPE_THINKING } else if lower.contains("flash") { TYPE_FLASH } else if lower.contains("pro") { TYPE_PRO } else { "" };
        match (version.as_str(), typ) {
            (v, t) if !v.is_empty() && !t.is_empty() => format!("Gemini {} {}", v, t),
            (v, _) if !v.is_empty() => format!("Gemini {}", v),
            (_, t) if !t.is_empty() => format!("Gemini {}", t),
            _ => "".into(),
        }
    }

    /// Add capabilities based on model traits
    pub fn add_capabilities(&self, caps: &mut HashMap<String, bool>, model_type: &str, model_name: &str, provider: &str, series: &str) {
        let lower = model_name.to_lowercase();
        if lower.contains("vision") || lower.contains("multimodal") || [TYPE_4, TYPE_45, TYPE_O].contains(&model_type) || series == SERIES_CLAUDE3 || lower.contains("4o") || series.starts_with("Gemini") {
            caps.insert(CAP_VISION.to_string(), true);
        }
        if [TYPE_4, TYPE_45, TYPE_35, TYPE_O].contains(&model_type) || series == SERIES_CLAUDE3 || series.starts_with("Gemini") {
            caps.insert(CAP_FUNCTION_CALLING.to_string(), true);
        }
    }
} 