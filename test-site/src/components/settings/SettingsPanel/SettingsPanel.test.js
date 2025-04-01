import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPanel from './index';

// Mock the context to control the isOpen state
jest.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      temperature: 0.7,
      maxTokens: 1000,
      streaming: true
    },
    updateSetting: jest.fn()
  })
}));

describe('SettingsPanel', () => {
  const mockClose = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders when open', () => {
    render(<SettingsPanel isOpen={true} onClose={mockClose} />);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
  
  test('does not render when closed', () => {
    const { container } = render(<SettingsPanel isOpen={false} onClose={mockClose} />);
    
    // The component shouldn't render anything substantial when closed
    expect(container.firstChild).toBeNull();
  });
  
  test('calls onClose when close button is clicked', () => {
    render(<SettingsPanel isOpen={true} onClose={mockClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  
  test('calls onClose when clicking overlay', () => {
    render(<SettingsPanel isOpen={true} onClose={mockClose} />);
    
    // Find the overlay (the container that has onClick handler)
    const overlay = screen.getByTestId('settings-overlay');
    fireEvent.click(overlay);
    
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  
  test('does not close when clicking the settings content', () => {
    render(<SettingsPanel isOpen={true} onClose={mockClose} />);
    
    // Find the content panel
    const contentPanel = screen.getByTestId('settings-content');
    fireEvent.click(contentPanel);
    
    // Should not call onClose when clicking inside the content
    expect(mockClose).not.toHaveBeenCalled();
  });
}); 