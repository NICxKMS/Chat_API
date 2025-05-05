// Provider constants
pub const PROVIDER_OPENAI: &str = "openai";
pub const PROVIDER_ANTHROPIC: &str = "anthropic";
pub const PROVIDER_GEMINI: &str = "gemini";
pub const PROVIDER_META: &str = "meta";
pub const PROVIDER_MISTRAL: &str = "mistral";
pub const PROVIDER_OTHER: &str = "other";
pub const PROVIDER_OPENROUTER: &str = "openrouter";

// Series constants
pub const SERIES_CLAUDE3: &str = "Claude 3";
pub const SERIES_CLAUDE2: &str = "Claude 2";
pub const SERIES_CLAUDE1: &str = "Claude 1";

// OpenAI type constants
pub const TYPE_O: &str = "O Series";
pub const TYPE_35: &str = "GPT 3.5";
pub const TYPE_4: &str = "GPT 4";
pub const TYPE_45: &str = "GPT 4.5";
pub const TYPE_MINI: &str = "Mini";

// Other type constants
pub const TYPE_OPUS: &str = "Opus";
pub const TYPE_SONNET: &str = "Sonnet";
pub const TYPE_HAIKU: &str = "Haiku";
pub const TYPE_THINKING: &str = "Thinking";
pub const TYPE_PRO: &str = "Pro";
pub const TYPE_GEMMA: &str = "Gemma";
pub const TYPE_FLASH_LITE: &str = "Flash Lite";
pub const TYPE_FLASH: &str = "Flash";
pub const TYPE_VISION: &str = "Vision";
pub const TYPE_STANDARD: &str = "Standard";
pub const TYPE_EMBEDDING: &str = "Embedding";
pub const TYPE_IMAGE: &str = "Image Generation";

// Version constants
pub const VERSION_10: &str = "1.0";
pub const VERSION_15: &str = "1.5";
pub const VERSION_20: &str = "2.0";
pub const VERSION_25: &str = "2.5";
pub const VERSION_30: &str = "3.0";
pub const VERSION_35: &str = "3.5";
pub const VERSION_37: &str = "3.7";
pub const VERSION_40: &str = "4.0";
pub const VERSION_45: &str = "4.5";

// Capability constants
pub const CAP_VISION: &str = "vision";
pub const CAP_FUNCTION_CALLING: &str = "function-calling";
pub const CAP_EMBEDDING: &str = "embedding";
pub const CAP_CHAT: &str = "chat";

// Sub-modules
pub mod pattern_matcher;
pub mod context_resolver;
pub mod default_models;
pub mod classifier;

// Exports
pub use pattern_matcher::PatternMatcher;
pub use context_resolver::ContextResolver;
pub use default_models::DefaultModels;
pub use classifier::ModelClassifier; 