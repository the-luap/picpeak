const { db, logActivity } = require('../database/db');
const logger = require('../utils/logger');
const { formatBoolean } = require('../utils/dbCompat');

class FeedbackService {
  /**
   * Get feedback settings for an event
   */
  async getEventFeedbackSettings(eventId) {
    try {
      const settings = await db('event_feedback_settings')
        .where('event_id', eventId)
        .first();
      
      if (!settings) {
        // Return default settings if none exist
        return {
          event_id: eventId,
          feedback_enabled: false,
          allow_ratings: true,
          allow_likes: true,
          allow_comments: false,
          allow_favorites: true,
          require_name_email: false,
          moderate_comments: true,
          show_feedback_to_guests: true
        };
      }
      
      return settings;
    } catch (error) {
      logger.error('Error getting feedback settings:', error);
      throw error;
    }
  }

  /**
   * Update feedback settings for an event
   */
  async updateEventFeedbackSettings(eventId, settings) {
    try {
      const existing = await db('event_feedback_settings')
        .where('event_id', eventId)
        .first();
      
      if (existing) {
        await db('event_feedback_settings')
          .where('event_id', eventId)
          .update({
            ...settings,
            updated_at: new Date()
          });
      } else {
        await db('event_feedback_settings').insert({
          event_id: eventId,
          ...settings,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      await logActivity('feedback_settings_updated', settings, eventId);
      
      return this.getEventFeedbackSettings(eventId);
    } catch (error) {
      logger.error('Error updating feedback settings:', error);
      throw error;
    }
  }

  /**
   * Submit feedback for a photo
   */
  async submitFeedback(photoId, eventId, feedbackData, guestIdentifier) {
    try {
      const { feedback_type, rating, comment_text, guest_name, guest_email, ip_address, user_agent } = feedbackData;
      
      // Validate feedback type
      if (!['rating', 'like', 'comment', 'favorite'].includes(feedback_type)) {
        throw new Error('Invalid feedback type');
      }
      
      // Check if similar feedback already exists (prevent duplicates)
      if (feedback_type !== 'comment') {
        const existing = await db('photo_feedback')
          .where({
            photo_id: photoId,
            event_id: eventId,
            feedback_type,
            guest_identifier: guestIdentifier
          })
          .first();
        
        if (existing) {
          if (feedback_type === 'rating' && rating !== existing.rating) {
            // Update existing rating
            await db('photo_feedback')
              .where('id', existing.id)
              .update({
                rating,
                updated_at: new Date()
              });
            
            await this.updatePhotoFeedbackStats(photoId);
            return { id: existing.id, updated: true };
          }
          
          // For likes and favorites, toggle off if already exists
          if (feedback_type === 'like' || feedback_type === 'favorite') {
            await db('photo_feedback')
              .where('id', existing.id)
              .delete();
            
            await this.updatePhotoFeedbackStats(photoId);
            return { removed: true };
          }
          
          return { id: existing.id, exists: true };
        }
      }
      
      // Insert new feedback
      const result = await db('photo_feedback').insert({
        photo_id: photoId,
        event_id: eventId,
        feedback_type,
        rating: feedback_type === 'rating' ? rating : null,
        comment_text: feedback_type === 'comment' ? comment_text : null,
        guest_name,
        guest_email,
        guest_identifier: guestIdentifier,
        ip_address,
        user_agent,
        is_approved: feedback_type !== 'comment' || !feedbackData.moderate_comments,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('id');
      
      const id = result[0]?.id || result[0];
      
      // Update photo stats
      await this.updatePhotoFeedbackStats(photoId);
      
      // Log activity
      await logActivity(`photo_${feedback_type}`, { photo_id: photoId }, eventId);
      
      return { id, created: true };
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback for a photo
   */
  async getPhotoFeedback(photoId, options = {}) {
    try {
      const query = db('photo_feedback')
        .where('photo_id', photoId);
      
      if (options.feedback_type) {
        query.where('feedback_type', options.feedback_type);
      }
      
      if (options.approved_only) {
        query.where('is_approved', true);
      }
      
      if (!options.include_hidden) {
        query.where('is_hidden', false);
      }
      
      if (options.guest_identifier) {
        query.where('guest_identifier', options.guest_identifier);
      }
      
      const feedback = await query
        .orderBy('created_at', 'desc')
        .select('id', 'feedback_type', 'rating', 'comment_text', 'guest_name', 'created_at', 'is_approved', 'is_hidden');
      
      return feedback;
    } catch (error) {
      logger.error('Error getting photo feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback summary for an event
   */
  async getEventFeedbackSummary(eventId) {
    try {
      const photos = await db('photos')
        .where('event_id', eventId)
        .select('id', 'filename', 'feedback_count', 'like_count', 'average_rating', 'favorite_count')
        .orderBy('average_rating', 'desc')
        .orderBy('like_count', 'desc');
      
      const totalStats = await db('photo_feedback')
        .where('event_id', eventId)
        .select(
          db.raw('COUNT(DISTINCT CASE WHEN feedback_type = ? THEN guest_identifier END) as unique_raters', ['rating']),
          db.raw('COUNT(CASE WHEN feedback_type = ? THEN 1 END) as total_ratings', ['rating']),
          db.raw('COUNT(CASE WHEN feedback_type = ? THEN 1 END) as total_likes', ['like']),
          db.raw('COUNT(CASE WHEN feedback_type = ? THEN 1 END) as total_comments', ['comment']),
          db.raw('COUNT(CASE WHEN feedback_type = ? THEN 1 END) as total_favorites', ['favorite'])
        )
        .first();
      
      return {
        photos,
        stats: totalStats
      };
    } catch (error) {
      logger.error('Error getting feedback summary:', error);
      throw error;
    }
  }

  /**
   * Update photo feedback statistics
   */
  async updatePhotoFeedbackStats(photoId) {
    try {
      // Get aggregated stats
      const stats = await db('photo_feedback')
        .where('photo_id', photoId)
        .where('is_hidden', false)
        .select(
          db.raw('COUNT(CASE WHEN feedback_type = ? AND is_approved = ? THEN 1 END) as comment_count', ['comment', formatBoolean(true)]),
          db.raw('COUNT(CASE WHEN feedback_type = ? THEN 1 END) as like_count', ['like']),
          db.raw('COUNT(CASE WHEN feedback_type = ? THEN 1 END) as favorite_count', ['favorite']),
          db.raw('AVG(CASE WHEN feedback_type = ? THEN rating END) as average_rating', ['rating']),
          db.raw('COUNT(DISTINCT guest_identifier) as feedback_count')
        )
        .first();
      
      // Update photo table
      await db('photos')
        .where('id', photoId)
        .update({
          feedback_count: stats.feedback_count || 0,
          like_count: stats.like_count || 0,
          average_rating: stats.average_rating || 0,
          favorite_count: stats.favorite_count || 0
        });
    } catch (error) {
      logger.error('Error updating photo feedback stats:', error);
      throw error;
    }
  }

  /**
   * Moderate feedback (approve/hide)
   */
  async moderateFeedback(feedbackId, action, adminId) {
    try {
      const updates = {
        updated_at: new Date()
      };
      
      if (action === 'approve') {
        updates.is_approved = true;
        updates.is_hidden = false;
      } else if (action === 'hide') {
        updates.is_hidden = true;
      } else if (action === 'reject') {
        updates.is_approved = false;
        updates.is_hidden = true;
      }
      
      const feedback = await db('photo_feedback')
        .where('id', feedbackId)
        .first();
      
      if (!feedback) {
        throw new Error('Feedback not found');
      }
      
      await db('photo_feedback')
        .where('id', feedbackId)
        .update(updates);
      
      // Update photo stats if visibility changed
      await this.updatePhotoFeedbackStats(feedback.photo_id);
      
      // Log moderation action
      await logActivity('feedback_moderated', {
        feedback_id: feedbackId,
        action,
        admin_id: adminId
      }, feedback.event_id);
      
      return true;
    } catch (error) {
      logger.error('Error moderating feedback:', error);
      throw error;
    }
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(feedbackId, adminId) {
    try {
      const feedback = await db('photo_feedback')
        .where('id', feedbackId)
        .first();
      
      if (!feedback) {
        throw new Error('Feedback not found');
      }
      
      await db('photo_feedback')
        .where('id', feedbackId)
        .delete();
      
      // Update photo stats
      await this.updatePhotoFeedbackStats(feedback.photo_id);
      
      // Log deletion
      await logActivity('feedback_deleted', {
        feedback_id: feedbackId,
        feedback_type: feedback.feedback_type,
        admin_id: adminId
      }, feedback.event_id);
      
      return true;
    } catch (error) {
      logger.error('Error deleting feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback requiring moderation
   */
  async getPendingModeration(eventId = null) {
    try {
      let query = db('photo_feedback')
        .join('photos', 'photo_feedback.photo_id', 'photos.id')
        .join('events', 'photo_feedback.event_id', 'events.id')
        .where('photo_feedback.is_approved', false)
        .where('photo_feedback.is_hidden', false)
        .where('photo_feedback.feedback_type', 'comment');
      
      if (eventId) {
        query = query.where('photo_feedback.event_id', eventId);
      }
      
      const pending = await query
        .select(
          'photo_feedback.*',
          'photos.filename as photo_filename',
          'events.event_name'
        )
        .orderBy('photo_feedback.created_at', 'desc');
      
      return pending;
    } catch (error) {
      logger.error('Error getting pending moderation:', error);
      throw error;
    }
  }

  /**
   * Export feedback data for an event
   */
  async exportEventFeedback(eventId) {
    try {
      const feedback = await db('photo_feedback')
        .join('photos', 'photo_feedback.photo_id', 'photos.id')
        .where('photo_feedback.event_id', eventId)
        .select(
          'photos.filename',
          'photo_feedback.feedback_type',
          'photo_feedback.rating',
          'photo_feedback.comment_text',
          'photo_feedback.guest_name',
          'photo_feedback.guest_email',
          'photo_feedback.created_at'
        )
        .orderBy('photos.filename')
        .orderBy('photo_feedback.created_at');
      
      return feedback;
    } catch (error) {
      logger.error('Error exporting feedback:', error);
      throw error;
    }
  }

  /**
   * Get filtered photos based on feedback criteria
   * @param {number} eventId - Event ID
   * @param {string} guestIdentifier - Guest identifier
   * @param {object} filters - Filter criteria
   * @param {boolean} filters.liked - Include liked photos
   * @param {boolean} filters.favorited - Include favorited photos
   * @param {string} filters.operator - 'AND' or 'OR' for multiple filters
   * @returns {Promise<number[]>} Array of photo IDs that match criteria
   */
  async getFilteredPhotos(eventId, guestIdentifier, filters = {}) {
    try {
      const { liked, favorited, operator = 'OR' } = filters;
      
      // If no filters specified, return all photos
      if (!liked && !favorited) {
        const allPhotos = await db('photos')
          .where('event_id', eventId)
          .select('id');
        return allPhotos.map(p => p.id);
      }
      
      // Build query based on filters
      let query = db('photo_feedback')
        .where('event_id', eventId)
        .where('guest_identifier', guestIdentifier)
        .where('is_hidden', false);
      
      // Apply filter logic
      if (operator === 'AND' && liked && favorited) {
        // For AND operation, we need photos that have both types of feedback
        const likedPhotos = await db('photo_feedback')
          .where('event_id', eventId)
          .where('guest_identifier', guestIdentifier)
          .where('feedback_type', 'like')
          .where('is_hidden', false)
          .select('photo_id');
        
        const favoritedPhotos = await db('photo_feedback')
          .where('event_id', eventId)
          .where('guest_identifier', guestIdentifier)
          .where('feedback_type', 'favorite')
          .where('is_hidden', false)
          .select('photo_id');
        
        const likedIds = new Set(likedPhotos.map(p => p.photo_id));
        const favoritedIds = new Set(favoritedPhotos.map(p => p.photo_id));
        
        // Return intersection of both sets
        return Array.from(likedIds).filter(id => favoritedIds.has(id));
      } else {
        // OR operation or single filter
        const feedbackTypes = [];
        if (liked) feedbackTypes.push('like');
        if (favorited) feedbackTypes.push('favorite');
        
        query.whereIn('feedback_type', feedbackTypes);
      }
      
      const filteredPhotos = await query
        .distinct('photo_id')
        .select('photo_id');
      
      return filteredPhotos.map(p => p.photo_id);
    } catch (error) {
      logger.error('Error getting filtered photos:', error);
      throw error;
    }
  }
}

module.exports = new FeedbackService();