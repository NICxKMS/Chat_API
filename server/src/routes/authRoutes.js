/**
 * Authentication Routes Plugin
 */
import AuthController from "../controllers/AuthController.js";

// Fastify Plugin function
async function authRoutes (fastify, options) {

  // Login Route
  fastify.post("/login", {
    // Optional: Add schema validation for login request body
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, AuthController.login);

  // Optional: Add routes for registration, token refresh, etc. here

}

export default authRoutes; 