<!-- src/lib/components/common/VoiceInput.svelte -->
<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { MicrophoneIcon, XMarkIcon } from 'heroicons-svelte/24/outline';
  import { MicrophoneIcon as MicrophoneSolidIcon } from 'heroicons-svelte/24/solid';

  export let disabled = false;

  let isSupported = false;
  let isListening = false;
  let recognitionEngine;
  let interimResult = '';
  let errorMessage = '';

  const dispatch = createEventDispatcher();

  onMount(() => {
    if (!browser) return;
    
    // Check if browser supports speech recognition
    isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    
    if (!isSupported) {
      errorMessage = 'Speech recognition is not supported in your browser.';
      return;
    }
    
    // Create speech recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionEngine = new SpeechRecognition();
    
    // Configure recognition
    recognitionEngine.continuous = true;
    recognitionEngine.interimResults = true;
    recognitionEngine.lang = 'en-US'; // Could make this configurable
    
    // Handle results
    recognitionEngine.onresult = (event) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript;
      const isFinal = event.results[resultIndex].isFinal;
      
      if (isFinal) {
        // Dispatch final transcript to parent
        dispatch('result', transcript);
        interimResult = '';
      } else {
        // Update interim result
        interimResult = transcript;
      }
    };
    
    // Handle errors
    recognitionEngine.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      errorMessage = `Error: ${event.error}`;
      stopListening();
    };
    
    // Handle when recognition ends
    recognitionEngine.onend = () => {
      isListening = false;
    };
  });
  
  onDestroy(() => {
    if (recognitionEngine && isListening) {
      recognitionEngine.stop();
    }
  });
  
  function toggleListening() {
    if (disabled || !isSupported) return;
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }
  
  function startListening() {
    errorMessage = '';
    try {
      recognitionEngine.start();
      isListening = true;
    } catch (error) {
      console.error('Speech recognition start error:', error);
      errorMessage = 'Failed to start listening. Please try again.';
    }
  }
  
  function stopListening() {
    if (!isListening) return;
    
    try {
      recognitionEngine.stop();
      isListening = false;
      interimResult = '';
    } catch (error) {
      console.error('Speech recognition stop error:', error);
    }
  }
</script>

<div class="relative">
  <button
    on:click={toggleListening}
    class="flex items-center justify-center w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 {disabled || !isSupported ? 'cursor-not-allowed opacity-50 bg-foreground/10' : isListening ? 'bg-primary text-primary-text animate-pulse' : 'bg-foreground/10 hover:bg-foreground/20 text-foreground'}"
    disabled={disabled || !isSupported}
    title={!isSupported ? 'Speech recognition not supported' : isListening ? 'Stop listening' : 'Start voice input'}
    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
  >
    {#if isListening}
      <MicrophoneSolidIcon class="w-5 h-5" />
    {:else}
      <MicrophoneIcon class="w-5 h-5" />
    {/if}
  </button>
  
  {#if isListening}
    <div class="absolute bottom-full mb-2 right-0 bg-card-bg border border-border-primary rounded-lg shadow-md p-2 min-w-[200px]">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-medium">Listening...</span>
        <button 
          on:click={stopListening}
          class="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded transition-colors"
          aria-label="Stop listening"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
      <div class="text-sm min-h-[20px] max-w-[300px] whitespace-pre-wrap">
        {#if interimResult}
          <span class="italic text-foreground/70">{interimResult}</span>
        {:else}
          <span class="text-foreground/40 italic">Speak now...</span>
        {/if}
      </div>
    </div>
  {/if}
  
  {#if errorMessage}
    <div class="absolute bottom-full mb-2 right-0 bg-error/10 text-error border border-error/20 rounded-lg p-2 text-xs">
      {errorMessage}
    </div>
  {/if}
</div> 