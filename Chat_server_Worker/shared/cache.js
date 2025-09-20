// Simple in-memory cache with TTL; Workers-compatible.

const store = new Map();

export function isEnabled(env) {
  const val = (env?.CACHE_ENABLED ?? (typeof process !== "undefined" ? process.env.CACHE_ENABLED : undefined));
  return val !== "false";
}

export function get(key) {
  const it = store.get(key);
  if (!it) return null;
  if (it.expiry && it.expiry < Date.now()) {
    store.delete(key);
    return null;
  }
  return it.value;
}

export function set(key, value, ttlSeconds = 300) {
  store.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
}

export async function getOrSet(key, factory, ttlSeconds = 300) {
  const cached = get(key);
  if (cached !== null && cached !== undefined) return cached;
  const val = await factory();
  if (val !== null && val !== undefined) set(key, val, ttlSeconds);
  return val;
}

export function generateKey(obj) {
  if (typeof obj !== "object" || obj === null) return String(obj);
  const normalized = JSON.stringify(obj);
  // Basic hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash |= 0;
  }
  return `h${hash}`;
}


