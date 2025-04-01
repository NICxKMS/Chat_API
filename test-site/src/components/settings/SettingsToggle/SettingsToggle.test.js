import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsToggle from './index';

describe('SettingsToggle', () => {
  const defaultProps = {
    onClick: jest.fn(),
    isOpen: false
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders correctly when closed', () => {
    render(<SettingsToggle {...defaultProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Open settings');
    expect(button).toHaveAttribute('title', 'Open settings');
  });
  
  test('renders correctly when open', () => {
    render(<SettingsToggle {...defaultProps} isOpen={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Close settings');
    expect(button).toHaveAttribute('title', 'Close settings');
  });
  
  test('calls onClick when clicked', () => {
    render(<SettingsToggle {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });
  
  test('renders the gear icon', () => {
    render(<SettingsToggle {...defaultProps} />);
    
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
}); 