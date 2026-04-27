import React from 'react';
import { Skeleton, SkeletonGalleryGrid } from '../common';

/**
 * Loading placeholder shown while a gallery is resolving (slug → info →
 * auto-login → photos). Used by GalleryPage during the pre-photos phases and
 * by GalleryView while the photos query runs, so the visitor sees one
 * continuous skeleton instead of multiple full-page interstitials (#321).
 */
export const GallerySkeleton: React.FC = () => (
  <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background, #fafafa)' }}>
    <header className="bg-surface border-b border-surface sticky top-0 z-40">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton height={32} width={200} className="mb-2" />
            <Skeleton height={20} width={300} />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton height={40} width={120} />
            <Skeleton height={40} width={100} />
          </div>
        </div>
      </div>
    </header>
    <div className="container mt-6">
      <Skeleton height={80} className="mb-6" />
      <SkeletonGalleryGrid count={12} />
    </div>
  </div>
);
