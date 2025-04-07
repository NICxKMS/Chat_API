<!-- src/lib/components/common/FileUploader.svelte -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { 
    PaperClipIcon, 
    XMarkIcon, 
    DocumentIcon, 
    PhotoIcon 
  } from 'heroicons-svelte/24/outline';
  
  export let disabled = false;
  export let maxSizeMB = 5;
  export let acceptedTypes = '*'; // e.g. 'image/*,.pdf,.txt'
  
  let fileInput;
  let dragActive = false;
  let selectedFiles = [];
  let errors = [];
  
  const dispatch = createEventDispatcher();
  
  function handleFileChange(event) {
    const files = event.target.files;
    processFiles(files);
  }
  
  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    dragActive = true;
  }
  
  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    dragActive = false;
  }
  
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    dragActive = true;
  }
  
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    dragActive = false;
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processFiles(event.dataTransfer.files);
    }
  }
  
  function clearError(index) {
    errors = errors.filter((_, i) => i !== index);
  }
  
  function removeFile(index) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
    dispatch('change', { files: selectedFiles });
  }
  
  function processFiles(files) {
    if (!files || files.length === 0) return;
    
    errors = [];
    const newFiles = [];
    
    Array.from(files).forEach(file => {
      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        errors = [...errors, `${file.name} is too large (max ${maxSizeMB}MB)`];
        return;
      }
      
      // Add to selected files
      newFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type
      });
    });
    
    selectedFiles = [...selectedFiles, ...newFiles];
    dispatch('change', { files: selectedFiles });
    
    // Reset the input value to allow selecting the same file again
    if (fileInput) fileInput.value = '';
  }
  
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }
  
  function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
      return PhotoIcon;
    } else {
      return DocumentIcon;
    }
  }
  
  // Clean up object URLs when component is destroyed
  onMount(() => {
    return () => {
      selectedFiles.forEach(file => {
        if (file.preview) URL.revokeObjectURL(file.preview);
      });
    };
  });
</script>

<div class="file-uploader">
  <div
    class="flex items-center justify-center w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 {disabled ? 'cursor-not-allowed opacity-50 bg-foreground/10' : dragActive ? 'bg-primary/20' : 'bg-foreground/10 hover:bg-foreground/20'} text-foreground transition-colors"
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    on:dragover={handleDragOver}
    on:drop={handleDrop}
  >
    <label for="file-upload" class="w-full h-full flex items-center justify-center cursor-pointer">
      <PaperClipIcon class="w-5 h-5" />
      <input
        id="file-upload"
        type="file"
        bind:this={fileInput}
        on:change={handleFileChange}
        accept={acceptedTypes}
        multiple
        class="hidden"
        {disabled}
      />
    </label>
  </div>
  
  {#if selectedFiles.length > 0}
    <div class="mt-2 space-y-2">
      {#each selectedFiles as file, i}
        <div class="flex items-center gap-2 p-2 bg-card-bg rounded-md border border-border-primary">
          {#if file.preview}
            <img src={file.preview} alt={file.name} class="w-10 h-10 object-cover rounded" />
          {:else}
            <div class="w-10 h-10 bg-foreground/5 rounded flex items-center justify-center">
              <svelte:component this={getFileIcon(file.type)} class="w-5 h-5 text-foreground/70" />
            </div>
          {/if}
          
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{file.name}</div>
            <div class="text-xs text-foreground/60">{file.size}</div>
          </div>
          
          <button
            type="button"
            on:click={() => removeFile(i)}
            class="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded transition-colors"
            title="Remove file"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
  
  {#if errors.length > 0}
    <div class="mt-2 space-y-1">
      {#each errors as error, i}
        <div class="flex items-center justify-between gap-2 p-2 bg-error/10 text-error text-xs rounded">
          <span>{error}</span>
          <button
            type="button"
            on:click={() => clearError(i)}
            class="p-0.5 hover:bg-error/20 rounded"
          >
            <XMarkIcon class="w-3 h-3" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div> 