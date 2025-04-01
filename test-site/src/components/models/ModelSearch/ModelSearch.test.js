import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelSearch from './index';

describe('ModelSearch', () => {
  const defaultProps = {
    searchTerm: '',
    onSearchChange: jest.fn(),
    resultCount: 0
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders search input', () => {
    render(<ModelSearch {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search models...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('aria-label', 'Search models');
    expect(searchInput).toHaveValue('');
  });
  
  test('calls onSearchChange when text is entered', () => {
    render(<ModelSearch {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'gpt' } });
    
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('gpt');
  });
  
  test('displays clear button when search term exists', () => {
    render(<ModelSearch {...defaultProps} searchTerm="gpt" />);
    
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
  });
  
  test('clears search when clear button is clicked', () => {
    render(<ModelSearch {...defaultProps} searchTerm="gpt" />);
    
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);
    
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('');
  });
  
  test('does not show clear button when search term is empty', () => {
    render(<ModelSearch {...defaultProps} searchTerm="" />);
    
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });
  
  test('focuses input after clearing', () => {
    render(<ModelSearch {...defaultProps} searchTerm="gpt" />);
    
    const searchInput = screen.getByPlaceholderText('Search models...');
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    
    // Mock focus method
    searchInput.focus = jest.fn();
    
    fireEvent.click(clearButton);
    
    expect(searchInput.focus).toHaveBeenCalled();
  });
  
  test('displays result count when search term exists', () => {
    render(<ModelSearch {...defaultProps} searchTerm="gpt" resultCount={5} />);
    
    expect(screen.getByText('5 results')).toBeInTheDocument();
  });
  
  test('properly pluralizes result count', () => {
    // Single result
    render(<ModelSearch {...defaultProps} searchTerm="gpt" resultCount={1} />);
    expect(screen.getByText('1 result')).toBeInTheDocument();
    
    // Multiple results
    const { rerender } = render(
      <ModelSearch {...defaultProps} searchTerm="gpt" resultCount={2} />
    );
    expect(screen.getByText('2 results')).toBeInTheDocument();
    
    // Zero results
    rerender(<ModelSearch {...defaultProps} searchTerm="gpt" resultCount={0} />);
    expect(screen.getByText('0 results')).toBeInTheDocument();
  });
  
  test('does not show result count when search term is empty', () => {
    render(<ModelSearch {...defaultProps} searchTerm="" resultCount={5} />);
    
    expect(screen.queryByText('5 results')).not.toBeInTheDocument();
  });
}); 