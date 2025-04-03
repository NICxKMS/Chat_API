import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPanel from './index';

// Mock context providers
const mockUpdateSetting = jest.fn();
let mockShouldRestrictTemperature = jest.fn(() => false); // Default to not restricted
const mockSelectedModel = { id: 'model-default', name: 'Default Model' }; // Default model

jest.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: 1500,
      frequency_penalty: 0.5,
      presence_penalty: 0.2,
      stream: true,
    },
    updateSetting: mockUpdateSetting,
    shouldRestrictTemperature: mockShouldRestrictTemperature,
  }),
}));

jest.mock('../../../contexts/ModelContext', () => ({
  useModel: () => ({
    selectedModel: mockSelectedModel,
  }),
}));

// Mock the lazy-loaded components (optional but speeds up tests)
// If not mocked, findBy* queries handle the delay.
// For this example, we'll assume they render basic inputs for testing interaction.
jest.mock('../SettingsSlider', () => (props) => (
  <div>
    <label htmlFor={props.id}>{props.label}</label>
    <input
      type="range"
      id={props.id}
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(parseFloat(e.target.value))}
      title={props.tooltip} // Assuming tooltip is passed as title
    />
    <span>{props.value}</span> {/* Display value for easier assertion */}
  </div>
));

jest.mock('../SettingsToggle', () => (props) => (
  <div>
    <label htmlFor={props.id}>{props.label}</label>
    <input
      type="checkbox"
      id={props.id}
      checked={props.isChecked}
      onChange={(e) => props.onChange(e.target.checked)}
      title={props.tooltip}
    />
  </div>
));


describe('SettingsPanel', () => {
  const mockOnClose = jest.fn();

  const renderPanel = (props = {}) => {
    // Wrap with Suspense for lazy loading, although mocks bypass this
    return render(
      <Suspense fallback={<div>Loading...</div>}>
        <SettingsPanel isOpen={true} onClose={mockOnClose} {...props} />
      </Suspense>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset restriction mock for each test
    mockShouldRestrictTemperature.mockImplementation(() => false);
  });

  test('renders header and content when isOpen is true', async () => {
    renderPanel({ isOpen: true });

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close settings/i })).toBeInTheDocument();
    
    // Check for one of the controls to ensure content is potentially visible
    // Use findBy to handle suspense/lazy loading if components weren't mocked
    expect(await screen.findByLabelText('Temperature')).toBeInTheDocument(); 
  });

  test('applies correct classes based on isOpen prop', () => {
    const { container, rerender } = render(
      <SettingsPanel isOpen={false} onClose={mockOnClose} />
    );
    // Panel exists but shouldn't have the 'open' class
    const panelElement = container.firstChild;
    expect(panelElement).toBeInTheDocument();
    expect(panelElement).not.toHaveClass('open'); 

    rerender(<SettingsPanel isOpen={true} onClose={mockOnClose} />);
    expect(container.firstChild).toHaveClass('open');
  });

  test('calls onClose when the close button is clicked', () => {
    renderPanel({ isOpen: true });
    const closeButton = screen.getByRole('button', { name: /close settings/i });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('renders all settings controls with initial values', async () => {
    renderPanel({ isOpen: true });

    // Use findByLabelText for async loading (though mocks make it sync)
    expect(await screen.findByLabelText('Temperature')).toHaveValue('0.8');
    expect(await screen.findByLabelText('Top P')).toHaveValue('0.9');
    expect(await screen.findByLabelText('Max Tokens')).toHaveValue('1500');
    expect(await screen.findByLabelText('Frequency Penalty')).toHaveValue('0.5');
    expect(await screen.findByLabelText('Presence Penalty')).toHaveValue('0.2');
    expect(await screen.findByLabelText('Stream Response')).toBeChecked();
  });

  test('calls updateSetting with correct args when Temperature slider changes', async () => {
    renderPanel({ isOpen: true });
    const slider = await screen.findByLabelText('Temperature');
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('temperature', 0.5);
  });

  test('calls updateSetting with correct args when Top P slider changes', async () => {
    renderPanel({ isOpen: true });
    const slider = await screen.findByLabelText('Top P');
    fireEvent.change(slider, { target: { value: '0.75' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('top_p', 0.75);
  });

   test('calls updateSetting with correct args when Max Tokens slider changes', async () => {
    renderPanel({ isOpen: true });
    const slider = await screen.findByLabelText('Max Tokens');
    fireEvent.change(slider, { target: { value: '2000' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('max_tokens', 2000);
  });

  test('calls updateSetting with correct args when Frequency Penalty slider changes', async () => {
    renderPanel({ isOpen: true });
    const slider = await screen.findByLabelText('Frequency Penalty');
    fireEvent.change(slider, { target: { value: '1.2' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('frequency_penalty', 1.2);
  });
  
  test('calls updateSetting with correct args when Presence Penalty slider changes', async () => {
    renderPanel({ isOpen: true });
    const slider = await screen.findByLabelText('Presence Penalty');
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('presence_penalty', 0.8);
  });

  test('calls updateSetting with correct args when Stream Response toggle changes', async () => {
    renderPanel({ isOpen: true });
    const toggle = await screen.findByLabelText('Stream Response');
    // Initial state is true (checked), click to change to false
    fireEvent.click(toggle); 
    expect(mockUpdateSetting).toHaveBeenCalledWith('stream', false);
  });

  test('disables Temperature slider and shows tooltip when restricted', async () => {
    // Set up the mock to return true for restriction
    mockShouldRestrictTemperature.mockImplementation(() => true);
    renderPanel({ isOpen: true });

    const slider = await screen.findByLabelText('Temperature');
    expect(slider).toBeDisabled();
    // Check the tooltip (assuming it's passed as the title attribute in the mock/real component)
    expect(slider).toHaveAttribute('title', 'This model requires temperature set to 1.0');
  });

  test('enables Temperature slider and shows standard tooltip when not restricted', async () => {
    // Mock returns false by default (set in beforeEach)
    renderPanel({ isOpen: true });

    const slider = await screen.findByLabelText('Temperature');
    expect(slider).not.toBeDisabled();
    expect(slider).toHaveAttribute('title', 'Controls randomness: Lower values are more deterministic, higher values more creative');
  });

}); 