import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
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
  useModel: () => ({
    processedModels: mockState.processedModels,
    selectedModel: mockState.selectedModel,
    selectModel: mockState.selectModel,
    isExperimentalModelsEnabled: mockState.isExperimentalModelsEnabled,
    toggleExperimentalModels: mockState.toggleExperimentalModels,
    showExperimental: mockState.showExperimental,
    isLoading: mockState.isLoading,
  }),
  useModelFilter: () => ({
    modelFilter: { search: mockState.searchTerm || '' },
    updateCategoryFilter: mockState.updateCategoryFilter || jest.fn(),
    updateSearchFilter: mockState.updateSearchFilter,
  }),
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

    // Click the selected model area to open - Use description text for unique targeting
    const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
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
    const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay); // Open dropdown

    // Find the scrollable list container
    const listContainer = screen.getByRole('listbox'); // The dropdown has role="listbox"

    // Initially 'Chat' is active - Assertions based on list content
    expect(screen.getByText('Chat')).toHaveClass('active');
    expect(within(listContainer).getByText('GPT-4')).toBeInTheDocument(); // Check within list
    expect(within(listContainer).getByText('Claude 3')).toBeInTheDocument(); // Check within list
    expect(within(listContainer).queryByText('DALL-E 3')).not.toBeInTheDocument(); // Check within list

    // Click 'Image' tab
    fireEvent.click(screen.getByText('Image'));

    // Now 'Image' should be active - Assertions based on list content
    expect(screen.getByText('Image')).toHaveClass('active');
    expect(within(listContainer).getByText('DALL-E 3')).toBeInTheDocument(); // Check within list
    expect(within(listContainer).queryByText('GPT-4')).not.toBeInTheDocument(); // Check within list
    expect(within(listContainer).queryByText('Claude 3')).not.toBeInTheDocument(); // Check within list
  });

    test('displays "No models available" message for empty categories', () => {
        render(<ModelDropdown />);
        const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        // Find the scrollable list container
        const listContainer = screen.getByRole('listbox'); 

        // Click 'Embedding' tab (which is empty in mock data)
        fireEvent.click(screen.getByText('Embedding'));

        // Check message and absence of items within the list container
        expect(within(listContainer).getByText('No embedding models available')).toBeInTheDocument();
        expect(within(listContainer).queryByText('GPT-4')).not.toBeInTheDocument();
        expect(within(listContainer).queryByText('DALL-E 3')).not.toBeInTheDocument();
    });

  test('calls toggleExperimentalModels when the toggle is clicked', () => {
    render(<ModelDropdown />);
    // Use description text for unique targeting
    const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay); // Open dropdown

    // Find the toggle by its label text
    const experimentalToggle = screen.getByLabelText(/show experimental models/i);
    fireEvent.click(experimentalToggle);

    expect(mockToggleExperimentalModels).toHaveBeenCalledTimes(1);
  });

   test('filters experimental models based on showExperimental state', () => {
        // Initial render
        const { unmount, rerender } = render(<ModelDropdown />); 
        const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        const listContainer = screen.getByRole('listbox');

        // Initially, experimental GPT-3.5 is hidden - Check within list
        expect(within(listContainer).getByText('GPT-4')).toBeInTheDocument(); // Non-experimental shown
        expect(within(listContainer).queryByText('GPT-3.5 Turbo')).not.toBeInTheDocument();

        // Simulate toggling ON experimental models in context state
        mockState.showExperimental = true;
        mockState.isExperimentalModelsEnabled = true; // Sync toggle state
        
        // Unmount the previous instance before rendering again with updated state
        unmount();
        render(<ModelDropdown />); 

        // Use description text for unique targeting again after re-render
        // Need to re-query the element after re-render
        const newSelectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(newSelectedModelDisplay); // Re-open dropdown
        
        // Re-find list container after re-render
        const newListContainer = screen.getByRole('listbox');

        // Now experimental model should be visible - Check within list
        expect(within(newListContainer).getByText('GPT-4')).toBeInTheDocument();
        // Check for the actual rendered name, not the displayName
        expect(within(newListContainer).getByText('GPT-3.5')).toBeInTheDocument(); // Experimental shown (using rendered name)
    });

  test('calls updateSearchFilter when search input changes', () => {
    render(<ModelDropdown />);
    // Use description text for unique targeting
    const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
    fireEvent.click(selectedModelDisplay); // Open dropdown

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'clau' } });

    expect(mockUpdateSearchFilter).toHaveBeenCalledTimes(1);
    expect(mockUpdateSearchFilter).toHaveBeenCalledWith('clau');
  });

    test('displays "No models found matching..." message when search yields no results', () => {
        // Simulate a state where search term doesn't match anything
        mockState.processedModels = { Chat: {}, Image: {}, Embedding: {} }; // Empty data for simplicity
        // First render to get unmount
        const { unmount } = render(<ModelDropdown />); 
        // Use description text for unique targeting
        const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        // Simulate search input change that calls the filter update
        const searchInput = screen.getByPlaceholderText('Search models...');
        fireEvent.change(searchInput, { target: { value: 'nomatch' } });
        // Manually trigger filter update for the test (component does this internally)
        act(() => {
          mockUpdateSearchFilter('nomatch');
        });

       // Unmount the previous instance before re-rendering with the empty state
       unmount();
       render(<ModelDropdown />); // Re-render with empty data
       // Use description text for unique targeting again after re-render
       fireEvent.click(screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]')); // Re-open
       fireEvent.change(screen.getByPlaceholderText('Search models...'), { target: { value: 'nomatch' } }); // Set search term in UI

        // Check for the no results message
        expect(screen.getByText(/No models found matching "nomatch"/)).toBeInTheDocument();
        expect(screen.getByText('Clear search')).toBeInTheDocument(); // Clear button should show
    });

    test('calls selectModel and clears search when a model item is clicked', () => {
        render(<ModelDropdown />);
        // Use description text for unique targeting
        const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
        fireEvent.click(selectedModelDisplay); // Open dropdown

        // Find and click 'Claude 3' model item - Use the name rendered by ModelItem
        const claudeModelItem = screen.getByText('Claude 3').closest('div[class*="modelItem"]'); // Find by name, not displayName
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
    // Use description text for unique targeting
    const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
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

    // Open dropdown - Use description text for unique targeting
    const selectedModelDisplay = screen.getByText('OpenAI - Chat').closest('div[class*="selectedModelContainer"]');
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
