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
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Remove old gallery token from cookies if it exists
  document.cookie = 'gallery_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Also clear session storage
  sessionStorage.removeItem('gallery_event');
  sessionStorage.removeItem('gallery_token');
  sessionStorage.removeItem('gallery_active_slug');

  // Remove slug-specific session storage entries as well
  try {
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('gallery_event_') || key.startsWith('gallery_token_'))) {
        sessionKeysToRemove.push(key);
      }
    }

    sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Session storage may be unavailable; ignore cleanup failures
  }
};
