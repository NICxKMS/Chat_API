package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Configuration holds all config values
type Configuration struct {
	// Server configuration
	Port                string
	Environment         string
	ResponseTimeout     int
	MaxRequestSize      string
	RequestRateLimit    int
	ConcurrentReqLimit  int
	
	// Provider API keys and URLs
	OpenAI struct {
		APIKey  string
		BaseURL string
	}
	
	Anthropic struct {
		APIKey  string
		BaseURL string
	}
	
	Gemini struct {
		APIKey     string
		APIVersion string
		Dynamic    bool
	}
	
	OpenRouter struct {
		APIKey    string
		BaseURL   string
		Referer   string
		AppTitle  string
	}
	
	// Cache configuration
	UseRedisCache     bool
	RedisURL          string
	MemoryCacheTTL    int
	RedisCacheTTL     int
	
	// Default settings
	DefaultProvider   string
	DynamicModels     bool
}

// LoadConfig loads configuration from .env file and environment variables
func LoadConfig() (*Configuration, error) {
	// Load .env file if it exists
	err := godotenv.Load(".env")
	if err != nil {
		// Try to load from the current directory
		err = godotenv.Load()
		if err != nil {
			log.Println("Warning: .env file not found, using environment variables only")
		}
	}
	
	config := &Configuration{
		// Server defaults
		Port:               getEnv("PORT", "8080"),
		Environment:        getEnv("NODE_ENV", "development"),
		ResponseTimeout:    getEnvAsInt("RESPONSE_TIMEOUT", 30000),
		MaxRequestSize:     getEnv("MAX_REQUEST_SIZE", "1MB"),
		RequestRateLimit:   getEnvAsInt("REQUEST_RATE_LIMIT", 100),
		ConcurrentReqLimit: getEnvAsInt("CONCURRENT_REQUEST_LIMIT", 20),
		
		// Default settings
		DefaultProvider:    getEnv("DEFAULT_PROVIDER", "openai"),
		DynamicModels:      getEnvAsBool("DYNAMIC_MODEL_LOADING", true),
		
		// Cache settings
		UseRedisCache:      getEnvAsBool("USE_REDIS_CACHE", false),
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379"),
		MemoryCacheTTL:     getEnvAsInt("MEMORY_CACHE_TTL", 300),
		RedisCacheTTL:      getEnvAsInt("REDIS_CACHE_TTL", 1800),
	}
	
	// Load OpenAI configuration
	config.OpenAI.APIKey = getEnv("OPENAI_API_KEY", "")
	config.OpenAI.BaseURL = getEnv("OPENAI_BASE_URL", "https://api.openai.com/v1")
	
	// Load Anthropic configuration
	config.Anthropic.APIKey = getEnv("ANTHROPIC_API_KEY", "")
	config.Anthropic.BaseURL = getEnv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
	
	// Load Gemini configuration
	config.Gemini.APIKey = getEnv("GOOGLE_API_KEY", "")
	config.Gemini.APIVersion = getEnv("GEMINI_API_VERSION", "v1beta")
	config.Gemini.Dynamic = getEnvAsBool("GEMINI_DYNAMIC_MODELS", true)
	
	// Load OpenRouter configuration
	config.OpenRouter.APIKey = getEnv("OPENROUTER_API_KEY", "")
	config.OpenRouter.BaseURL = getEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
	config.OpenRouter.Referer = getEnv("OPENROUTER_HTTP_REFERER", "https://localhost:3000")
	config.OpenRouter.AppTitle = getEnv("OPENROUTER_TITLE", "Model Categorizer")
	
	return config, nil
}

// Helper functions to get environment variables with defaults
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return defaultValue
	}
	
	// Check for true/false strings
	valueStr = strings.ToLower(valueStr)
	if valueStr == "true" || valueStr == "yes" || valueStr == "1" || valueStr == "y" {
		return true
	} else if valueStr == "false" || valueStr == "no" || valueStr == "0" || valueStr == "n" {
		return false
	}
	
	return defaultValue
} 