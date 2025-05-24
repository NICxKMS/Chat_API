export async function fetchWithRetry(input, init = {}, retries = 3, backoff = 500) {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`Network error: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      // Exponential backoff with jitter
      const delay = backoff * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(res => setTimeout(res, delay));
      attempt++;
    }
  }
} 