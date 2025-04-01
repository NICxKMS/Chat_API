import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsSwitch from './index';

describe('SettingsSwitch', () => {
  const defaultProps = {
    id: 'test-switch',
    label: 'Test Switch',
    isChecked: false,
    onChange: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with correct label and unchecked state', () => {
    render(<SettingsSwitch {...defaultProps} />);
    
    expect(screen.getByText('Test Switch')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('id', 'test-switch');
    expect(checkbox).not.toBeChecked();
  });
  
  test('renders in checked state when isChecked is true', () => {
    render(<SettingsSwitch {...defaultProps} isChecked={true} />);
    
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
  
  test('calls onChange with toggled value when clicked', () => {
    render(<SettingsSwitch {...defaultProps} />);
    
    // Click the switch track
    const switchTrack = screen.getByRole('switch');
    fireEvent.click(switchTrack);
    
    // Should call onChange with toggled value (true)
    expect(defaultProps.onChange).toHaveBeenCalledWith(true);
    
    // Test with initial checked state
    render(<SettingsSwitch {...defaultProps} isChecked={true} />);
    fireEvent.click(screen.getByRole('switch'));
    
    // Should call onChange with toggled value (false)
    expect(defaultProps.onChange).toHaveBeenCalledWith(false);
  });
  
  test('toggles with keyboard interactions', () => {
    render(<SettingsSwitch {...defaultProps} />);
    
    const switchTrack = screen.getByRole('switch');
    
    // Press Enter key
    fireEvent.keyDown(switchTrack, { key: 'Enter' });
    expect(defaultProps.onChange).toHaveBeenCalledWith(true);
    
    // Press Space key
    fireEvent.keyDown(switchTrack, { key: ' ' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(2);
    
    // Other keys should not trigger onChange
    fireEvent.keyDown(switchTrack, { key: 'Tab' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(2);
  });
  
  test('displays tooltip when provided', () => {
    render(<SettingsSwitch {...defaultProps} tooltip="This is a helpful tip" />);
    
    const label = screen.getByText('Test Switch');
    expect(label).toHaveAttribute('title', 'This is a helpful tip');
  });
  
  test('is disabled when disabled prop is true', () => {
    render(<SettingsSwitch {...defaultProps} disabled={true} />);
    
    const switchTrack = screen.getByRole('switch');
    const checkbox = screen.getByRole('checkbox');
    
    expect(checkbox).toBeDisabled();
    expect(switchTrack).toHaveAttribute('aria-disabled', 'true');
    expect(switchTrack).toHaveAttribute('tabIndex', '-1');
    
    // Click should not trigger onChange when disabled
    fireEvent.click(switchTrack);
    expect(defaultProps.onChange).not.toHaveBeenCalled();
    
    // Keyboard events should not trigger onChange when disabled
    fireEvent.keyDown(switchTrack, { key: 'Enter' });
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
}); 