import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackService } from '../../services/feedback.service';
import { toast } from 'react-toastify';

interface PhotoRatingProps {
  photoId: string;
  gallerySlug: string;
  currentRating?: number;
  averageRating?: number;
  totalRatings?: number;
  isEnabled: boolean;
  onRatingChange?: (rating: number) => void;
}

export const PhotoRating: React.FC<PhotoRatingProps> = ({
  photoId,
  gallerySlug,
  currentRating = 0,
  averageRating = 0,
  totalRatings = 0,
  isEnabled,
  onRatingChange
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRatingMutation = useMutation({
    mutationFn: (rating: number) => 
      feedbackService.submitFeedback(gallerySlug, photoId, {
        feedback_type: 'rating',
        rating
      }),
    onMutate: async (rating) => {
      setIsSubmitting(true);
      // Optimistic update
      if (onRatingChange) {
        onRatingChange(rating);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-feedback', gallerySlug, photoId] });
      toast.success(t('feedback.ratingSubmitted', 'Rating submitted'));
    },
    onError: (error: any) => {
      // Revert optimistic update
      if (onRatingChange && currentRating) {
        onRatingChange(currentRating);
      }
      if (error.response?.status === 429) {
        toast.error(t('feedback.rateLimited', 'Please wait before rating again'));
      } else {
        toast.error(t('feedback.ratingError', 'Failed to submit rating'));
      }
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const handleRatingClick = (rating: number) => {
    if (!isEnabled || isSubmitting) return;
    
    // If clicking the same rating, remove it
    const newRating = rating === currentRating ? 0 : rating;
    submitRatingMutation.mutate(newRating);
  };

  if (!isEnabled) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Star Rating Input */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRatingClick(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            disabled={isSubmitting}
            className={`p-1 transition-all ${
              isSubmitting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
            }`}
            aria-label={t('feedback.rateStar', 'Rate {{count}} stars', { count: star })}
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (hoveredRating || currentRating)
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'text-neutral-300 hover:text-yellow-400'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Average Rating Display */}
      {totalRatings > 0 && (
        <div className="text-sm text-neutral-600">
          <span className="font-medium">{averageRating.toFixed(1)}</span>
          <span className="text-neutral-400 ml-1">
            ({t('feedback.ratingsCount', '{{count}} ratings', { count: totalRatings })})
          </span>
        </div>
      )}
    </div>
  );
};