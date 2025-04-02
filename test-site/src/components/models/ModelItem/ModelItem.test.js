import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelItem from './index';

describe('ModelItem', () => {
  // Updated mock model to include all potential fields from propTypes
  const mockModel = {
    id: 'model-gpt4',
    name: 'GPT-4',
    description: 'The latest GPT model from OpenAI',
    series: 'GPT',
    providerName: 'OpenAI',        // Added based on propTypes
    typeGroupName: 'GPT Models',  // Added based on propTypes
    tags: ['featured', 'powerful'] // Added based on propTypes
  };

  // Default props using the updated mock model
  const defaultProps = {
    model: mockModel,
    selected: false,
    onClick: jest.fn(), // Changed from onSelect to onClick to match prop name
    searchTerm: ''
  };

  beforeEach(() => {
    // Clear mock function calls before each test
    jest.clearAllMocks();
  });

  test('renders model name and description correctly', () => {
    render(<ModelItem {...defaultProps} />);
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('The latest GPT model from OpenAI')).toBeInTheDocument();
  });

  test('renders model icon using series initial (first letter of series)', () => {
    render(<ModelItem {...defaultProps} />);
    // The icon container should contain the first letter of the series
    expect(screen.getByText('G')).toBeInTheDocument(); // G from GPT
    expect(screen.getByText('G').closest(`div[class*="modelIcon"]`)).toBeInTheDocument();
  });

  test('uses name initial for icon when series is undefined or null', () => {
    const modelWithoutSeries = {
      ...mockModel,
      series: undefined // Explicitly test undefined
    };
    render(<ModelItem {...defaultProps} model={modelWithoutSeries} />);
    expect(screen.getByText('G')).toBeInTheDocument(); // G from GPT-4
    expect(screen.getByText('G').closest(`div[class*="modelIcon"]`)).toBeInTheDocument();

    const modelWithNullSeries = {
      ...mockModel,
      series: null // Explicitly test null
    };
    // Use rerender for efficiency
    render(<ModelItem {...defaultProps} model={modelWithNullSeries} />);
    expect(screen.getByText('G')).toBeInTheDocument(); // G from GPT-4
    expect(screen.getByText('G').closest(`div[class*="modelIcon"]`)).toBeInTheDocument();
  });

  test('shows selected indicator (check icon) when selected is true', () => {
    render(<ModelItem {...defaultProps} selected={true} />);
    // Use the data-testid added to the component
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    // Also check the parent container has the selected class
    expect(screen.getByRole('option')).toHaveClass('selected');
  });

  test('does not show selected indicator when selected is false', () => {
    render(<ModelItem {...defaultProps} selected={false} />);
    // Check icon should not be present
    expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
    // Parent container should not have the selected class
    expect(screen.getByRole('option')).not.toHaveClass('selected');
  });

  test('calls onClick with the model object when the item is clicked', () => {
    render(<ModelItem {...defaultProps} />);
    // Click the main element which has role="option"
    const itemElement = screen.getByRole('option');
    fireEvent.click(itemElement);

    // Verify onClick was called once with the correct model data
    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClick).toHaveBeenCalledWith(mockModel);
  });

  test('renders provided tags correctly', () => {
    render(<ModelItem {...defaultProps} />); // mockModel already has tags
    expect(screen.getByText('featured')).toBeInTheDocument();
    expect(screen.getByText('powerful')).toBeInTheDocument();
    // Ensure they are within the tags container
    expect(screen.getByText('featured').closest(`div[class*="tags"]`)).toBeInTheDocument();
  });

  test('does not render tags container when model has no tags', () => {
    const modelWithoutTags = { ...mockModel, tags: [] };
    render(<ModelItem {...defaultProps} model={modelWithoutTags} />);
    expect(screen.queryByText('featured')).not.toBeInTheDocument();
    // Check the container itself isn't rendered (more robust)
    expect(document.querySelector(`[class*="tags"]`)).not.toBeInTheDocument();
  });

  test('highlights matching text in name and description when searchTerm is provided', () => {
    render(<ModelItem {...defaultProps} searchTerm="GPT" />);
    
    // Find all highlighted elements (component uses spans with a specific class)
    const highlights = screen.getAllByText('GPT', { selector: 'span[class*="highlight"]' });
    expect(highlights.length).toBe(2); // One in name, one in description
    
    // Check content and location (optional but good)
    expect(highlights[0]).toHaveTextContent('GPT');
    expect(highlights[0].closest(`div[class*="modelName"]`)).toBeInTheDocument();
    expect(highlights[1]).toHaveTextContent('GPT');
    expect(highlights[1].closest(`div[class*="modelDescription"]`)).toBeInTheDocument();
  });

  test('highlights matching text in tags when searchTerm is provided', () => {
    render(<ModelItem {...defaultProps} searchTerm="feat" />); // Search for part of a tag

    // Find the highlighted tag part
    const highlightedTag = screen.getByText('feat', { selector: 'span[class*="highlight"]' });
    expect(highlightedTag).toBeInTheDocument();
    // Verify it's within the tag span and the tags container
    expect(highlightedTag.closest(`span[class*="tag"]`)).toHaveTextContent('featured');
    expect(highlightedTag.closest(`div[class*="tags"]`)).toBeInTheDocument();

    // Check that other parts/tags are not highlighted incorrectly
    expect(screen.queryByText('ured', { selector: 'span[class*="highlight"]' })).not.toBeInTheDocument();
    expect(screen.getByText('powerful').querySelector(`span[class*="highlight"]`)).not.toBeInTheDocument();
  });

  test('highlighting is case-insensitive', () => {
    render(<ModelItem {...defaultProps} searchTerm="openai" />); // Lowercase search
    
    // Should find 'OpenAI' in the description
    const highlights = screen.getAllByText('OpenAI', { selector: 'span[class*="highlight"]' });
    expect(highlights.length).toBe(1);
    expect(highlights[0].closest(`div[class*="modelDescription"]`)).toBeInTheDocument();
  });

  test('applies correct ARIA role and selected state', () => {
    // Test unselected state
    const { rerender } = render(<ModelItem {...defaultProps} selected={false} />);
    let item = screen.getByRole('option');
    expect(item).toHaveAttribute('aria-selected', 'false');

    // Test selected state
    rerender(<ModelItem {...defaultProps} selected={true} />);
    item = screen.getByRole('option'); // Re-query after rerender
    expect(item).toHaveAttribute('aria-selected', 'true');
  });
}); 