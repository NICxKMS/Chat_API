import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsToggle from './index';

describe('SettingsToggle', () => {
  const defaultProps = {
    id: 'test-toggle',
    label: 'Test Toggle Label',
    isChecked: false,
    onChange: jest.fn(),
    tooltip: 'This is a tooltip' // Include tooltip by default for testing
  };

  // Helper wrapper to manage state for toggle tests
  const TestWrapper = (initialProps) => {
    const [checked, setChecked] = React.useState(initialProps.isChecked);
    const handleChange = (newCheckedState) => {
        initialProps.onChange(newCheckedState);
        setChecked(newCheckedState);
    }
    return <SettingsToggle {...initialProps} isChecked={checked} onChange={handleChange} />;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders label, switch (unchecked by default), and tooltip icon', () => {
    render(<SettingsToggle {...defaultProps} isChecked={false} />);

    // Check label
    expect(screen.getByText('Test Toggle Label')).toBeInTheDocument();

    // Check switch role and state
    const switchElement = screen.getByRole('switch', { name: 'Test Toggle Label' });
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    expect(switchElement).toHaveClass('toggle'); // Check base class
    expect(switchElement).not.toHaveClass('checked'); // Should not have checked class
    
    // Check associated label contains tooltip icon and attribute
    const labelElement = screen.getByText('Test Toggle Label').closest('label');
    const tooltipSpan = labelElement.querySelector(`span[class*="tooltip"]`);
    expect(tooltipSpan).toBeInTheDocument();
    expect(tooltipSpan).toHaveAttribute('data-tooltip', 'This is a tooltip');
    expect(tooltipSpan.querySelector('svg[class*="infoIcon"]')).toBeInTheDocument(); // Check for SVG icon

    // Check screen-reader text update (optional but good)
    expect(switchElement.querySelector('.srOnly')).toHaveTextContent('Test Toggle Label is disabled');
  });

  test('renders in checked state when isChecked is true', () => {
    render(<SettingsToggle {...defaultProps} isChecked={true} />);

    const switchElement = screen.getByRole('switch', { name: 'Test Toggle Label' });
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
    expect(switchElement).toHaveClass('checked'); // Should have checked class

    // Check screen-reader text update
    expect(switchElement.querySelector('.srOnly')).toHaveTextContent('Test Toggle Label is enabled');
  });

  test('calls onChange with the new state when the switch is clicked', () => {
    render(<TestWrapper {...defaultProps} isChecked={false} />); 
    const switchElement = screen.getByRole('switch', { name: 'Test Toggle Label' });

    // 1. Click when unchecked (false -> true)
    fireEvent.click(switchElement);
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChange).toHaveBeenCalledWith(true); // Called with NEW state
    // State updates via wrapper
    expect(switchElement).toHaveAttribute('aria-checked', 'true'); 
    expect(switchElement).toHaveClass('checked');

    // Clear mock calls
    defaultProps.onChange.mockClear(); 

    // 2. Click when checked (true -> false)
    fireEvent.click(switchElement);
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChange).toHaveBeenCalledWith(false);
    expect(switchElement).toHaveAttribute('aria-checked', 'false'); 
    expect(switchElement).not.toHaveClass('checked');
  });

  test('does not render tooltip icon if tooltip prop is not provided', () => {
    render(<SettingsToggle {...defaultProps} tooltip={undefined} />); // No tooltip prop
    const labelElement = screen.getByText('Test Toggle Label').closest('label');
    expect(labelElement.querySelector(`span[class*="tooltip"]`)).not.toBeInTheDocument();
  });
  
  // Note: The component doesn't include disabled handling or specific keyboard handlers beyond native button behavior.
  // If those were added, tests for disabled state and Enter/Space keydown would be necessary.
}); 