import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { auth } from '$lib/firebase/firebase.js'; // Import auth instance
import { onAuthStateChanged, signOut } from 'firebase/auth';

// --- Internal Writable Stores ---

// Stores the raw Firebase user object
const user = writable(null);
// Stores the Firebase ID token
const idToken = writable(null);
// Tracks loading state during initial auth check and token refresh
const loading = writable(true);
// Stores any authentication error
const error = writable(null);
// Controls the visibility of a login UI (e.g., modal)
const isLoggingIn = writable(false);

// --- Store Setup (runs once when module loads) ---

// Set up the onAuthStateChanged listener only in the browser
if (browser && auth) {
    console.log("Setting up Firebase onAuthStateChanged listener for store.");
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            console.log("Auth state changed: User signed in.");
            user.set(firebaseUser);
            try {
                // Force refresh false by default
                const token = await firebaseUser.getIdToken();
                idToken.set(token);
                error.set(null);
                isLoggingIn.set(false); // Close login UI if open
                console.log("ID token obtained.");
            } catch (err) {
                console.error("Failed to get ID token:", err);
                error.set("Failed to get authentication token.");
                idToken.set(null);
                // Aggressively sign out if token fetch fails
                try { await signOut(auth); } catch (signOutErr) { console.error("Sign out after token fail failed:", signOutErr); }
            }
        } else {
            console.log("Auth state changed: User signed out.");
            user.set(null);
            idToken.set(null);
            isLoggingIn.set(false); // Close login UI if open
        }
        // Initial load complete once auth state is determined
        loading.set(false);
    }, (authError) => {
        // Handle errors during listener setup or operation
        console.error("Auth state listener error:", authError);
        error.set(authError.message || "Authentication listener failed.");
        user.set(null);
        idToken.set(null);
        loading.set(false);
        isLoggingIn.set(false);
    });
} else {
    // If on server or Firebase auth didn't initialize, stop loading
    if (!browser) console.log("Auth store: Not in browser, skipping listener setup.");
    if (!auth) console.warn("Auth store: Firebase auth service not available.");
    loading.set(false);
}

// --- Actions ---

// Function to trigger the login UI
const login = () => {
    console.log("Login action triggered, showing login UI.");
    isLoggingIn.set(true);
};

// Function to sign the user out
const logout = async () => {
    if (!auth) {
        error.set("Firebase not initialized.");
        console.error("Logout failed: Firebase not initialized.");
        return;
    }
    console.log("Logout action triggered.");
    try {
        await signOut(auth);
        // Listener will handle setting user/token to null
        console.log("Sign out successful via action.");
    } catch (err) {
        console.error("Logout action failed:", err);
        error.set(err.message || "Failed to logout.");
    }
};

// --- Derived Store for Public Interface ---

// Combine internal stores and actions into a single derived store for easy consumption
const authStore = derived(
    [user, idToken, loading, error, isLoggingIn],
    ([$user, $idToken, $loading, $error, $isLoggingIn]) => ({
        currentUser: $user,
        idToken: $idToken,
        loading: $loading,
        error: $error,
        isLoggingIn: $isLoggingIn,
        isAuthenticated: !!$user && !!$idToken, // Derived boolean

        // Actions
        login,
        logout,
        closeLoginModal: () => isLoggingIn.set(false) // Allow UI to close itself
    })
);

export default authStore; 