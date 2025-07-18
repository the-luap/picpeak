// Cleanup function to remove old gallery authentication data
export const cleanupOldGalleryAuth = () => {
  // Remove old global gallery authentication
  localStorage.removeItem('gallery_event');
  
  // Remove old gallery token from cookies if it exists
  document.cookie = 'gallery_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};