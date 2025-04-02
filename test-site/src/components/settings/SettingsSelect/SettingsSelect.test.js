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
  
  // Helper to render the component, managing value changes for rerenders
  const TestWrapper = (initialProps) => {
    const [currentValue, setCurrentValue] = React.useState(initialProps.value);
    const handleChange = (newValue) => {
        initialProps.onChange(newValue);
        setCurrentValue(newValue);
    }
    return <SettingsSelect {...initialProps} value={currentValue} onChange={handleChange} />;
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with correct label, selected value, and initial ARIA state', () => {
    render(<SettingsSelect {...defaultProps} />);
    
    expect(screen.getByText('Test Select')).toBeInTheDocument(); // Label
    // The displayed value is inside the combobox
    const combobox = screen.getByRole('combobox', { name: 'Test Select' }); 
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveTextContent('Option 1'); // Selected value display
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
  });
  
  test('opens dropdown and shows options when combobox is clicked', () => {
    render(<SettingsSelect {...defaultProps} />);
    const combobox = screen.getByRole('combobox', { name: 'Test Select' });
    
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); // Initially closed
    fireEvent.click(combobox);

    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // Check options are rendered within the listbox
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument();
    // Check selected state within options
    expect(screen.getByRole('option', { name: 'Option 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Option 2' })).toHaveAttribute('aria-selected', 'false');
  });
  
  test('selects an option, calls onChange, updates display, and closes dropdown on option click', async () => {
    render(<TestWrapper {...defaultProps} />); 
    const combobox = screen.getByRole('combobox', { name: 'Test Select' });

    // Open the dropdown
    fireEvent.click(combobox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Click the second option (using getByText for robustness)
    const option2 = screen.getByRole('option', { name: 'Option 2' });
    fireEvent.click(option2);

    // onChange should be called
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChange).toHaveBeenCalledWith('option2');

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    // Displayed value should update
    expect(combobox).toHaveTextContent('Option 2');
  });
  
  test('handles keyboard interactions for opening, closing, and selection', () => {
     // Use wrapper to handle value updates for checking display
    render(<TestWrapper {...defaultProps} />); 
    const combobox = screen.getByRole('combobox', { name: 'Test Select' });

    // ---- Opening ----
    // Open with Enter
    fireEvent.keyDown(combobox, { key: 'Enter', code: 'Enter' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // ---- Closing ----
    // Close with Escape
    fireEvent.keyDown(combobox, { key: 'Escape', code: 'Escape' });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Re-open with Space
    fireEvent.keyDown(combobox, { key: ' ', code: 'Space' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    
    // ---- Navigation (only works when open) ----
    // Navigate down (option1 -> option2)
    fireEvent.keyDown(combobox, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(1); // First change
    expect(defaultProps.onChange).toHaveBeenCalledWith('option2');
    expect(combobox).toHaveTextContent('Option 2'); // Display updates via wrapper
    expect(screen.getByRole('option', { name: 'Option 2' })).toHaveAttribute('aria-selected', 'true');

    // Navigate down again (option2 -> option3)
    fireEvent.keyDown(combobox, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(2);
    expect(defaultProps.onChange).toHaveBeenCalledWith('option3');
    expect(combobox).toHaveTextContent('Option 3');
    expect(screen.getByRole('option', { name: 'Option 3' })).toHaveAttribute('aria-selected', 'true');

    // Navigate up (option3 -> option2)
    fireEvent.keyDown(combobox, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(3);
    expect(defaultProps.onChange).toHaveBeenCalledWith('option2');
    expect(combobox).toHaveTextContent('Option 2');
    expect(screen.getByRole('option', { name: 'Option 2' })).toHaveAttribute('aria-selected', 'true');

     // Close dropdown before testing arrow keys again
    fireEvent.keyDown(combobox, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Arrow keys should NOT trigger change when closed
    const currentCallCount = defaultProps.onChange.mock.calls.length;
    fireEvent.keyDown(combobox, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(currentCallCount);
    fireEvent.keyDown(combobox, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(defaultProps.onChange).toHaveBeenCalledTimes(currentCallCount);
  });
  
  test('displays tooltip on the label when provided', () => {
    render(<SettingsSelect {...defaultProps} tooltip="This is a helpful tip" />);
    // The label is associated via htmlFor/id, get by text
    const label = screen.getByText('Test Select'); 
    expect(label).toHaveAttribute('title', 'This is a helpful tip');
  });
  
  test('is disabled correctly when disabled prop is true', () => {
    render(<SettingsSelect {...defaultProps} disabled={true} />);
    const combobox = screen.getByRole('combobox', { name: 'Test Select' });

    expect(combobox).toHaveAttribute('aria-disabled', 'true');
    expect(combobox).not.toHaveAttribute('tabIndex', '0'); // Should not be tabbable
    expect(combobox.closest(`div[class*="selectContainer"]`)).toHaveClass('disabled'); // Check container style

    // Click should not open dropdown
    fireEvent.click(combobox);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    // Keyboard events should not open dropdown
    fireEvent.keyDown(combobox, { key: 'Enter', code: 'Enter' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(combobox, { key: ' ', code: 'Space' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  
  test('closes dropdown when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <SettingsSelect {...defaultProps} />
      </div>
    );
    const combobox = screen.getByRole('combobox', { name: 'Test Select' });

    // Open the dropdown
    fireEvent.click(combobox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-element'));

    // Dropdown should close
    await waitFor(() => { // Wait for potential state update and re-render
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
     expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });
}); 