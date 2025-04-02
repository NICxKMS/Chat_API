import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ModelDropdown from './index'; // Assuming index.js is the main export

// --- MOCK SETUP ---
// Define realistic mock data structure based on implementation's use of processedModels
const mockProcessedModels = {
  Chat: {
    'OpenAI': {
      'GPT Models': [
        { id: 'model1', name: 'GPT-4', provider: 'OpenAI', type: 'Chat', is_experimental: false, displayName: 'GPT-4', category: 'Chat', providerName: 'OpenAI', typeGroupName: 'GPT Models' },
        { id: 'model4', name: 'GPT-3.5', provider: 'OpenAI', type: 'Chat', is_experimental: true, displayName: 'GPT-3.5 Turbo', category: 'Chat', providerName: 'OpenAI', typeGroupName: 'GPT Models' } // Experimental
      ]
    },
    'Anthropic': {
      'Claude Models': [
        { id: 'model2', name: 'Claude 3', provider: 'Anthropic', type: 'Chat', is_experimental: false, displayName: 'Claude 3 Opus', category: 'Chat', providerName: 'Anthropic', typeGroupName: 'Claude Models' }
      ]
    }
  },
  Image: {
    'OpenAI': {
      'DALL-E': [
        { id: 'model3', name: 'DALL-E 3', provider: 'OpenAI', type: 'Image', is_experimental: false, displayName: 'DALL-E 3', category: 'Image', providerName: 'OpenAI', typeGroupName: 'DALL-E' }
      ]
    }
  },
  Embedding: {} // No embedding models initially
};

// Mock functions
const mockSelectModel = jest.fn();
const mockToggleExperimentalModels = jest.fn();
const mockUpdateSearchFilter = jest.fn();

// Initial mock state
let mockState = {
  processedModels: mockProcessedModels,
  selectedModel: mockProcessedModels.Chat.OpenAI['GPT Models'][0], // Start with GPT-4 selected
  selectModel: mockSelectModel,
  isExperimentalModelsEnabled: false, // Corresponds to toggle input state
  toggleExperimentalModels: mockToggleExperimentalModels,
  showExperimental: false, // Controls filtering
  updateSearchFilter: mockUpdateSearchFilter,
  isLoading: false,
};

// Mock the context provider
jest.mock('../../../contexts/ModelContext', () => ({
  useModel: () => mockState,
}));
// --- END MOCK SETUP ---


describe('ModelSelection Component (formerly ModelDropdown tests)', () => {
  beforeEach(() => {
    // Reset mocks and mock state before each test
    jest.clearAllMocks();
    mockState = {
      processedModels: mockProcessedModels,
      selectedModel: mockProcessedModels.Chat.OpenAI['GPT Models'][0],
      selectModel: mockSelectModel,
      isExperimentalModelsEnabled: false,
      toggleExperimentalModels: mockToggleExperimentalModels,
      showExperimental: false,
      updateSearchFilter: mockUpdateSearchFilter,
      isLoading: false,
    };
  });

  test('renders with selected model details (name, provider, type)', () => {
    render(<ModelDropdown />);

    // Check for selected model display
    expect(screen.getByText('GPT-4')).toBeInTheDocument(); // Name
    // Check description format (Provider - Type)
    expect(screen.getByText('OpenAI - Chat')).toBeInTheDocument();
  });

  test('toggles dropdown content when selected model display is clicked', async () => {
    render(<ModelDropdown />);

    // Initially, dropdown content like search and tabs should not be visible
    expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat')).not.toBeInTheDocument(); // Capability tab

    // Click the selected model area to open
    const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
    expect(selectedModelDisplay).toBeInTheDocument();
    fireEvent.click(selectedModelDisplay);

    // Now search, tabs, experimental toggle, and models should be visible
    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument(); // Tab
    expect(screen.getByText('Image')).toBeInTheDocument(); // Tab
    expect(screen.getByText('Show experimental models')).toBeInTheDocument();
    expect(screen.getByText('Claude 3')).toBeInTheDocument(); // Another model

    // Click again to close
    fireEvent.click(selectedModelDisplay);

    // Wait for elements to potentially disappear (needed due to animations/transitions)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
      expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    });
  });

  test('displays capability tabs and filters models when tab is clicked', () => {
    render(<ModelDropdown />);
    const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay); // Open dropdown

    // Initially 'Chat' is active
    expect(screen.getByText('Chat')).toHaveClass('active');
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('Claude 3')).toBeInTheDocument();
    expect(screen.queryByText('DALL-E 3')).not.toBeInTheDocument();

    // Click 'Image' tab
    fireEvent.click(screen.getByText('Image'));

    // Now 'Image' should be active
    expect(screen.getByText('Image')).toHaveClass('active');
    expect(screen.getByText('DALL-E 3')).toBeInTheDocument(); // Image model visible
    expect(screen.queryByText('GPT-4')).not.toBeInTheDocument(); // Chat model hidden
    expect(screen.queryByText('Claude 3')).not.toBeInTheDocument(); // Chat model hidden
  });

    test('displays "No models available" message for empty categories', () => {
        render(<ModelDropdown />);
        const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        // Click 'Embedding' tab (which is empty in mock data)
        fireEvent.click(screen.getByText('Embedding'));

        expect(screen.getByText('No embedding models available')).toBeInTheDocument();
        expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();
        expect(screen.queryByText('DALL-E 3')).not.toBeInTheDocument();
    });

  test('calls toggleExperimentalModels when the toggle is clicked', () => {
    render(<ModelDropdown />);
    const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay); // Open dropdown

    // Find the toggle by its label text
    const experimentalToggle = screen.getByLabelText(/show experimental models/i);
    fireEvent.click(experimentalToggle);

    expect(mockToggleExperimentalModels).toHaveBeenCalledTimes(1);
  });

   test('filters experimental models based on showExperimental state', () => {
        render(<ModelDropdown />);
        const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        // Initially, experimental GPT-3.5 is hidden
        expect(screen.getByText('GPT-4')).toBeInTheDocument(); // Non-experimental shown
        expect(screen.queryByText('GPT-3.5 Turbo')).not.toBeInTheDocument();

        // Simulate toggling ON experimental models in context state and re-render
        mockState.showExperimental = true;
        mockState.isExperimentalModelsEnabled = true; // Sync toggle state
        render(<ModelDropdown />);
        fireEvent.click(screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]')); // Re-open dropdown

        // Now experimental model should be visible
        expect(screen.getByText('GPT-4')).toBeInTheDocument();
        expect(screen.getByText('GPT-3.5 Turbo')).toBeInTheDocument(); // Experimental shown
    });

  test('calls updateSearchFilter when search input changes', () => {
    render(<ModelDropdown />);
    const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay); // Open dropdown

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'clau' } });

    expect(mockUpdateSearchFilter).toHaveBeenCalledTimes(1);
    expect(mockUpdateSearchFilter).toHaveBeenCalledWith('clau');
  });

    test('displays "No models found matching..." message when search yields no results', () => {
        // Simulate a state where search term doesn't match anything
        mockState.processedModels = { Chat: {}, Image: {}, Embedding: {} }; // Empty data for simplicity
        render(<ModelDropdown />);
        const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        // Simulate search input change that calls the filter update
        const searchInput = screen.getByPlaceholderText('Search models...');
        fireEvent.change(searchInput, { target: { value: 'nomatch' } });
        // Manually trigger filter update for the test (component does this internally)
        act(() => {
          mockUpdateSearchFilter('nomatch');
        });

       // Since the component uses the state *after* updateSearchFilter is called,
       // we need to ensure the component re-renders with the filtered (empty) state
       // For this test, we assume the search term 'nomatch' is active and processedModels is empty
       render(<ModelDropdown />); // Re-render with empty data
       fireEvent.click(screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]')); // Re-open
       fireEvent.change(screen.getByPlaceholderText('Search models...'), { target: { value: 'nomatch' } }); // Set search term in UI

        // Check for the no results message
        expect(screen.getByText(/No models found matching "nomatch"/)).toBeInTheDocument();
        expect(screen.getByText('Clear search')).toBeInTheDocument(); // Clear button should show
    });

    test('calls selectModel and clears search when a model item is clicked', () => {
        render(<ModelDropdown />);
        const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        // Find and click 'Claude 3' model item
        const claudeModelItem = screen.getByText('Claude 3 Opus').closest('div[class*="modelItem"]'); // Find by display name
        expect(claudeModelItem).toBeInTheDocument();
        fireEvent.click(claudeModelItem);

        // Check if selectModel was called with the correct model object
        expect(mockSelectModel).toHaveBeenCalledTimes(1);
        expect(mockSelectModel).toHaveBeenCalledWith(mockProcessedModels.Chat.Anthropic['Claude Models'][0]); // Check with the specific model data

        // Check if search was cleared (updateSearchFilter called with '')
        expect(mockUpdateSearchFilter).toHaveBeenCalledWith('');

        // Dropdown should close after selection (verify by checking for an element inside it)
        expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
    });

  test('shows loading indicator when isLoading is true', () => {
    mockState.isLoading = true;
    render(<ModelDropdown />);
    const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay); // Open dropdown

    expect(screen.getByText('Loading models...')).toBeInTheDocument();
    // Should not show models when loading
    expect(screen.queryByText('Claude 3')).not.toBeInTheDocument();
  });

  // Note: The 'closes dropdown when clicking outside' test relies on DOM structure and event bubbling.
  // It's generally stable but can be brittle. Keep it if it passes, review if it breaks frequently.
  test('closes dropdown when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <ModelDropdown />
      </div>
    );

    // Open dropdown
    const selectedModelDisplay = screen.getByText('GPT-4').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay);
    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument(); // Check if open

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-element')); // Use mouseDown as dropdown might use it

    // Dropdown should be closed - wait for potential transition/animation
    await waitFor(() => {
       expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
    });
  });

});
