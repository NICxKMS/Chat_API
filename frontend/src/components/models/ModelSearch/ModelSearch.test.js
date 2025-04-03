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
  
  test('renders search input with correct attributes and initial state', () => {
    render(<ModelSearch {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search models...');

    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('type', 'text');
    expect(searchInput).toHaveAttribute('aria-label', 'Search models');
    expect(searchInput).toHaveValue(''); // Initial value is empty
  });
  
  test('calls onSearchChange with the correct value when text is entered', () => {
    render(<ModelSearch {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search models...');

    fireEvent.change(searchInput, { target: { value: 'gpt-3' } });

    expect(defaultProps.onSearchChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('gpt-3');
  });
  
  test('displays clear button only when searchTerm has text', () => {
    // Initially, no clear button
    const { rerender } = render(<ModelSearch {...defaultProps} searchTerm="" />);
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    // With search term, clear button appears
    rerender(<ModelSearch {...defaultProps} searchTerm="claude" />);
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });
  
  test('calls onSearchChange with empty string when clear button is clicked', () => {
    render(<ModelSearch {...defaultProps} searchTerm="gpt" />);
    const clearButton = screen.getByRole('button', { name: /clear search/i });

    fireEvent.click(clearButton);

    expect(defaultProps.onSearchChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('');
  });
  
  test('focuses the search input after the clear button is clicked', () => {
    render(<ModelSearch {...defaultProps} searchTerm="gpt" />);
    const searchInput = screen.getByPlaceholderText('Search models...');
    const clearButton = screen.getByRole('button', { name: /clear search/i });

    // Ensure input is not focused initially (or doesn't matter)
    if (document.activeElement === searchInput) {
        searchInput.blur(); // Ensure it's not focused beforehand if needed
    }
    expect(document.activeElement).not.toBe(searchInput);

    // Click the clear button
    fireEvent.click(clearButton);

    // Check that the input element is now the active element in the document
    expect(document.activeElement).toBe(searchInput);
  });
  
  test('displays result count only when searchTerm has text', () => {
    // Initially, no results text
    const { rerender } = render(<ModelSearch {...defaultProps} searchTerm="" resultCount={5} />);
    expect(screen.queryByText(/results?/)).not.toBeInTheDocument(); // Check for variants

    // With search term, results text appears
    rerender(<ModelSearch {...defaultProps} searchTerm="gpt" resultCount={5} />);
    expect(screen.getByText('5 results')).toBeInTheDocument();
  });
  
  test('displays result count with correct pluralization (result vs results)', () => {
    // Single result
    const { rerender } = render(<ModelSearch {...defaultProps} searchTerm="gpt" resultCount={1} />);
    expect(screen.getByText('1 result')).toBeInTheDocument();
    expect(screen.queryByText('1 results')).not.toBeInTheDocument();

    // Multiple results (e.g., 2)
    rerender(<ModelSearch {...defaultProps} searchTerm="gpt" resultCount={2} />);
    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(screen.queryByText('2 result')).not.toBeInTheDocument();

    // Zero results
    rerender(<ModelSearch {...defaultProps} searchTerm="gpt" resultCount={0} />);
    expect(screen.getByText('0 results')).toBeInTheDocument();
    expect(screen.queryByText('0 result')).not.toBeInTheDocument();
  });
}); 