// Runtime-agnostic auth interface. Two implementations:
// - AWS Lambda: uses firebase-admin
// - Cloudflare Workers: verifies JWT with Google JWKS via JOSE

export async function createAuth(env, logger, runtime) {
  if (runtime === "aws") {
    const admin = (await import("firebase-admin")).default;
    if (!admin.apps?.length) {
      try { admin.initializeApp(); } catch {}
    }
    return {
      async verifyToken(token) {
        if (!token) return null;
        try {
          const decoded = await admin.auth().verifyIdToken(token);
          return { uid: decoded.uid, email: decoded.email, roles: decoded.roles || [] };
        } catch (e) {
          logger?.warn?.("Token verification failed", { message: e.message });
          return null;
        }
      }
    };
  }

  // Cloudflare Workers path: use JOSE + Google JWKS
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
  const projectId = env.FIREBASE_PROJECT_ID;
  return {
    async verifyToken(token) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, JWKS, {
          issuer: `https://securetoken.google.com/${projectId}`,
          audience: projectId,
        });
        return { uid: payload.user_id, email: payload.email, roles: payload.roles || [] };
      } catch (e) {
        logger?.warn?.("Worker token verification failed", { message: e.message });
        return null;
      }
    }
  };
}


