import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

// Time-to-live for cache entries (1 day in milliseconds)
const TTL = 24 * 60 * 60 * 1000;

/**
 * Custom hook to fetch and cache user profile picture with a 1-day TTL.
 * @param {string} imageUrl - The URL to fetch the profile picture from.
 * @returns {{ profilePicture: string | null, loading: boolean, error: any }}
 */
export const useProfilePicture = (imageUrl) => {
  const cacheKey = `profilePicture_${imageUrl}`;
  // cachedEntry is either null, a string (legacy), or { data, timestamp }
  const [cachedEntry, setCachedEntry] = useLocalStorage(cacheKey, null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!imageUrl) {
      // No URL: clear state
      setProfilePicture(null);
      setLoading(false);
      return;
    }

    // Validate cache entry
    let entry = cachedEntry;
    if (entry) {
      // Legacy format: string
      if (typeof entry === 'string') {
        const wrapped = { data: entry, timestamp: Date.now() };
        setCachedEntry(wrapped);
        entry = wrapped;
      }
      // TTL check
      if (
        entry.timestamp &&
        Date.now() - entry.timestamp < TTL &&
        entry.data
      ) {
        setProfilePicture(entry.data);
        setLoading(false);
        return;
      }
      // Expired cache
      setCachedEntry(null);
    }

    // Fetch and cache new image
    setLoading(true);
    fetch(imageUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (!isMounted) return;
        const entryToCache = { data: dataUrl, timestamp: Date.now() };
        setCachedEntry(entryToCache);
        setProfilePicture(dataUrl);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching and caching profile image:', err);
        setError(err);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [imageUrl, cachedEntry, setCachedEntry]);

  return { profilePicture, loading, error };
}; 