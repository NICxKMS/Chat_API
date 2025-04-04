# Frontend Authentication Guide

This guide explains how to implement frontend authentication to interact with the backend API, which uses Firebase Authentication with ID Tokens.

## Server-Side Authentication Overview (Recap)

*   **Mechanism:** Firebase Authentication (ID Tokens verified by Firebase Admin SDK).
*   **Verification:** An `onRequest` hook (`firebaseAuthHook` in `src/server.js`) automatically runs for all routes under the `/api` prefix.
*   **Hook Logic:**
    *   Checks for an `Authorization: Bearer <idToken>` header.
    *   Verifies the `<idToken>` using the Firebase Admin SDK.
    *   If valid, attaches user info (`uid`, `email`, etc.) to `request.user`.
    *   If invalid/missing, `request.user` remains `null`.
*   **Enforcement:** Currently, the hook *verifies* tokens but individual API routes **do not strictly require** a logged-in user (`request.user` is not checked in most route handlers). Access is generally permitted even without a valid token, though user info won't be available to the handler. Routes *can* be modified later to require `request.user`.

## Frontend Implementation Steps

Here's how to set up your frontend application:

1.  **Install Firebase Client SDK:**
    Add the Firebase client-side SDK to your frontend project.
    ```bash
    # Using npm
    npm install firebase

    # Using yarn
    yarn add firebase
    ```
    Alternatively, you can use the SDK via CDN scripts.

2.  **Initialize Firebase:**
    Initialize Firebase in your frontend code using your Firebase project's **web app configuration**. You can find this in your Firebase project settings (Project Settings > General > Your apps > Web app > SDK setup and configuration). **Do not use your backend service account key here.**

    ```javascript
    import { initializeApp } from "firebase/app";
    import { getAuth } from "firebase/auth";

    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
      // measurementId: "YOUR_MEASUREMENT_ID" // Optional
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);

    // Initialize Firebase Authentication and get a reference to the service
    const auth = getAuth(app);

    export { auth }; // Export auth for use elsewhere
    ```

3.  **Implement User Login/Signup:**
    Use the Firebase Authentication UI libraries or the client SDK's methods (`getAuth`) to handle user sign-up and sign-in flows.

    *Example using Email/Password:*
    ```javascript
    import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

    const auth = getAuth(); // Get auth instance initialized previously

    async function loginUser(email, password) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("User logged in:", userCredential.user);
        // User is signed in.
      } catch (error) {
        console.error("Login error:", error.code, error.message);
      }
    }

    async function signupUser(email, password) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("User signed up:", userCredential.user);
        // User is signed up and signed in.
      } catch (error) {
        console.error("Signup error:", error.code, error.message);
      }
    }
    ```
    You can also easily integrate Google Sign-In, GitHub, etc., using methods like `signInWithPopup` or `signInWithRedirect`.

4.  **Get ID Token for API Calls:**
    Before making *any* request to your backend API (routes starting with `/api/`), you need to get the currently signed-in user's **ID Token**.

    ```javascript
    import { getAuth } from "firebase/auth";

    async function getIdToken() {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        try {
          // Get the current ID token. Firebase SDK handles refresh automatically.
          const idToken = await user.getIdToken();
          return idToken;
        } catch (error) {
          console.error("Error getting ID token:", error);
          return null;
        }
      } else {
        // No user is signed in.
        return null;
      }
    }
    ```
    **Note:** Call `getIdToken()` just before you make the API request to ensure you have a fresh, valid token.

5.  **Attach Token to API Requests:**
    Include the obtained ID token in the `Authorization` header of your fetch/axios requests as a Bearer token.

    *Example using `fetch`:*
    ```javascript
    async function callApiEndpoint(endpoint, method = 'GET', body = null) {
      const idToken = await getIdToken(); // Get current token

      const headers = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header ONLY if a token is available
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      } else {
         console.warn(`Making API call to ${endpoint} without authentication token.`);
         // Depending on backend route configuration, this might still succeed or fail.
      }

      const options = {
        method: method,
        headers: headers,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      try {
        // Prepend '/api' to the endpoint
        const response = await fetch(`/api${endpoint}`, options);

        if (!response.ok) {
          // Handle HTTP errors (e.g., 401 Unauthorized, 404 Not Found, 500 Server Error)
          const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
          console.error(`API Error (${response.status}):`, errorData);
          throw new Error(`HTTP error ${response.status}`);
        }

        // Assuming JSON response, adjust if needed
        return await response.json();
      } catch (error) {
        console.error(`Network or fetch error calling ${endpoint}:`, error);
        throw error; // Re-throw the error for further handling
      }
    }

    // Example usage:
    // const chatResponse = await callApiEndpoint('/chat/completions', 'POST', { model: 'openai/gpt-4', messages: [...] });
    // const providers = await callApiEndpoint('/models/providers'); // Token will be attached if user is logged in
    ```

6.  **Handle Authentication State Changes:**
    Listen for changes in the user's login status to update your UI (e.g., show login/logout buttons, display user info).

    ```javascript
    import { getAuth, onAuthStateChanged } from "firebase/auth";

    const auth = getAuth();

    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        console.log("Auth state changed: User signed in", user.uid);
        // Update UI, maybe fetch user profile, etc.
        // You can get the token here too: user.getIdToken().then(...)
      } else {
        // User is signed out
        console.log("Auth state changed: User signed out");
        // Update UI (e.g., show login form, redirect to login page)
      }
    });
    ```

7.  **Implement Logout:**
    Provide a way for users to sign out.

    ```javascript
    import { getAuth, signOut } from "firebase/auth";

    async function logoutUser() {
      const auth = getAuth();
      try {
        await signOut(auth);
        console.log("User signed out successfully.");
        // Redirect to homepage or login page
      } catch (error) {
        console.error("Sign out error:", error);
      }
    }
    ```

8.  **Error Handling:**
    Be prepared to handle potential `401 Unauthorized` or `403 Forbidden` errors from the API, especially if backend routes are updated in the future to *require* authentication (`request.user` check). Your API calling function should check the response status code.

By following these steps, your frontend can correctly authenticate users via Firebase and securely communicate with the backend API by sending the required ID tokens. 