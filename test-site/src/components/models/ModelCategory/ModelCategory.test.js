import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelCategory from './index';

// Remove the ModelItem mock to test integration
// jest.mock('../ModelItem', ...);

describe('ModelCategory', () => {
  // Realistic mock data matching the component's expected props structure
  const mockProviders = [
    {
      providerName: 'OpenAI',
      typeGroups: [
        {
          typeGroupName: 'GPT Models',
          models: [
            { id: 'model-gpt4', name: 'GPT-4', series: 'GPT' },
            { id: 'model-gpt35', name: 'GPT-3.5 Turbo', series: 'GPT' }
          ]
        },
        {
          typeGroupName: 'DALL-E',
          models: [
            { id: 'model-dalle3', name: 'DALL-E 3', series: 'DALL-E' }
          ]
        }
      ]
    },
    {
      providerName: 'Anthropic',
      typeGroups: [
        {
          typeGroupName: 'Claude Models',
          models: [
            { id: 'model-claude3', name: 'Claude 3 Opus', series: 'Claude' }
          ]
        }
      ]
    }
  ];

  const defaultProps = {
    categoryName: 'Chat & Image', // Example category name
    providers: mockProviders,
    onSelectModel: jest.fn(),
    selectedModelId: 'model-gpt4', // GPT-4 is initially selected
    searchTerm: '',
    showExperimental: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders category name and total model count', () => {
    render(<ModelCategory {...defaultProps} />);
    // Check category header
    const categoryHeader = screen.getByRole('button', { name: /Chat & Image/i });
    expect(categoryHeader).toBeInTheDocument();
    // Check total count (2 + 1 + 1 = 4)
    expect(categoryHeader.querySelector('span[class*="modelCount"]')).toHaveTextContent('4');
  });

  test('renders provider groups with names and counts', () => {
    render(<ModelCategory {...defaultProps} />);
    // Check OpenAI provider
    const openaiHeader = screen.getByRole('button', { name: /OpenAI/i });
    expect(openaiHeader).toBeInTheDocument();
    expect(openaiHeader.querySelector('span[class*="modelCount"]')).toHaveTextContent('3'); // 2 GPT + 1 DALL-E

    // Check Anthropic provider
    const anthropicHeader = screen.getByRole('button', { name: /Anthropic/i });
    expect(anthropicHeader).toBeInTheDocument();
    expect(anthropicHeader.querySelector('span[class*="modelCount"]')).toHaveTextContent('1');
  });

  test('renders type groups with names and counts', () => {
    render(<ModelCategory {...defaultProps} />);
    // Check GPT Models type group
    const gptHeader = screen.getByRole('button', { name: /GPT Models/i });
    expect(gptHeader).toBeInTheDocument();
    expect(gptHeader.querySelector('span[class*="modelCount"]')).toHaveTextContent('2');

    // Check DALL-E type group
    const dalleHeader = screen.getByRole('button', { name: /DALL-E/i });
    expect(dalleHeader).toBeInTheDocument();
    expect(dalleHeader.querySelector('span[class*="modelCount"]')).toHaveTextContent('1');

    // Check Claude Models type group
    const claudeHeader = screen.getByRole('button', { name: /Claude Models/i });
    expect(claudeHeader).toBeInTheDocument();
    expect(claudeHeader.querySelector('span[class*="modelCount"]')).toHaveTextContent('1');
  });

  test('renders ModelItems for each model', () => {
    render(<ModelCategory {...defaultProps} />);
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('GPT-3.5 Turbo')).toBeInTheDocument();
    expect(screen.getByText('DALL-E 3')).toBeInTheDocument();
    expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument();
  });

  test('toggles category expansion on header click', () => {
    render(<ModelCategory {...defaultProps} />);
    const categoryHeader = screen.getByRole('button', { name: /Chat & Image/i });

    // Initially expanded, providers should be visible
    expect(screen.getByRole('button', { name: /OpenAI/i })).toBeVisible();

    // Click to collapse
    fireEvent.click(categoryHeader);
    expect(screen.queryByRole('button', { name: /OpenAI/i })).not.toBeInTheDocument(); // Content removed from DOM

    // Click to expand
    fireEvent.click(categoryHeader);
    expect(screen.getByRole('button', { name: /OpenAI/i })).toBeVisible();
  });

  test('toggles provider expansion on header click', () => {
    render(<ModelCategory {...defaultProps} />);
    const openaiHeader = screen.getByRole('button', { name: /OpenAI/i });

    // Initially expanded, type groups should be visible
    expect(screen.getByRole('button', { name: /GPT Models/i })).toBeVisible();

    // Click to collapse
    fireEvent.click(openaiHeader);
    expect(screen.queryByRole('button', { name: /GPT Models/i })).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(openaiHeader);
    expect(screen.getByRole('button', { name: /GPT Models/i })).toBeVisible();
  });

  test('toggles type group expansion on header click', () => {
    render(<ModelCategory {...defaultProps} />);
    const gptHeader = screen.getByRole('button', { name: /GPT Models/i });

    // Initially expanded, models should be visible
    expect(screen.getByText('GPT-4')).toBeVisible();

    // Click to collapse
    fireEvent.click(gptHeader);
    expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(gptHeader);
    expect(screen.getByText('GPT-4')).toBeVisible();
  });

  test('marks the correct ModelItem as selected', () => {
    render(<ModelCategory {...defaultProps} selectedModelId="model-claude3" />);

    // Find the selected item (Claude 3) - check for the selection indicator
    const selectedItem = screen.getByText('Claude 3 Opus').closest('div[role="option"]');
    expect(selectedItem).toHaveClass('selected');
    expect(screen.getByTestId('check-icon')).toBeInTheDocument(); // Assuming ModelItem still uses this

    // Check another item is not selected
    const unselectedItem = screen.getByText('GPT-4').closest('div[role="option"]');
    expect(unselectedItem).not.toHaveClass('selected');
  });

  test('calls onSelectModel with the correct model when a ModelItem is clicked', () => {
    render(<ModelCategory {...defaultProps} />);

    // Find and click the DALL-E 3 model item
    const dalleItem = screen.getByText('DALL-E 3').closest('div[role="option"]');
    fireEvent.click(dalleItem);

    expect(defaultProps.onSelectModel).toHaveBeenCalledTimes(1);
    // Expect it to be called with the corresponding model object from the mock data
    expect(defaultProps.onSelectModel).toHaveBeenCalledWith(mockProviders[0].typeGroups[1].models[0]);
  });

  test('passes searchTerm down to ModelItem (verified by highlighting)', () => {
    // Render with a search term that should highlight part of a model name
    render(<ModelCategory {...defaultProps} searchTerm="Opus" />);
    
    // Check for the highlighted span within the relevant model item
    const highlightedText = screen.getByText('Opus', { selector: 'span[class*="highlight"]' });
    expect(highlightedText).toBeInTheDocument();
    // Ensure it's part of the correct model name
    expect(screen.getByText('Claude 3 Opus')).toContainElement(highlightedText);
  });

  test('returns null if the total number of models in providers is zero', () => {
    const emptyProviders = [
      { providerName: 'Test', typeGroups: [{ typeGroupName: 'Group', models: [] }] }
    ];
    const { container } = render(<ModelCategory {...defaultProps} providers={emptyProviders} />);
    // The component should render nothing
    expect(container.firstChild).toBeNull();
  });
  
  // Note: Testing `showExperimental` propagation would likely require 
  // modifying the mock data to include experimental models and then 
  // verifying their presence/absence or specific props passed to a 
  // (potentially minimally mocked) ModelItem. For now, assuming it's passed down.
}); 