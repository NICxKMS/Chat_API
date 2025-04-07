# AI Chat Interface

A modern React-based chat interface for interacting with various AI models.

## Features

- Modern React-based chat interface for AI interactions
- Model selection from various providers
- Customizable settings for response generation
- Code block syntax highlighting
- Performance metrics
- Dark/light theme support
- Fully responsive design

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```

## Available Scripts

The project includes several useful scripts to help with development, testing, and building:

### Development

- `npm start` - Start the development server
- `npm run dev` - Start the development server with development environment variables

### Building

- `npm run build` - Build the application for deployment
- `npm run build:prod` - Build the application with production environment variables
- `npm run analyze` - Analyze the bundle size with source-map-explorer

### Testing

- `npm test` - Run tests in interactive watch mode
- `npm run test:watch` - Run tests in watch mode (alias)
- `npm run test:coverage` - Generate a test coverage report
- `npm run test:ci` - Run tests in CI mode (single run)

### Linting and Code Quality

- `npm run lint` - Run ESLint to check for code issues
- `npm run lint:fix` - Run ESLint and automatically fix issues when possible

### Maintenance

- `npm run clean` - Remove build artifacts and node_modules
- `npm run reinstall` - Clean and reinstall all dependencies
- `npm run eject` - Eject from Create React App (⚠️ one-way operation)

## Testing

The application includes a comprehensive test suite using Jest and React Testing Library.

### Test Coverage Requirements

The project is configured with the following coverage thresholds:
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

### Test Structure

Tests are located alongside the components they test with the `.test.js` extension:

```
src/
├── components/
│   ├── settings/
│   │   ├── SettingsPanel/
│   │   │   ├── index.js                   # Component implementation
│   │   │   ├── SettingsPanel.module.css   # Component styles
│   │   │   └── SettingsPanel.test.js      # Component tests
│   ├── models/
│   │   ├── ModelDropdown/
│   │   │   ├── index.js                   # Component implementation
│   │   │   ├── ModelDropdown.module.css   # Component styles
│   │   │   └── ModelDropdown.test.js      # Component tests
```

## Project Structure

```
src/
├── components/            # Reusable UI components
│   ├── common/            # Generic components
│   ├── layout/            # Layout components
│   ├── chat/              # Chat-specific components
│   ├── models/            # Model selection components
│   └── settings/          # Settings components
├── contexts/              # React contexts
├── hooks/                 # Custom hooks
├── services/              # API and other services
├── utils/                 # Utility functions
├── App.js                 # Main app component
└── index.js               # Entry point
```

## Environment Variables

The application uses the following environment variables:

- `REACT_APP_ENV` - Environment (development, production)
- `REACT_APP_API_URL` - API URL for backend services (defaults to '/api')

## Dependencies

- React 18
- react-window (virtualized lists)
- react-virtualized-auto-sizer (auto-sizing virtualized containers)
- react-markdown (markdown rendering)
- react-syntax-highlighter (code syntax highlighting)
- prop-types (runtime type checking) 