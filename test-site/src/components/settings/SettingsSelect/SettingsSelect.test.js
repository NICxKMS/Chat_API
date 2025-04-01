import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsSelect from './index';

describe('SettingsSelect', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' }
  ];
  
  const defaultProps = {
    id: 'test-select',
    label: 'Test Select',
    value: 'option1',
    options,
    onChange: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Element.prototype.getBoundingClientRect for dropdown positioning
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 120,
      height: 40,
      top: 100,
      left: 100,
      bottom: 140,
      right: 220,
      x: 100,
      y: 100
    }));
  });
  
  test('renders with correct label and selected value', () => {
    render(<SettingsSelect {...defaultProps} />);
    
    expect(screen.getByText('Test Select')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument(); // Selected value
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });
  
  test('opens dropdown when clicked', () => {
    render(<SettingsSelect {...defaultProps} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.click(select);
    
    expect(select).toHaveAttribute('aria-expanded', 'true');
    
    // Options should be visible
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });
  
  test('selects an option when clicked', async () => {
    render(<SettingsSelect {...defaultProps} />);
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('combobox'));
    
    // Click on the second option
    fireEvent.click(screen.getAllByRole('option')[1]);
    
    // Should call onChange with the selected option value
    expect(defaultProps.onChange).toHaveBeenCalledWith('option2');
    
    // Dropdown should be closed after selection
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
  
  test('handles keyboard navigation', () => {
    render(<SettingsSelect {...defaultProps} />);
    
    const select = screen.getByRole('combobox');
    
    // Open with Enter key
    fireEvent.keyDown(select, { key: 'Enter' });
    expect(select).toHaveAttribute('aria-expanded', 'true');
    
    // Close with Escape key
    fireEvent.keyDown(select, { key: 'Escape' });
    expect(select).toHaveAttribute('aria-expanded', 'false');
    
    // Open with Space key
    fireEvent.keyDown(select, { key: ' ' });
    expect(select).toHaveAttribute('aria-expanded', 'true');
    
    // Navigate down
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    expect(defaultProps.onChange).toHaveBeenCalledWith('option2');
    
    // Navigate up
    fireEvent.keyDown(select, { key: 'ArrowUp' });
    expect(defaultProps.onChange).toHaveBeenCalledWith('option1');
  });
  
  test('displays tooltip when provided', () => {
    render(<SettingsSelect {...defaultProps} tooltip="This is a helpful tip" />);
    
    const label = screen.getByText('Test Select');
    expect(label).toHaveAttribute('title', 'This is a helpful tip');
  });
  
  test('is disabled when disabled prop is true', () => {
    render(<SettingsSelect {...defaultProps} disabled={true} />);
    
    const select = screen.getByRole('combobox');
    
    expect(select).toHaveAttribute('aria-disabled', 'true');
    expect(select).toHaveAttribute('tabIndex', '-1');
    
    // Click should not open dropdown when disabled
    fireEvent.click(select);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    
    // Keyboard events should not open dropdown when disabled
    fireEvent.keyDown(select, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  
  test('closes dropdown when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <SettingsSelect {...defaultProps} />
      </div>
    );
    
    // Open the dropdown
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    
    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    
    // Dropdown should be closed
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
}); 