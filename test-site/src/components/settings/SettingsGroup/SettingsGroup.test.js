import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsGroup from './index';

describe('SettingsGroup', () => {
  const defaultProps = {
    title: 'Test Group',
    children: <div data-testid="group-content">Group content</div>,
    id: 'test-group-id' // Include ID for easier selection in some tests
  };
  
  test('renders with title and content (expanded by default)', () => {
    render(<SettingsGroup {...defaultProps} />);
    expect(screen.getByText('Test Group')).toBeInTheDocument();
    expect(screen.getByTestId('group-content')).toBeInTheDocument();
    // Check accessibility state for default expansion
    expect(screen.getByRole('button', { name: 'Test Group' })).toHaveAttribute('aria-expanded', 'true');
  });
  
  test('renders description when provided', () => {
    render(<SettingsGroup {...defaultProps} description="This is a test description" />);
    expect(screen.getByText('This is a test description')).toBeInTheDocument();
  });
  
  test('can be initially collapsed via defaultExpanded prop', () => {
    render(<SettingsGroup {...defaultProps} defaultExpanded={false} />);
    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
    // Check accessibility state for collapsed
    expect(screen.getByRole('button', { name: 'Test Group' })).toHaveAttribute('aria-expanded', 'false');
  });
  
  test('toggles expansion when the main header area is clicked', () => {
    render(<SettingsGroup {...defaultProps} />);
    const headerToggle = screen.getByRole('button', { name: 'Test Group' }); // Target the main header div

    // Initially expanded
    expect(screen.getByTestId('group-content')).toBeVisible();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'true');

    // Click header to collapse
    fireEvent.click(headerToggle);
    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'false');

    // Click header again to expand
    fireEvent.click(headerToggle);
    expect(screen.getByTestId('group-content')).toBeVisible();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'true');
  });
  
  test('toggles expansion when the inner expand/collapse arrow button is clicked', () => {
    render(<SettingsGroup {...defaultProps} />);
    // Find the inner button by its aria-label (which changes)
    const innerButton = screen.getByRole('button', { name: /collapse section/i }); 
    const headerToggle = screen.getByRole('button', { name: 'Test Group' }); // Reference to check aria-expanded

    // Initially expanded
    expect(screen.getByTestId('group-content')).toBeVisible();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'true');

    // Click inner button to collapse
    fireEvent.click(innerButton);
    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'false');
    // Inner button label should update
    expect(screen.getByRole('button', { name: /expand section/i })).toBeInTheDocument(); 

    // Click inner button again (it now has a different label)
    fireEvent.click(screen.getByRole('button', { name: /expand section/i }));
    expect(screen.getByTestId('group-content')).toBeVisible();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'true');
    // Inner button label should update back
    expect(screen.getByRole('button', { name: /collapse section/i })).toBeInTheDocument();
  });
  
  test('toggles expansion with Enter or Space key on the main header', () => {
    render(<SettingsGroup {...defaultProps} />);
    const headerToggle = screen.getByRole('button', { name: 'Test Group' }); // Target the main header div

    // Initially expanded
    expect(screen.getByTestId('group-content')).toBeVisible();

    // Press Enter on header to collapse
    fireEvent.keyDown(headerToggle, { key: 'Enter', code: 'Enter' });
    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'false');

    // Press Space on header to expand
    fireEvent.keyDown(headerToggle, { key: ' ', code: 'Space' });
    expect(screen.getByTestId('group-content')).toBeVisible();
    expect(headerToggle).toHaveAttribute('aria-expanded', 'true');

    // Pressing other keys should not toggle
    fireEvent.keyDown(headerToggle, { key: 'Tab', code: 'Tab' });
    expect(screen.getByTestId('group-content')).toBeVisible(); // Should still be visible
  });
  
  test('applies the provided id attribute to the root element', () => {
    render(<SettingsGroup {...defaultProps} />); // id is in defaultProps
    // Find the element with the specific ID
    const groupElement = document.getElementById('test-group-id');
    expect(groupElement).toBeInTheDocument();
    // Check if it contains the title as a basic verification it's the right element
    expect(screen.getByText('Test Group')).toBeInTheDocument(); 
  });
}); 