const express = require('express');
const { db, logActivity } = require('../database/db');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const router = express.Router();

// Get notifications (unread activity logs)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { limit = 20, includeRead = false } = req.query;

    let query = db('activity_logs')
      .select(
        'activity_logs.*',
        'events.event_name'
      )
      .leftJoin('events', 'activity_logs.event_id', 'events.id')
      .orderBy('activity_logs.created_at', 'desc')
      .limit(parseInt(limit));
    
    // By default, only show unread notifications
    if (includeRead !== 'true') {
      query = query.whereNull('activity_logs.read_at');
    }

    const notifications = await query;

    // Format notifications
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      type: notification.activity_type,
      actorType: notification.actor_type,
      actorName: notification.actor_name,
      eventName: notification.event_name,
      eventId: notification.event_id,
      metadata: (() => {
        try {
          if (!notification.metadata) return {};
          if (typeof notification.metadata === 'object') return notification.metadata;
          return JSON.parse(notification.metadata);
        } catch (e) {
          console.warn('Failed to parse metadata for notification:', notification.id, e.message);
          return {};
        }
      })(),
      createdAt: notification.created_at,
      readAt: notification.read_at,
      isRead: !!notification.read_at
    }));

    // Get unread count
    const unreadCount = await db('activity_logs')
      .whereNull('read_at')
      .count('id as count')
      .first();

    res.json({
      notifications: formattedNotifications,
      unreadCount: unreadCount.count || 0
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await db('activity_logs')
      .where('id', id)
      .update({
        read_at: new Date()
      });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', adminAuth, async (req, res) => {
  try {
    await db('activity_logs')
      .whereNull('read_at')
      .update({
        read_at: new Date()
      });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete old notifications (older than 30 days and read)
router.delete('/clear-old', adminAuth, async (req, res) => {
  try {
    // Use database-agnostic date calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let deletedCount = 0;
    const client = db?.client?.config?.client;

    if (client === 'pg') {
      const primaryResult = await db.raw(
        `
          WITH deleted AS (
            DELETE FROM activity_logs
            WHERE read_at IS NOT NULL OR created_at < ?
            RETURNING id
          )
          SELECT COUNT(*)::int AS count FROM deleted
        `,
        [thirtyDaysAgo.toISOString()]
      );
      deletedCount = primaryResult.rows?.[0]?.count || 0;

      if (deletedCount === 0) {
        const fallbackResult = await db.raw(
          `
            WITH deleted AS (
              DELETE FROM activity_logs
              RETURNING id
            )
            SELECT COUNT(*)::int AS count FROM deleted
          `
        );
        deletedCount = fallbackResult.rows?.[0]?.count || 0;
      }
    } else {
      deletedCount = await db('activity_logs')
        .where(function () {
          this.whereNotNull('read_at')
            .orWhere('created_at', '<', thirtyDaysAgo);
        })
        .delete();

      if (deletedCount === 0) {
        deletedCount = await db('activity_logs').delete();
      }
    }

    res.json({ 
      message: deletedCount > 0 ? 'Old notifications cleared' : 'No notifications to clear',
      deletedCount 
    });
  } catch (error) {
    console.error('Clear old notifications error:', error);
    res.status(500).json({ error: 'Failed to clear old notifications' });
  }
});

module.exports = router;
