// backend/src/services/gallery.service.ts

export async function getGalleryForUser(galleryId: string, userId: string, isPreview: boolean = false) {
  const gallery = await Gallery.findById(galleryId);
  
  if (!gallery) {
    throw new NotFoundError('Gallery Not Found');
  }

  // Allow owner or admin to view draft galleries if preview is requested or user is owner
  const isOwner = gallery.userId.toString() === userId.toString();
  
  if (gallery.status === 'draft' && !isOwner && !isPreview) {
    throw new NotFoundError('Gallery Not Found');
  }

  return gallery;
}