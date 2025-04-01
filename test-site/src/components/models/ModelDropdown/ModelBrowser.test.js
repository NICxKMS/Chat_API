import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModelBrowser from './index';

// Mock the context
jest.mock('../../../contexts/ModelContext', () => ({
  useModel: () => ({
    modelCategories: [
      {
        id: 'cat1',
        name: 'Chat Models',
        models: [
          {
            id: 'model1',
            name: 'GPT-4',
            description: 'Most capable model',
            context_length: 8192
          },
          {
            id: 'model2',
            name: 'Claude 3',
            description: 'Anthropic model',
            context_length: 100000
          }
        ]
      },
      {
        id: 'cat2',
        name: 'Image Models',
        models: [
          {
            id: 'model3',
            name: 'DALL-E 3',
            description: 'Image generation'
          }
        ]
      }
    ],
    selectedModel: {
      id: 'model1',
      name: 'GPT-4',
      description: 'Most capable model',
      context_length: 8192
    },
    selectModel: jest.fn(),
    isExperimentalModelsEnabled: false,
    toggleExperimentalModels: jest.fn(),
    filteredModelCount: 3
  })
}));

describe('ModelBrowser Component', () => {
  test('renders the selected model', () => {
    render(<ModelBrowser />);
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  test('shows model categories', async () => {
    render(<ModelBrowser />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('Embedding')).toBeInTheDocument();
  });

  test('allows toggling experimental models', () => {
    const { getByText } = render(<ModelBrowser />);
    const toggleButton = getByText('Show Experimental Models').closest('label');
    fireEvent.click(toggleButton);
  });
}); 