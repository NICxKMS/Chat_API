import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsSlider from './index';

describe('SettingsSlider', () => {
  const defaultProps = {
    id: 'test-slider',
    label: 'Test Slider Label',
    value: 50,
    min: 0,
    max: 100,
    step: 1,
    onChange: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with correct label, value, and ARIA attributes', () => {
    render(<SettingsSlider {...defaultProps} />);
    
    expect(screen.getByText('Test Slider Label')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    
    const slider = screen.getByRole('slider', { name: 'Test Slider Label' });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('id', 'test-slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '100');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveValue('50');
    
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });
  
  test('calls onChange with the correct numeric value when slider changes', () => {
    render(<SettingsSlider {...defaultProps} />);
    
    const slider = screen.getByRole('slider', { name: 'Test Slider Label' });
    fireEvent.change(slider, { target: { value: '75' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChange).toHaveBeenCalledWith(75);
  });
  
  test('displays formatted value correctly based on step size', () => {
    const { rerender } = render(<SettingsSlider {...defaultProps} value={7.5} step={0.1} />);
    expect(screen.getByText('7.5')).toBeInTheDocument();
    expect(screen.queryByText('7.50')).not.toBeInTheDocument();
    expect(screen.queryByText('8')).not.toBeInTheDocument();
    
    rerender(<SettingsSlider {...defaultProps} value={8.0} step={0.1} />);
    expect(screen.getByText('8.0')).toBeInTheDocument();
    
    rerender(<SettingsSlider {...defaultProps} value={8} step={1} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.queryByText('8.0')).not.toBeInTheDocument();
    
    rerender(<SettingsSlider {...defaultProps} value={10} step={2} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });
  
  test('shows and hides tooltip on mouse enter and leave', () => {
    render(<SettingsSlider {...defaultProps} tooltip="Slider tooltip text" />);
    
    const slider = screen.getByRole('slider', { name: 'Test Slider Label' });
    
    expect(screen.queryByText('Slider tooltip text')).not.toBeInTheDocument();
    
    fireEvent.mouseEnter(slider);
    expect(screen.getByText('Slider tooltip text')).toBeInTheDocument();
    
    fireEvent.mouseLeave(slider);
    expect(screen.queryByText('Slider tooltip text')).not.toBeInTheDocument();
  });
  
  test('disables slider and container when disabled prop is true', () => {
    render(<SettingsSlider {...defaultProps} disabled={true} />);
    
    const slider = screen.getByRole('slider', { name: 'Test Slider Label' });
    
    expect(slider).toBeDisabled();
    expect(slider.closest(`div[class*="sliderContainer"]`)).toHaveClass('disabled');
    
    fireEvent.change(slider, { target: { value: '75' } });
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
  
  test('updates slider fill width based on value percentage', () => {
    const { rerender } = render(<SettingsSlider {...defaultProps} value={50} />);
    let fillElement = screen.getByRole('slider', { name: 'Test Slider Label' }).previousElementSibling;
    expect(fillElement).toHaveStyle('width: 50%');
    
    rerender(<SettingsSlider {...defaultProps} value={75} />);
    fillElement = screen.getByRole('slider', { name: 'Test Slider Label' }).previousElementSibling;
    expect(fillElement).toHaveStyle('width: 75%');
    
    rerender(<SettingsSlider {...defaultProps} value={0} />);
    fillElement = screen.getByRole('slider', { name: 'Test Slider Label' }).previousElementSibling;
    expect(fillElement).toHaveStyle('width: 0%');
    
    rerender(<SettingsSlider {...defaultProps} value={60} min={20} max={100} />);
    fillElement = screen.getByRole('slider', { name: 'Test Slider Label' });
    expect(fillElement.previousElementSibling).toHaveStyle('width: 50%');
  });
}); 