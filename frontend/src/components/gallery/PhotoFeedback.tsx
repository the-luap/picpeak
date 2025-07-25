import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { feedbackService } from '../../services/feedback.service';
import { PhotoRating } from './PhotoRating';
import { PhotoLikes } from './PhotoLikes';
import { PhotoComments } from './PhotoComments';
import { PhotoFavorites } from './PhotoFavorites';
import { Skeleton } from '../common';
import type { FeedbackSettings } from '../../services/feedback.service';

interface PhotoFeedbackProps {
  photoId: string;
  gallerySlug: string;
  className?: string;
  showComments?: boolean;
  onFeedbackUpdate?: () => void;
}

export const PhotoFeedback: React.FC<PhotoFeedbackProps> = ({
  photoId,
  gallerySlug,
  className = '',
  showComments = true,
  onFeedbackUpdate
}) => {
  // Fetch feedback settings for the gallery
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['gallery-feedback-settings', gallerySlug],
    queryFn: () => feedbackService.getGalleryFeedbackSettings(gallerySlug),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch feedback data for the photo
  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['photo-feedback', gallerySlug, photoId],
    queryFn: () => feedbackService.getPhotoFeedback(gallerySlug, photoId),
    enabled: !!settings?.feedback_enabled,
  });

  // Local state for optimistic updates
  const [currentRating, setCurrentRating] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);

  // Update local state when data loads
  useEffect(() => {
    if (feedbackData) {
      setCurrentRating(feedbackData.my_feedback.rating || 0);
      setIsLiked(feedbackData.my_feedback.liked);
      setIsFavorited(feedbackData.my_feedback.favorited);
      setLikeCount(feedbackData.summary.like_count);
      setFavoriteCount(feedbackData.summary.favorite_count);
    }
  }, [feedbackData]);

  // Handle optimistic updates
  const handleRatingChange = (rating: number) => {
    setCurrentRating(rating);
    if (onFeedbackUpdate) onFeedbackUpdate();
  };

  const handleLikeChange = (liked: boolean) => {
    setIsLiked(liked);
    setLikeCount(prev => liked ? prev + 1 : Math.max(0, prev - 1));
    if (onFeedbackUpdate) onFeedbackUpdate();
  };

  const handleFavoriteChange = (favorited: boolean) => {
    setIsFavorited(favorited);
    setFavoriteCount(prev => favorited ? prev + 1 : Math.max(0, prev - 1));
    if (onFeedbackUpdate) onFeedbackUpdate();
  };

  if (settingsLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!settings?.feedback_enabled) {
    return null;
  }

  const hasAnyFeedbackType = settings.allow_ratings || settings.allow_likes || 
                            settings.allow_comments || settings.allow_favorites;

  if (!hasAnyFeedbackType) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Rating Section */}
      {settings.allow_ratings && (
        <PhotoRating
          photoId={photoId}
          gallerySlug={gallerySlug}
          currentRating={currentRating}
          averageRating={feedbackData?.summary.average_rating}
          totalRatings={feedbackData?.summary.total_ratings}
          isEnabled={true}
          onRatingChange={handleRatingChange}
        />
      )}

      {/* Action Buttons */}
      {(settings.allow_likes || settings.allow_favorites) && (
        <div className="flex items-center gap-2">
          {settings.allow_likes && (
            <PhotoLikes
              photoId={photoId}
              gallerySlug={gallerySlug}
              isLiked={isLiked}
              likeCount={likeCount}
              isEnabled={true}
              onLikeChange={handleLikeChange}
            />
          )}
          {settings.allow_favorites && (
            <PhotoFavorites
              photoId={photoId}
              gallerySlug={gallerySlug}
              isFavorited={isFavorited}
              favoriteCount={favoriteCount}
              isEnabled={true}
              onFavoriteChange={handleFavoriteChange}
            />
          )}
        </div>
      )}

      {/* Comments Section */}
      {settings.allow_comments && showComments && (
        <div className="border-t pt-4">
          <PhotoComments
            photoId={photoId}
            gallerySlug={gallerySlug}
            comments={feedbackData?.feedback || []}
            isEnabled={true}
            requireNameEmail={settings.require_name_email || false}
            showToGuests={settings.show_feedback_to_guests || false}
            onCommentAdded={() => {
              if (onFeedbackUpdate) onFeedbackUpdate();
            }}
          />
        </div>
      )}
    </div>
  );
};