import { writable, derived } from 'svelte/store';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '$lib/firebase';

// Initial auth state
const initialState = {
  user: null,
  loading: true,
  error: null,
  anonymousMode: false
};

// Create the main auth store
const createAuthStore = () => {
  // Check for saved anonymous mode preference
  let savedAnonymousMode = false;
  if (typeof window !== 'undefined') {
    try {
      const savedPref = localStorage.getItem('anonymousMode');
      if (savedPref) {
        savedAnonymousMode = JSON.parse(savedPref);
      }
    } catch (error) {
      console.error('Error loading anonymous mode preference:', error);
    }
  }
  
  const { subscribe, set, update } = writable({
    ...initialState,
    anonymousMode: savedAnonymousMode
  });

  // Set up the auth state listener when the store is first used
  let unsubscribe;
  
  function startAuthListener() {
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          // User is signed in
          set({
            user: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            },
            loading: false,
            error: null
          });
        } else {
          // User is signed out
          set({
            user: null,
            loading: false,
            error: null
          });
        }
      },
      (error) => {
        // Handle auth state errors
        update(state => ({ ...state, error: error.message, loading: false }));
      }
    );
  }

  // Initialize the auth listener
  startAuthListener();

  return {
    subscribe,
    
    // Sign up with email and password
    signUp: async (email, password, displayName) => {
      try {
        update(state => ({ ...state, loading: true, error: null }));
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Set the user's display name
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
        
        return userCredential.user;
      } catch (error) {
        update(state => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },
    
    // Sign in with email and password
    signIn: async (email, password) => {
      try {
        update(state => ({ ...state, loading: true, error: null }));
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
      } catch (error) {
        update(state => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },
    
    // Sign out
    signOut: async () => {
      try {
        update(state => ({ ...state, loading: true, error: null }));
        await signOut(auth);
      } catch (error) {
        update(state => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },
    
    // Reset password
    resetPassword: async (email) => {
      try {
        update(state => ({ ...state, loading: true, error: null }));
        await sendPasswordResetEmail(auth, email);
        update(state => ({ ...state, loading: false }));
        return true;
      } catch (error) {
        update(state => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },
    
    // Clear any auth errors
    clearError: () => {
      update(state => ({ ...state, error: null }));
    },
    
    // Toggle anonymous mode
    setAnonymousMode: (enabled) => {
      update(state => {
        // Save the preference
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('anonymousMode', JSON.stringify(enabled));
          } catch (error) {
            console.error('Error saving anonymous mode preference:', error);
          }
        }
        
        return { ...state, anonymousMode: enabled };
      });
    },
    
    // Get an anonymous user profile
    getAnonymousUser: () => {
      return {
        uid: 'anonymous-' + Math.random().toString(36).substring(2, 9),
        email: 'anonymous@user.local',
        displayName: 'Anonymous User',
        isAnonymous: true
      };
    },

    // Cleanup function to unsubscribe from the auth listener
    destroy: () => {
      if (unsubscribe) {
        unsubscribe();
      }
    }
  };
};

// Create and export the auth store
export const authStore = createAuthStore();

// Derived store for the user
export const user = derived(
  authStore,
  $authStore => $authStore.user
);

// Derived store for the authentication loading state
export const isLoading = derived(
  authStore,
  $authStore => $authStore.loading
);

// Derived store for the authentication error
export const authError = derived(
  authStore,
  $authStore => $authStore.error
);

// Derived store to check if the user is authenticated
export const isAuthenticated = derived(
  authStore,
  $authStore => (!!$authStore.user && !$authStore.loading) || $authStore.anonymousMode
);

// Check if currently in anonymous mode
export const isAnonymousMode = derived(
  authStore,
  $authStore => $authStore.anonymousMode
);

// Get effective user (real user or anonymous)
export const effectiveUser = derived(
  authStore,
  $authStore => {
    if ($authStore.user) return $authStore.user;
    if ($authStore.anonymousMode) {
      const authStoreValue = $authStore;
      const getAnonymousUser = createAuthStore().getAnonymousUser;
      return getAnonymousUser();
    }
    return null;
  }
);