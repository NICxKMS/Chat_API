import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsSlider from './index';

describe('SettingsSlider', () => {
  const defaultProps = {
    id: 'test-slider',
    label: 'Test Slider',
    value: 50,
    min: 0,
    max: 100,
    step: 1,
    onChange: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with correct label and value', () => {
    render(<SettingsSlider {...defaultProps} />);
    
    expect(screen.getByText('Test Slider')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('id', 'test-slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '100');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveAttribute('value', '50');
  });
  
  test('calls onChange when slider value changes', () => {
    render(<SettingsSlider {...defaultProps} />);
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(75);
  });
  
  test('displays formatted value based on step', () => {
    // When step is 0.1, values should have 1 decimal place
    render(<SettingsSlider {...defaultProps} value={7.5} step={0.1} />);
    expect(screen.getByText('7.5')).toBeInTheDocument();
    
    // When step is 0.01, values should have 2 decimal places
    const { rerender } = render(<SettingsSlider {...defaultProps} value={7.55} step={0.01} />);
    expect(screen.getByText('7.55')).toBeInTheDocument();
    
    // When step is 1, values should have 0 decimal places
    rerender(<SettingsSlider {...defaultProps} value={8} step={1} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });
  
  test('displays tooltip when hovering over slider', () => {
    render(<SettingsSlider {...defaultProps} tooltip="This is a tooltip" />);
    
    // Initially tooltip should not be visible
    expect(screen.queryByText('This is a tooltip')).not.toBeInTheDocument();
    
    // Hover over the slider to show tooltip
    const slider = screen.getByRole('slider');
    fireEvent.mouseOver(slider);
    
    // Now tooltip should be visible
    expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
    
    // Mouse out should hide tooltip
    fireEvent.mouseOut(slider);
    expect(screen.queryByText('This is a tooltip')).not.toBeInTheDocument();
  });
  
  test('disables slider when disabled prop is true', () => {
    render(<SettingsSlider {...defaultProps} disabled={true} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
    
    // Change event should not trigger onChange when disabled
    fireEvent.change(slider, { target: { value: '75' } });
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
}); 