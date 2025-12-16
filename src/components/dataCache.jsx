/**
 * Session storage cache utilities for user-specific data
 * Helps avoid unnecessary API calls by caching data per session
 */

const CACHE_PREFIX = 'wp_cloud_hub_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get data from session storage cache
 */
export function getCachedData(key, userId) {
  if (!userId) return null;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${userId}_${key}`;
    const cached = sessionStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - timestamp > CACHE_DURATION) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
}

/**
 * Save data to session storage cache
 */
export function setCachedData(key, userId, data) {
  if (!userId) return;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${userId}_${key}`;
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

/**
 * Invalidate specific cache key
 */
export function invalidateCache(key, userId) {
  if (!userId) return;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${userId}_${key}`;
    sessionStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

/**
 * Clear all cached data for a user
 */
export function clearUserCache(userId) {
  if (!userId) return;
  
  try {
    const keys = Object.keys(sessionStorage);
    const userPrefix = `${CACHE_PREFIX}${userId}_`;
    
    keys.forEach(key => {
      if (key.startsWith(userPrefix)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing user cache:', error);
  }
}

/**
 * Clear all app caches (on logout)
 */
export function clearAllCache() {
  try {
    const keys = Object.keys(sessionStorage);
    
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}