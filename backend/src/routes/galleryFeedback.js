const express = require('express');
const router = express.Router();
const { photoAuth } = require('../middleware/photoAuth');
const { verifyGalleryAccess } = require('../middleware/gallery');
const { feedbackRateLimit, generateGuestIdentifier } = require('../middleware/feedbackRateLimit');
const feedbackService = require('../services/feedbackService');
const feedbackModeration = require('../services/feedbackModeration');
const { db, logActivity } = require('../database/db');
const logger = require('../utils/logger');
const {
  validatePhotoId,
  validateFeedbackSubmission,
  checkValidation,
  validateGuestRequirements
} = require('../utils/feedbackValidation');
const { escapeLikePattern } = require('../utils/sqlSecurity');

// Get feedback settings for a gallery
router.get('/:slug/feedback-settings',
  verifyGalleryAccess,
  async (req, res) => {
    try {
      const event = req.event;
      const settings = await feedbackService.getEventFeedbackSettings(event.id);
      
      // Only send relevant settings to guests
      // Convert SQLite boolean values (0/1) to proper booleans
      const guestSettings = {
        feedback_enabled: Boolean(settings.feedback_enabled),
        allow_ratings: Boolean(settings.allow_ratings),
        allow_likes: Boolean(settings.allow_likes),
        allow_comments: Boolean(settings.allow_comments),
        allow_favorites: Boolean(settings.allow_favorites),
        require_name_email: Boolean(settings.require_name_email),
        show_feedback_to_guests: Boolean(settings.show_feedback_to_guests)
      };
      
      res.json(guestSettings);
    } catch (error) {
      logger.error('Error getting feedback settings:', error);
      res.status(500).json({ error: 'Failed to get feedback settings' });
    }
  }
);

// Get feedback for a specific photo
router.get('/:slug/photos/:photoId/feedback',
  verifyGalleryAccess,
  validatePhotoId,
  checkValidation,
  async (req, res) => {
    try {
      const { photoId } = req.params;
      const event = req.event;
      const guestIdentifier = generateGuestIdentifier(req);
      
      // Get feedback settings
      const settings = await feedbackService.getEventFeedbackSettings(event.id);
      
      if (!settings.feedback_enabled) {
        return res.status(403).json({ error: 'Feedback is not enabled for this event' });
      }
      
      // Verify photo belongs to event
      const photo = await db('photos')
        .where({ id: photoId, event_id: event.id })
        .first();
      
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      // Get feedback based on settings
      const options = {
        approved_only: true,
        include_hidden: false
      };
      
      // Include guest's own feedback even if not approved
      const feedback = await feedbackService.getPhotoFeedback(photoId, options);
      
      // Get guest's own feedback separately
      const guestFeedback = await feedbackService.getPhotoFeedback(photoId, {
        guest_identifier: guestIdentifier
      });
      
      // Combine and deduplicate
      const allFeedback = [...feedback];
      guestFeedback.forEach(gf => {
        if (!feedback.find(f => f.id === gf.id)) {
          allFeedback.push({ ...gf, is_mine: true });
        } else {
          const index = allFeedback.findIndex(f => f.id === gf.id);
          allFeedback[index].is_mine = true;
        }
      });
      
      // Filter based on what guests should see
      const visibleFeedback = settings.show_feedback_to_guests ? allFeedback : 
        allFeedback.filter(f => f.is_mine);
      
      res.json({
        feedback: visibleFeedback,
        summary: {
          average_rating: photo.average_rating || 0,
          total_ratings: await db('photo_feedback')
            .where({ photo_id: photoId, feedback_type: 'rating', is_hidden: false })
            .count('id as count')
            .first()
            .then(r => r.count),
          like_count: photo.like_count || 0,
          favorite_count: photo.favorite_count || 0,
          comment_count: await db('photo_feedback')
            .where({ 
              photo_id: photoId, 
              feedback_type: 'comment', 
              is_approved: true,
              is_hidden: false 
            })
            .count('id as count')
            .first()
            .then(r => r.count)
        },
        my_feedback: {
          rating: guestFeedback.find(f => f.feedback_type === 'rating')?.rating,
          liked: !!guestFeedback.find(f => f.feedback_type === 'like'),
          favorited: !!guestFeedback.find(f => f.feedback_type === 'favorite')
        }
      });
    } catch (error) {
      logger.error('Error getting photo feedback:', error);
      res.status(500).json({ error: 'Failed to get feedback' });
    }
  }
);

// Submit feedback for a photo
router.post('/:slug/photos/:photoId/feedback',
  verifyGalleryAccess,
  validatePhotoId,
  validateFeedbackSubmission,
  checkValidation,
  async (req, res) => {
    try {
      const { photoId } = req.params;
      const event = req.event;
      const guestIdentifier = generateGuestIdentifier(req);
      
      // Get feedback settings
      const settings = await feedbackService.getEventFeedbackSettings(event.id);
      
      if (!settings.feedback_enabled) {
        return res.status(403).json({ error: 'Feedback is not enabled for this event' });
      }
      
      // Check if specific feedback type is allowed
      const feedbackType = req.body.feedback_type;
      const typeAllowed = {
        rating: settings.allow_ratings,
        like: settings.allow_likes,
        comment: settings.allow_comments,
        favorite: settings.allow_favorites
      };
      
      if (!typeAllowed[feedbackType]) {
        return res.status(403).json({ error: `${feedbackType} feedback is not enabled` });
      }
      
      // Verify photo belongs to event
      const photo = await db('photos')
        .where({ id: photoId, event_id: event.id })
        .first();
      
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      // Validate guest requirements
      const guestValidation = await validateGuestRequirements(settings, req.body);
      if (!guestValidation.valid) {
        return res.status(400).json({ 
          error: 'Guest information required',
          errors: guestValidation.errors 
        });
      }
      
      // Apply rate limiting based on feedback type
      const rateLimitMiddleware = feedbackRateLimit(feedbackType);
      await new Promise((resolve, reject) => {
        rateLimitMiddleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // If we got here and response was sent (rate limited), return
      if (res.headersSent) return;
      
      // Prepare feedback data
      const feedbackData = {
        feedback_type: feedbackType,
        rating: req.body.rating,
        comment_text: req.body.comment_text,
        guest_name: req.body.guest_name,
        guest_email: req.body.guest_email,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        moderate_comments: settings.moderate_comments
      };
      
      // For comments, check moderation
      if (feedbackType === 'comment') {
        // Check user reputation
        const reputation = await feedbackModeration.checkUserReputation(guestIdentifier, event.id);
        
        // Moderate the comment
        const moderationResult = await feedbackModeration.moderateText(req.body.comment_text);
        
        if (!moderationResult.approved) {
          // Still save but mark as not approved
          feedbackData.is_approved = false;
          logger.warn('Comment flagged for moderation:', {
            reason: moderationResult.reason,
            violations: moderationResult.violations
          });
        } else if (reputation.autoApprove) {
          // Trusted user, auto-approve
          feedbackData.is_approved = true;
        } else if (settings.moderate_comments) {
          // Default moderation setting
          feedbackData.is_approved = false;
        }
      }
      
      // Submit feedback
      const result = await feedbackService.submitFeedback(
        photoId,
        event.id,
        feedbackData,
        guestIdentifier
      );
      
      // Log activity
      await logActivity(`guest_feedback_${feedbackType}`, {
        photo_id: photoId,
        result
      }, event.id, {
        type: 'guest',
        id: guestIdentifier.substring(0, 16),
        name: req.body.guest_name || 'Anonymous'
      });
      
      res.json({
        success: true,
        ...result,
        message: feedbackType === 'comment' && !feedbackData.is_approved ? 
          'Your comment has been submitted for moderation' : undefined
      });
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }
);

// Get feedback summary for entire gallery
router.get('/:slug/feedback-summary',
  verifyGalleryAccess,
  async (req, res) => {
    try {
      const event = req.event;
      
      // Get feedback settings
      const settings = await feedbackService.getEventFeedbackSettings(event.id);
      
      if (!settings.feedback_enabled || !settings.show_feedback_to_guests) {
        return res.json({
          enabled: false,
          summary: null
        });
      }
      
      const summary = await feedbackService.getEventFeedbackSummary(event.id);
      
      // Filter data based on what guests should see
      const guestSummary = {
        stats: summary.stats,
        top_rated: summary.photos
          .filter(p => p.average_rating > 0)
          .slice(0, 5)
          .map(p => ({
            id: p.id,
            filename: p.filename,
            average_rating: p.average_rating,
            like_count: p.like_count
          }))
      };
      
      res.json({
        enabled: true,
        settings: {
          allow_ratings: settings.allow_ratings,
          allow_likes: settings.allow_likes,
          allow_comments: settings.allow_comments,
          allow_favorites: settings.allow_favorites
        },
        summary: guestSummary
      });
    } catch (error) {
      logger.error('Error getting feedback summary:', error);
      res.status(500).json({ error: 'Failed to get feedback summary' });
    }
  }
);

// Get user's own feedback for all photos
router.get('/:slug/my-feedback',
  verifyGalleryAccess,
  async (req, res) => {
    try {
      const event = req.event;
      const guestIdentifier = generateGuestIdentifier(req);
      
      const myFeedback = await db('photo_feedback')
        .join('photos', 'photo_feedback.photo_id', 'photos.id')
        .where('photo_feedback.event_id', event.id)
        .where('photo_feedback.guest_identifier', guestIdentifier)
        .select(
          'photo_feedback.*',
          'photos.filename',
          'photos.path'
        )
        .orderBy('photo_feedback.created_at', 'desc');
      
      res.json(myFeedback);
    } catch (error) {
      logger.error('Error getting user feedback:', error);
      res.status(500).json({ error: 'Failed to get your feedback' });
    }
  }
);

module.exports = router;