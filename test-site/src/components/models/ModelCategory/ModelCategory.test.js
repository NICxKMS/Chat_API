import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelCategory from './index';

// Mock the ModelItem component
jest.mock('../ModelItem', () => {
  return jest.fn(({ model, isSelected, onSelect, searchTerm }) => (
    <div data-testid={`model-item-${model.id}`}>
      <span>{model.name}</span>
      <button onClick={onSelect}>Select</button>
      <span data-testid="search-term">{searchTerm}</span>
      <span data-testid="is-selected">{isSelected.toString()}</span>
    </div>
  ));
});

describe('ModelCategory', () => {
  const mockModels = [
    {
      id: 'model1',
      name: 'GPT-4',
      description: 'Latest version'
    },
    {
      id: 'model2',
      name: 'Claude 3',
      series: 'Claude',
      description: 'By Anthropic'
    },
    {
      id: 'model3',
      name: 'Llama 2',
      tags: ['opensource', 'meta']
    }
  ];
  
  const defaultProps = {
    category: {
      id: 'chat-models',
      name: 'Chat Models',
      models: mockModels
    },
    onSelectModel: jest.fn(),
    selectedModelId: 'model1',
    searchTerm: ''
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders category name and model count', () => {
    render(<ModelCategory {...defaultProps} />);
    
    expect(screen.getByText('Chat Models')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Model count badge
  });
  
  test('renders all models in the category', () => {
    render(<ModelCategory {...defaultProps} />);
    
    expect(screen.getByTestId('model-item-model1')).toBeInTheDocument();
    expect(screen.getByTestId('model-item-model2')).toBeInTheDocument();
    expect(screen.getByTestId('model-item-model3')).toBeInTheDocument();
  });
  
  test('toggles expansion when header is clicked', () => {
    render(<ModelCategory {...defaultProps} />);
    
    // Initially expanded
    expect(screen.getByTestId('model-item-model1')).toBeInTheDocument();
    
    // Click header to collapse
    fireEvent.click(screen.getByText('Chat Models'));
    
    // Models should no longer be visible
    expect(screen.queryByTestId('model-item-model1')).not.toBeInTheDocument();
    
    // Click header again to expand
    fireEvent.click(screen.getByText('Chat Models'));
    
    // Models should be visible again
    expect(screen.getByTestId('model-item-model1')).toBeInTheDocument();
  });
  
  test('passes selected model ID to ModelItem', () => {
    render(<ModelCategory {...defaultProps} />);
    
    // Selected model should have isSelected=true
    expect(screen.getByTestId('model-item-model1').querySelector('[data-testid="is-selected"]'))
      .toHaveTextContent('true');
    
    // Non-selected models should have isSelected=false
    expect(screen.getByTestId('model-item-model2').querySelector('[data-testid="is-selected"]'))
      .toHaveTextContent('false');
    expect(screen.getByTestId('model-item-model3').querySelector('[data-testid="is-selected"]'))
      .toHaveTextContent('false');
  });
  
  test('filters models based on search term', () => {
    // With a search term that matches only one model
    render(<ModelCategory {...defaultProps} searchTerm="claude" />);
    
    // Only Claude 3 should be visible
    expect(screen.queryByTestId('model-item-model1')).not.toBeInTheDocument();
    expect(screen.getByTestId('model-item-model2')).toBeInTheDocument();
    expect(screen.queryByTestId('model-item-model3')).not.toBeInTheDocument();
    
    // Count should reflect the filtered models
    expect(screen.getByText('1')).toBeInTheDocument();
  });
  
  test('passes search term to ModelItem components', () => {
    render(<ModelCategory {...defaultProps} searchTerm="gpt" />);
    
    const searchTermElement = screen.getByTestId('model-item-model1')
      .querySelector('[data-testid="search-term"]');
    expect(searchTermElement).toHaveTextContent('gpt');
  });
  
  test('calls onSelectModel when a model is selected', () => {
    render(<ModelCategory {...defaultProps} />);
    
    // Click the select button in the first model
    fireEvent.click(screen.getByTestId('model-item-model1').querySelector('button'));
    
    // onSelectModel should be called with the model object
    expect(defaultProps.onSelectModel).toHaveBeenCalledWith(mockModels[0]);
  });
  
  test('returns null when no models match search term', () => {
    const { container } = render(<ModelCategory {...defaultProps} searchTerm="nonexistent" />);
    
    // No elements should be rendered
    expect(container.firstChild).toBeNull();
  });
}); 