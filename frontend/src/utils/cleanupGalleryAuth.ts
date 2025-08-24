// Cleanup function to remove old gallery authentication data
export const cleanupOldGalleryAuth = () => {
  // Remove old global gallery authentication
  localStorage.removeItem('gallery_event');
  localStorage.removeItem('gallery_token'); // Remove old global token format
  
  // Remove any corrupted or old gallery tokens from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('gallery_token') || key.startsWith('gallery_event'))) {
      // Check if it's an old format token that might be corrupted
      const value = localStorage.getItem(key);
      if (value && (value.length < 100 || !value.includes('.'))) {
        // Token is too short or doesn't contain dots (not a valid JWT)
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    // Silently remove corrupted tokens
  });
  
  // Remove old gallery token from cookies if it exists
  document.cookie = 'gallery_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Also clear session storage
  sessionStorage.removeItem('gallery_event');
  sessionStorage.removeItem('gallery_token');
};