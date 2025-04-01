import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelItem from './index';

describe('ModelItem', () => {
  const defaultModel = {
    id: 'model1',
    name: 'GPT-4',
    description: 'Most capable OpenAI model',
    series: 'GPT'
  };
  
  const defaultProps = {
    model: defaultModel,
    isSelected: false,
    onSelect: jest.fn(),
    searchTerm: ''
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders model name and description', () => {
    render(<ModelItem {...defaultProps} />);
    
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('Most capable OpenAI model')).toBeInTheDocument();
  });
  
  test('renders model icon using series initial', () => {
    render(<ModelItem {...defaultProps} />);
    
    // Should use the first letter of the series
    expect(screen.getByText('G')).toBeInTheDocument();
  });
  
  test('uses name initial for icon when series is not available', () => {
    const modelWithoutSeries = {
      ...defaultModel,
      series: undefined
    };
    
    render(<ModelItem {...defaultProps} model={modelWithoutSeries} />);
    
    // Should use the first letter of the name
    expect(screen.getByText('G')).toBeInTheDocument();
  });
  
  test('shows selected indicator when isSelected is true', () => {
    render(<ModelItem {...defaultProps} isSelected={true} />);
    
    // Check that check icon is rendered (SVG)
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
  
  test('does not show selected indicator when isSelected is false', () => {
    render(<ModelItem {...defaultProps} isSelected={false} />);
    
    // Check that check icon is not rendered
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });
  
  test('calls onSelect when clicked', () => {
    render(<ModelItem {...defaultProps} />);
    
    fireEvent.click(screen.getByText('GPT-4'));
    
    expect(defaultProps.onSelect).toHaveBeenCalledTimes(1);
  });
  
  test('renders tags when provided', () => {
    const modelWithTags = {
      ...defaultModel,
      tags: ['featured', 'fast']
    };
    
    render(<ModelItem {...defaultProps} model={modelWithTags} />);
    
    expect(screen.getByText('featured')).toBeInTheDocument();
    expect(screen.getByText('fast')).toBeInTheDocument();
  });
  
  test('highlights matching text when searchTerm is provided', () => {
    render(<ModelItem {...defaultProps} searchTerm="gpt" />);
    
    // Check that some highlight class or element exists
    const highlights = document.getElementsByClassName('highlight');
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights[0].textContent.toLowerCase()).toContain('gpt');
  });
  
  test('applies ARIA attributes', () => {
    render(<ModelItem {...defaultProps} isSelected={true} />);
    
    const item = screen.getByRole('option');
    expect(item).toHaveAttribute('aria-selected', 'true');
  });
}); 