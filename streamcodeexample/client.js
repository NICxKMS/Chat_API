// client.js - Simplified with direct fetch
const statusElement = document.getElementById('status');
const outputElement = document.getElementById('output');

// Add UI helper functions
function updateStatus(message, isError = false) {
  statusElement.textContent = message;
  if (isError) {
    statusElement.classList.add('error');
  } else {
    statusElement.classList.remove('error');
  }
}

function showEndpoints() {
  const endpointSelector = document.createElement('div');
  endpointSelector.id = 'endpoint-selector';
  endpointSelector.classList.add('endpoint-selector');
  
  const endpoints = [
    { id: 'simple-stream', name: 'Simple Stream', description: 'Basic line-by-line streaming' },
    { id: 'object-stream', name: 'Object Stream', description: 'JSON object streaming' },
    { id: 'file-stream', name: 'File Stream', description: 'File content streaming' },
    { id: 'openai-stream', name: 'Character Stream', description: 'Character-by-character streaming' },
    { id: 'openai-4o-mini-stream', name: 'OpenAI GPT-4o-mini', description: 'Real AI streaming from OpenAI' },
    { id: 'manual-stream', name: 'Manual Stream', description: 'Alternative character streaming' },
    { id: 'pipeline-stream', name: 'Pipeline Stream', description: 'Word-by-word with Node.js pipeline' },
    { id: 'api/swapi-stream', name: 'SWAPI Stream', description: 'Star Wars API data' },
    { id: 'test', name: 'Test Endpoint', description: 'Simple JSON response' }
  ];
  
  // Create buttons for each endpoint
  endpoints.forEach(endpoint => {
    const button = document.createElement('button');
    button.textContent = endpoint.name;
    button.title = endpoint.description;
    button.dataset.endpoint = endpoint.id; // Store endpoint ID in data attribute
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      document.querySelectorAll('#endpoint-selector button').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add active class to this button
      button.classList.add('active');
      
      // Show prompt input for OpenAI endpoint
      const promptContainer = document.getElementById('prompt-container');
      if (endpoint.id === 'openai-4o-mini-stream') {
        promptContainer.style.display = 'block';
      } else {
        promptContainer.style.display = 'none';
        updateStatus(`Connecting to ${endpoint.name}...`);
        fetchContent(endpoint.id);
      }
    });
    endpointSelector.appendChild(button);
  });
  
  // Insert before the output element
  outputElement.parentNode.insertBefore(endpointSelector, outputElement);
  
  // Add prompt input for OpenAI
  const promptContainer = document.createElement('div');
  promptContainer.id = 'prompt-container';
  promptContainer.style.display = 'none';
  promptContainer.innerHTML = `
    <div class="prompt-input">
      <textarea id="prompt-text" placeholder="Enter your prompt for GPT-4o-mini...">Explain how streaming data works in web applications.</textarea>
      <button id="send-prompt">Send to OpenAI</button>
    </div>
  `;
  
  // Insert after endpoint selector
  endpointSelector.parentNode.insertBefore(promptContainer, endpointSelector.nextSibling);
  
  // Add event listener for the send prompt button
  document.getElementById('send-prompt').addEventListener('click', () => {
    const promptText = document.getElementById('prompt-text').value.trim();
    if (promptText) {
      updateStatus(`Sending prompt to OpenAI...`);
      fetchContent('openai-4o-mini-stream', { prompt: promptText });
    } else {
      updateStatus(`Please enter a prompt first`, true);
    }
  });
}

// Directly fetch content from an endpoint
async function fetchContent(endpoint = 'test', params = {}) {
  // Clear previous content and show loading state
  outputElement.textContent = '';
  outputElement.classList.add('loading');
  updateStatus(`Requesting from /${endpoint}...`);
  
  try {
    // Construct URL with any parameters
    let url = `http://localhost:4000/${endpoint}`;
    const queryParams = new URLSearchParams({ t: Date.now(), ...params }).toString();
    url = `${url}?${queryParams}`;
    
    console.log(`Starting fetch to ${url}`);
    
    // Very simple direct fetch for non-streaming endpoints
    if (endpoint === 'test') {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      
      const data = await response.json();
      outputElement.textContent = JSON.stringify(data, null, 2);
      outputElement.classList.remove('loading');
      updateStatus('Received JSON response');
      return;
    }
    
    // For streaming endpoints, use different approaches based on browser support
    if ('fetch' in window && 'ReadableStream' in window) {
      // Modern fetch with streaming
      streamWithFetch(endpoint, url);
    } else {
      // Fallback to older XHR for IE and older browsers
      streamWithXHR(endpoint, url);
    }
  } catch (error) {
    console.error('Error:', error);
    updateStatus(`Error: ${error.message}`, true);
    outputElement.classList.remove('loading');
    outputElement.textContent = `Failed to fetch: ${error.message}`;
  }
}

// Stream content using modern fetch API
async function streamWithFetch(endpoint, url) {
  try {
    // Use the streaming fetch API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': endpoint.includes('swapi') || endpoint === 'object-stream' ? 'application/json' : 'text/plain',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    outputElement.classList.remove('loading');
    
    // Get a reader from the response body stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // For JSON object stream, create a container for formatted display
    if (endpoint === 'object-stream') {
      outputElement.innerHTML = '<div class="json-container"></div>';
    }
  
    // Process the stream chunk by chunk
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream complete');
        updateStatus('Stream complete');
        break;
      }
      
      // Decode the chunk and append to buffer
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // Special handling for object-stream
      if (endpoint === 'object-stream') {
        // Process each line (assuming ndjson format)
        handleObjectStreamData(buffer);
      } else {
        // Update the display for text streams
        outputElement.textContent = buffer;
      }
      
      console.log(`Received chunk: ${chunk.length} bytes`);
      updateStatus(`Streaming: ${buffer.length} bytes received`);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    updateStatus(`Streaming error: ${error.message}`, true);
  }
}

// Handle ndjson object stream data
function handleObjectStreamData(data) {
  const container = outputElement.querySelector('.json-container');
  if (!container) return;
  
  // Clear the container initially
  container.innerHTML = '';
  
  // Split the data by newlines and process each JSON object
  const lines = data.split('\n').filter(line => line.trim());
  lines.forEach((line, index) => {
    try {
      const jsonObj = JSON.parse(line);
      
      // Create a card for each object
      const card = document.createElement('div');
      card.className = 'json-card';
      
      // Handle different types of objects
      if (jsonObj.type === 'metadata') {
        card.innerHTML = `<h3>Stream Metadata</h3>
          <p>Total Items: ${jsonObj.totalItems}</p>
          <p>Started: ${new Date(jsonObj.startTime).toLocaleTimeString()}</p>`;
        card.className += ' metadata';
      } else if (jsonObj.type === 'end') {
        card.innerHTML = `<h3>Stream Complete</h3>
          <p>Total Sent: ${jsonObj.totalSent}</p>
          <p>Ended: ${new Date(jsonObj.endTime).toLocaleTimeString()}</p>`;
        card.className += ' end-marker';
      } else {
        // Regular data object
        card.innerHTML = `<h3>${jsonObj.name || 'Item ' + jsonObj.id}</h3>`;
        
        // Add all properties to the card
        const props = document.createElement('dl');
        Object.entries(jsonObj).forEach(([key, value]) => {
          if (key !== 'name') {
            const dt = document.createElement('dt');
            dt.textContent = key;
            
            const dd = document.createElement('dd');
            dd.textContent = typeof value === 'object' ? JSON.stringify(value) : value;
            
            props.appendChild(dt);
            props.appendChild(dd);
          }
        });
        card.appendChild(props);
        
        // Add visual indicator for in-stock status if applicable
        if ('inStock' in jsonObj) {
          card.className += jsonObj.inStock ? ' in-stock' : ' out-of-stock';
        }
      }
      
      // Add to container
      container.appendChild(card);
    } catch (err) {
      console.error('Error parsing JSON:', err, line);
    }
  });
}

// Fallback streaming with XHR for older browsers
function streamWithXHR(endpoint, url) {
  const xhr = new XMLHttpRequest();
  let buffer = '';
  
  // Handle incremental updates
  xhr.onprogress = function() {
    outputElement.classList.remove('loading');
    const newText = xhr.responseText;
    
    if (newText.length > buffer.length) {
      buffer = newText;
      
      // Special handling for object-stream
      if (endpoint === 'object-stream') {
        // Process each line (assuming ndjson format)
        handleObjectStreamData(buffer);
      } else {
        // Text content
        outputElement.textContent = buffer;
      }
      
      console.log(`XHR progress: ${buffer.length} bytes`);
      updateStatus(`Streaming: ${buffer.length} bytes received`);
    }
  };
  
  // Handle completion
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
      updateStatus(`Stream complete: ${xhr.responseText.length} bytes`);
    } else {
      updateStatus(`Error: ${xhr.status} ${xhr.statusText}`, true);
    }
    outputElement.classList.remove('loading');
  };
  
  // Handle errors
  xhr.onerror = function() {
    console.error('XHR error');
    updateStatus('Connection error', true);
    outputElement.classList.remove('loading');
  };
  
  // Open and send the XHR request
  xhr.open('GET', url);
  xhr.send();
  console.log(`XHR request sent to ${url}`);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  console.log('Page loaded');
  
  // Set up retry button
  document.getElementById('retry').addEventListener('click', () => {
    console.log('Retry button clicked');
    const activeButton = document.querySelector('#endpoint-selector button.active');
    
    if (activeButton && activeButton.dataset.endpoint === 'openai-4o-mini-stream') {
      // Get prompt text and retry
      const promptText = document.getElementById('prompt-text').value.trim();
      if (promptText) {
        fetchContent('openai-4o-mini-stream', { prompt: promptText });
      } else {
        updateStatus('Please enter a prompt first', true);
      }
    } else {
      const currentEndpoint = activeButton?.dataset?.endpoint || 'test';
      fetchContent(currentEndpoint);
    }
  });
  
  // Set up clear button
  document.getElementById('clear').addEventListener('click', () => {
    outputElement.textContent = '';
    updateStatus('Output cleared');
  });
  
  // Add endpoint selector UI
  showEndpoints();
  
  // Start with a simple test to verify connectivity
  fetchContent('test');
});