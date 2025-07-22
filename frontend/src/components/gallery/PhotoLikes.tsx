import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackService } from '../../services/feedback.service';
import { toast } from 'react-toastify';

interface PhotoLikesProps {
  photoId: string;
  gallerySlug: string;
  isLiked: boolean;
  likeCount: number;
  isEnabled: boolean;
  onLikeChange?: (liked: boolean) => void;
}

export const PhotoLikes: React.FC<PhotoLikesProps> = ({
  photoId,
  gallerySlug,
  isLiked,
  likeCount,
  isEnabled,
  onLikeChange
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);

  const submitLikeMutation = useMutation({
    mutationFn: () => 
      feedbackService.submitFeedback(gallerySlug, photoId, {
        feedback_type: 'like'
      }),
    onMutate: async () => {
      setIsSubmitting(true);
      setAnimating(true);
      // Optimistic update
      if (onLikeChange) {
        onLikeChange(!isLiked);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-feedback', gallerySlug, photoId] });
    },
    onError: (error: any) => {
      // Revert optimistic update
      if (onLikeChange) {
        onLikeChange(isLiked);
      }
      if (error.response?.status === 429) {
        toast.error(t('feedback.rateLimited', 'Please wait before liking again'));
      } else {
        toast.error(t('feedback.likeError', 'Failed to update like'));
      }
    },
    onSettled: () => {
      setIsSubmitting(false);
      setTimeout(() => setAnimating(false), 300);
    }
  });

  const handleLikeClick = () => {
    if (!isEnabled || isSubmitting) return;
    submitLikeMutation.mutate();
  };

  if (!isEnabled) return null;

  return (
    <button
      onClick={handleLikeClick}
      disabled={isSubmitting}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        isLiked 
          ? 'bg-red-50 text-red-600 hover:bg-red-100' 
          : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
      } ${isSubmitting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      aria-label={isLiked ? t('feedback.unlike', 'Unlike') : t('feedback.like', 'Like')}
    >
      <Heart
        className={`w-5 h-5 transition-all ${
          animating ? 'scale-125' : 'scale-100'
        } ${
          isLiked ? 'fill-current' : 'group-hover:scale-110'
        }`}
      />
      <span className="text-sm font-medium">
        {likeCount > 0 ? likeCount : ''}
      </span>
    </button>
  );
};