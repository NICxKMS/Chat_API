/**
 * Authentication Controller
 * Handles user login and JWT generation.
 */
import logger from "../utils/logger.js";
import bcrypt from "bcrypt";

// IMPORTANT: Replace this with actual user lookup from a database!
// Store HASHED passwords, not plain text.
const MOCK_USER_DB = {
  // Replace "PASTE_HASH_HERE" with the actual hash generated for "password123"
  "testuser": "PASTE_HASH_HERE" 
};
const SALT_ROUNDS = 10; // Store salt rounds used (or use the one embedded in the hash)

class AuthController {

  /**
   * Handles user login.
   * Validates credentials using bcrypt and issues a JWT.
   * @param {FastifyRequest} request
   * @param {FastifyReply} reply
   */
  async login(request, reply) {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.status(400).send({ error: "Username and password are required." });
    }

    // --- Secure Authentication Logic --- 
    // Replace with database lookup
    const storedHash = MOCK_USER_DB[username];
    
    if (!storedHash) {
      // User not found - log generic message to avoid user enumeration
      logger.warn(`Failed login attempt for non-existent user or invalid password: ${username}`);
      return reply.status(401).send({ error: "Invalid credentials." });
    }

    let isValid = false;
    try {
      // Compare submitted password with stored hash
      isValid = await bcrypt.compare(password, storedHash);
    } catch (compareError) {
      logger.error(`Error comparing password hash for user ${username}:`, compareError);
      return reply.status(500).send({ error: "Login failed due to server error." });
    }
    // --- End Authentication Logic --- 

    if (!isValid) {
      logger.warn(`Failed login attempt (invalid password) for user: ${username}`);
      return reply.status(401).send({ error: "Invalid credentials." });
    }

    // User authenticated, generate JWT
    try {
      const userPayload = {
        id: username, // Or use actual user ID from DB
        username: username,
      };

      const token = await reply.jwtSign(userPayload, {
        expiresIn: '1h' // Example: Token expires in 1 hour
      });

      logger.info(`Successful login for user: ${username}`);
      return reply.send({ access_token: token });

    } catch (err) {
      logger.error("Error signing JWT:", err);
      return reply.status(500).send({ error: "Failed to generate token." });
    }
  }
}

export default new AuthController(); 