export const FALLBACK_CATEGORIES = [
  {
    name: "Latest & Greatest",
    providers: [
      {
        name: "openai",
        models: [
          { name: "gpt-4o", isExperimental: false },
          { name: "gpt-4-turbo", isExperimental: false },
          { name: "gpt-4", isExperimental: false }
        ]
      },
      {
        name: "anthropic",
        models: [
          { name: "claude-3-opus", isExperimental: false },
          { name: "claude-3-sonnet", isExperimental: false },
          { name: "claude-3-haiku", isExperimental: false }
        ]
      },
      {
        name: "google",
        models: [
          { name: "gemini-1.5-pro", isExperimental: false },
          { name: "gemini-2.5-flash", isExperimental: false },
          { name: "gemini-1.0-pro", isExperimental: false },
          { name: "gemini-2.5-flash-lite", isExperimental: false }
        ]
      }
    ]
  }
];


