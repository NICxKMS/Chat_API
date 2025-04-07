<!-- src/lib/components/auth/LoginModal.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { auth } from '$lib/firebase/firebase.js'; // Firebase auth instance
  
  // Import Firebase providers directly
  import { GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';

  // We'll dynamically import firebaseui only in the browser
  let firebaseui;

  /**
   * Callback function to close the modal.
   * @type {() => void}
   */
  export let onClose = () => {};

  let uiInstance = null;
  const uiContainerId = 'firebaseui-auth-container';

  onMount(async () => {
    if (!browser || !auth) return; // Only run in browser with auth initialized

    // Dynamically import firebaseui only in the browser
    try {
      firebaseui = await import('firebaseui');
      await import('firebaseui/dist/firebaseui.css');
    } catch (e) {
      console.error('Error importing firebaseui:', e);
      return;
    }

    // FirebaseUI config.
    const uiConfig = {
      signInSuccessUrl: '/', // Where to redirect on successful sign-in (can be current page)
      signInOptions: [
        // List of OAuth providers supported.
        GoogleAuthProvider.PROVIDER_ID,
        // Add other providers like:
        // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
        // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
        // firebase.auth.GithubAuthProvider.PROVIDER_ID,
        EmailAuthProvider.PROVIDER_ID,
        // firebase.auth.PhoneAuthProvider.PROVIDER_ID, // Requires reCAPTCHA config
        // firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
      ],
      // Required to enable one-tap sign-up credential helper.
      credentialHelper: firebaseui.auth.CredentialHelper.GOOGLE_YOLO,
      // Other config options...
      // tosUrl: '<your-tos-url>',
      // privacyPolicyUrl: '<your-privacy-policy-url>',
      callbacks: {
        signInSuccessWithAuthResult: function(authResult, redirectUrl) {
          // User successfully signed in.
          // Return type determines whether we continue the redirect automatically
          // or whether we leave that to developer to handle.
          console.log('FirebaseUI sign-in success:', authResult);
          onClose(); // Close the modal on success
          return false; // Do not automatically redirect, authStore listener will handle state
        },
        uiShown: function() {
          // The widget is rendered.
          // Hide the loader. Optional.
          // document.getElementById('loader').style.display = 'none';
          console.log('FirebaseUI shown');
        },
        signInFailure: function(error) {
             // For merge conflicts, the error.code will be
             // 'firebaseui/anonymous-upgrade-merge-conflict'.
             if (error.code == 'firebaseui/anonymous-upgrade-merge-conflict') {
               alert('Merge conflict error. Please try signing in again.');
             }
             // Handle other errors.
             console.error('FirebaseUI sign-in error:', error);
             // Optionally show error message to user
        }
      },
      // Will use popup for IDP Providers sign-in flow instead of the default, redirect.
      signInFlow: 'popup', // Use 'popup' to avoid page reload within modal context
    };

    // Initialize the FirebaseUI Widget using Firebase.
    // Check if an instance already exists - avoids double initialization on HMR
    uiInstance = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);

    // The start method will wait until the DOM is loaded.
    uiInstance.start(`#${uiContainerId}`, uiConfig);

  }); // End onMount

  onDestroy(() => {
     if (browser && uiInstance) {
       // Cleanup FirebaseUI instance to avoid memory leaks
       try {
         uiInstance.delete();
         console.log('FirebaseUI instance deleted.');
       } catch (e) {
         console.error('Error deleting FirebaseUI instance:', e);
       }
     }
  });

  // Function to handle closing modal via background click
  const handleBackgroundClick = (event) => {
    // Check if the click was directly on the background div
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

</script>

<div
  class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
  on:click={handleBackgroundClick}
  on:keydown={(e) => e.key === 'Escape' && onClose()}
  role="dialog"
  aria-modal="true"
  aria-labelledby="login-title"
  tabindex="-1"
>
  <div 
    class="bg-card-bg p-6 sm:p-8 rounded-lg shadow-xl border border-border-primary text-foreground w-full max-w-md relative"
    on:click|stopPropagation
    role="document"
  >
     <button
        on:click={onClose}
        class="absolute top-3 right-3 text-foreground/50 hover:text-foreground transition-colors"
        aria-label="Close login panel"
     >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
     </button>

    <h2 id="login-title" class="text-xl font-semibold mb-6 text-center">Login / Sign Up</h2>
    <!-- Container where the FirebaseUI widget will be rendered -->
    <div id="{uiContainerId}">
       <!-- Optional: Add a simple loader here -->
       <p class="text-center text-foreground-secondary">Loading login options...</p>
    </div>
  </div>
</div>

<style>
  /* Override default FirebaseUI button styles if needed */
  :global(.firebaseui-idp-button) {
    max-width: 220px; /* Example override */
    margin: 0.5rem auto !important;
  }
  /* Add more global overrides as necessary */
</style> 