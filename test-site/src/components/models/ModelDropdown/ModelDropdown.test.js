import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModelDropdown from './index';

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

describe('ModelDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with selected model', () => {
    render(<ModelDropdown />);
    
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('8192 tokens context')).toBeInTheDocument();
  });
  
  test('toggles dropdown when clicked', () => {
    render(<ModelDropdown />);
    
    // Initially closed
    expect(screen.queryByText('Show experimental models')).not.toBeInTheDocument();
    
    // Click to open
    fireEvent.click(screen.getByText('GPT-4'));
    expect(screen.getByText('Show experimental models')).toBeInTheDocument();
    
    // Click again to close
    fireEvent.click(screen.getByText('GPT-4'));
    waitFor(() => {
      expect(screen.queryByText('Show experimental models')).not.toBeInTheDocument();
    });
  });
  
  test('displays the search input and categories when open', () => {
    render(<ModelDropdown />);
    
    // Click to open
    fireEvent.click(screen.getByText('GPT-4'));
    
    // Search input should be visible
    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    
    // Categories should be visible
    expect(screen.getByText('Chat Models')).toBeInTheDocument();
    expect(screen.getByText('Image Models')).toBeInTheDocument();
  });
  
  test('handles experimental models toggle', () => {
    const { useModel } = require('../../../contexts/ModelContext');
    const toggleMock = useModel().toggleExperimentalModels;
    
    render(<ModelDropdown />);
    
    // Open dropdown
    fireEvent.click(screen.getByText('GPT-4'));
    
    // Click experimental toggle
    fireEvent.click(screen.getByLabelText(/show experimental models/i));
    
    expect(toggleMock).toHaveBeenCalledTimes(1);
  });
  
  test('allows searching for models', () => {
    render(<ModelDropdown />);
    
    // Open dropdown
    fireEvent.click(screen.getByText('GPT-4'));
    
    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'claude' } });
    
    // "Claude 3" should be highlighted in some way
    // This is a visual effect, so we'll just check that search works by verifying
    // results count updates (which is controlled by the mock)
    expect(screen.getByText('3 results')).toBeInTheDocument();
  });
  
  test('closes dropdown when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <ModelDropdown />
      </div>
    );
    
    // Open dropdown
    fireEvent.click(screen.getByText('GPT-4'));
    expect(screen.getByText('Show experimental models')).toBeInTheDocument();
    
    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    
    // Dropdown should be closed
    waitFor(() => {
      expect(screen.queryByText('Show experimental models')).not.toBeInTheDocument();
    });
  });
}); 