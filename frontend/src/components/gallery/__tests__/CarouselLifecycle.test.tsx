import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Photo } from '../../../types';
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: { gallerySettings: { carouselShowThumbnails: false } } }) }));
vi.mock('../../common', () => ({ AuthenticatedImage: ({ alt }: { alt: string }) => <img alt={alt} />, Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock('../../../contexts/GuestIdentityContext', () => ({ useGuestIdentityOptional: () => null }));
import { CarouselGalleryLayout } from '../layouts/CarouselGalleryLayout';
const photo = (id: number) => ({ id, filename: `photo-${id}`, url: '/photo' } as Photo);
it('keeps the carousel usable when a refetch empties, reorders or removes photos', () => {
  const props = { slug: 'g', onPhotoClick: vi.fn(), onDownload: vi.fn(), photos: [] as Photo[] };
  const { rerender } = render(<CarouselGalleryLayout {...props} />);
  rerender(<CarouselGalleryLayout {...props} photos={[photo(1), photo(2)]} />);
  fireEvent.click(screen.getByLabelText('Next photo')); expect(screen.getByAltText('photo-2')).toBeTruthy();
  rerender(<CarouselGalleryLayout {...props} photos={[photo(2), photo(1)]} />); expect(screen.getByAltText('photo-2')).toBeTruthy();
  rerender(<CarouselGalleryLayout {...props} photos={[photo(1)]} />); expect(screen.getByAltText('photo-1')).toBeTruthy();
  rerender(<CarouselGalleryLayout {...props} photos={[]} />);
  rerender(<CarouselGalleryLayout {...props} photos={[photo(3)]} />); expect(screen.getByAltText('photo-3')).toBeTruthy();
});
