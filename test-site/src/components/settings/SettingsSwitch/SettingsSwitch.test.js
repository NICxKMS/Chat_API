import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsSwitch from './index';

describe('SettingsSwitch', () => {
  const defaultProps = {
    id: 'test-switch',
    label: 'Test Switch Label',
    isChecked: false,
    onChange: jest.fn()
  };
  
  // Helper wrapper to manage state for toggle tests
  const TestWrapper = (initialProps) => {
    const [checked, setChecked] = React.useState(initialProps.isChecked);
    const handleChange = (newCheckedState) => {
        initialProps.onChange(newCheckedState);
        setChecked(newCheckedState);
    }
    return <SettingsSwitch {...initialProps} isChecked={checked} onChange={handleChange} />;
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with correct label and unchecked state by default', () => {
    render(<SettingsSwitch {...defaultProps} isChecked={false} />);
    
    expect(screen.getByText('Test Switch Label')).toBeInTheDocument();
    const switchElement = screen.getByRole('switch', { name: 'Test Switch Label' });
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    
    // Check the hidden input state as well
    const checkbox = screen.getByLabelText('Test Switch Label', { selector: 'input[type="checkbox"]' });
    expect(checkbox).toHaveAttribute('id', 'test-switch');
    expect(checkbox).not.toBeChecked();
  });
  
  test('renders in checked state when isChecked is true', () => {
    render(<SettingsSwitch {...defaultProps} isChecked={true} />);
    
    const switchElement = screen.getByRole('switch', { name: 'Test Switch Label' });
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Test Switch Label', { selector: 'input[type="checkbox"]' })).toBeChecked();
  });
  
  test('calls onChange with the new state when the switch track is clicked', () => {
    // Use wrapper to test toggling in both directions
    const { rerender } = render(<TestWrapper {...defaultProps} isChecked={false} />); 
    const switchElement = screen.getByRole('switch', { name: 'Test Switch Label' });
    
    // 1. Click when unchecked (false -> true)
    fireEvent.click(switchElement);
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChange).toHaveBeenCalledWith(true); // Should be called with the NEW state
    // State updates via wrapper
    expect(switchElement).toHaveAttribute('aria-checked', 'true'); 
    
    // Clear mock calls for the next part of the test
    defaultProps.onChange.mockClear(); 
    
    // 2. Click when checked (true -> false)
    // No need to rerender, TestWrapper handles state update
    fireEvent.click(switchElement);
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChange).toHaveBeenCalledWith(false);
    expect(switchElement).toHaveAttribute('aria-checked', 'false'); 
  });
  
  test('toggles state and calls onChange with Enter or Space keydown', () => {
    render(<TestWrapper {...defaultProps} isChecked={false} />); 
    const switchElement = screen.getByRole('switch', { name: 'Test Switch Label' });
    
    // 1. Press Enter when unchecked (false -> true)
    fireEvent.keyDown(switchElement, { key: 'Enter', code: 'Enter' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChange).toHaveBeenCalledWith(true);
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
    
    // 2. Press Space when checked (true -> false)
    fireEvent.keyDown(switchElement, { key: ' ', code: 'Space' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(2);
    expect(defaultProps.onChange).toHaveBeenCalledWith(false); // Called with new state
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    
    // 3. Pressing other keys should not trigger onChange
    fireEvent.keyDown(switchElement, { key: 'Tab', code: 'Tab' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(2); // Count remains unchanged
  });
  
  test('displays tooltip on the label when provided', () => {
    render(<SettingsSwitch {...defaultProps} tooltip="Switch tooltip text" />);
    const label = screen.getByText('Test Switch Label');
    expect(label).toHaveAttribute('title', 'Switch tooltip text');
  });
  
  test('is disabled correctly when disabled prop is true', () => {
    render(<SettingsSwitch {...defaultProps} disabled={true} />);
    
    const switchElement = screen.getByRole('switch', { name: 'Test Switch Label' });
    const checkbox = screen.getByLabelText('Test Switch Label', { selector: 'input[type="checkbox"]' });
    
    // Check input and ARIA state
    expect(checkbox).toBeDisabled();
    expect(switchElement).toHaveAttribute('aria-disabled', 'true');
    expect(switchElement).not.toHaveAttribute('tabIndex', '0'); // Check it's not tabbable
    
    // Check container has disabled class
    expect(switchElement.closest(`div[class*="switchContainer"]`)).toHaveClass('disabled');
    
    // Click should not trigger onChange
    fireEvent.click(switchElement);
    expect(defaultProps.onChange).not.toHaveBeenCalled();
    
    // Keyboard events should not trigger onChange
    fireEvent.keyDown(switchElement, { key: 'Enter', code: 'Enter' });
    expect(defaultProps.onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(switchElement, { key: ' ', code: 'Space' });
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
}); 