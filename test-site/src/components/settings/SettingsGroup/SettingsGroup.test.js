import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsGroup from './index';

describe('SettingsGroup', () => {
  const defaultProps = {
    title: 'Test Group',
    children: <div data-testid="group-content">Group content</div>
  };
  
  test('renders with title and content', () => {
    render(<SettingsGroup {...defaultProps} />);
    
    expect(screen.getByText('Test Group')).toBeInTheDocument();
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
  });
  
  test('renders with description when provided', () => {
    render(
      <SettingsGroup 
        {...defaultProps} 
        description="This is a test description"
      />
    );
    
    expect(screen.getByText('This is a test description')).toBeInTheDocument();
  });
  
  test('is expanded by default', () => {
    render(<SettingsGroup {...defaultProps} />);
    
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collapse section/i })).toBeInTheDocument();
  });
  
  test('can be initially collapsed with defaultExpanded prop', () => {
    render(<SettingsGroup {...defaultProps} defaultExpanded={false} />);
    
    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand section/i })).toBeInTheDocument();
  });
  
  test('toggles expansion when header is clicked', () => {
    render(<SettingsGroup {...defaultProps} />);
    
    // Initially expanded
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
    
    // Click header to collapse
    fireEvent.click(screen.getByRole('button', { name: /collapse section/i }));
    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
    
    // Click header again to expand
    fireEvent.click(screen.getByRole('button', { name: /expand section/i }));
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
  });
  
  test('toggles expansion with keyboard', () => {
    render(<SettingsGroup {...defaultProps} />);
    
    const header = screen.getByRole('button', { name: /collapse section/i }).parentElement;
    
    // Initially expanded
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
    
    // Press Enter to collapse
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
    
    // Press Space to expand
    fireEvent.keyDown(header, { key: ' ' });
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
    
    // Other keys should not toggle
    fireEvent.keyDown(header, { key: 'Tab' });
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
  });
  
  test('uses provided id attribute', () => {
    render(<SettingsGroup {...defaultProps} id="test-group-id" />);
    
    const groupElement = screen.getByRole('button', { name: /collapse section/i })
      .closest('[id]');
    expect(groupElement).toHaveAttribute('id', 'test-group-id');
  });
}); 