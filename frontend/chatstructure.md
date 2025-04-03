# Chat Display Structure

## Primary Structure
```
ChatContainer (div.chatContainer)
├── div.chatArea
│   ├── [ACTIVE CHAT]
│   │   └── MessageList (virtualized list)
│   │       └── div.messageRow (for each visible message)
│   │           └── ChatMessage (div.message)
│   │               ├── div.avatar
│   │               └── div.messageContentWrapper
│   │                   ├── div.messageContent
│   │                   │   └── ReactMarkdown
│   │                   │       └── [CONTENT ELEMENTS]
│   │                   │           └── div.codeBlockContainer (for code blocks)
│   │                   │               ├── div.codeHeader
│   │                   │               └── SyntaxHighlighter (pre, code)
│   │                   └── div.metricsContainer (for assistant messages with metrics)
│   │
│   └── [EMPTY CHAT]
│       └── div.emptyChatContent
│           ├── div.greetingMessage
│           └── div.inputArea.staticInputArea
│               └── div.inputControlsWrapper
│                   ├── div.inputSpinnerContainer (if waiting for response)
│                   ├── ChatInput
│                   │   └── div.inputContainer
│                   └── ChatControls
│                       └── div.controls
│
└── [ACTIVE CHAT ONLY]
    └── div.inputArea.fixedInputArea
        ├── GlobalMetricsBar
        └── div.inputControlsWrapper
            ├── div.inputSpinnerContainer (if waiting for response)
            ├── ChatInput
            │   └── div.inputContainer
            └── ChatControls
                └── div.controls
```

## Component Details

### ChatMessage Variants
- userMessage: Aligned to right, has user avatar
- assistantMessage: Aligned to left, has AI avatar
- systemMessage: Centered, has gear icon
- errorMessage: Centered, has alert icon

### Input Area States
- Empty Chat: Static positioning below welcome message
- Active Chat: Fixed positioning at bottom of container

### Suspense Fallbacks
- MessageList: div.messagePlaceholder
- ChatInput: div.inputPlaceholder
- ChatControls: div.controlsPlaceholder
- GlobalMetricsBar: div.globalMetricsPlaceholder 