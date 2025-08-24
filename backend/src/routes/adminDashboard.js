const express = require('express');
const { db } = require('../database/db');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const { sanitizeDays, addDateRangeCondition } = require('../utils/sqlSecurity');
const { formatBoolean } = require('../utils/dbCompat');
const router = express.Router();

// Get dashboard statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Get active events count
    const activeEvents = await db('events')
      .where('is_active', formatBoolean(true))
      .where('is_archived', formatBoolean(false))
      .count('id as count')
      .first();

    // Get events expiring within 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const now = new Date();
    
    const expiringEvents = await db('events')
      .where('is_active', formatBoolean(true))
      .where('is_archived', formatBoolean(false))
      .where('expires_at', '<=', sevenDaysFromNow.toISOString())
      .where('expires_at', '>', now.toISOString())
      .count('id as count')
      .first();

    // Get total photos count
    const totalPhotos = await db('photos')
      .count('id as count')
      .first();

    // Get storage usage (sum of all photo sizes)
    const storageUsed = await db('photos')
      .sum('size_bytes as total')
      .first();

    // Get total views (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const totalViews = await db('access_logs')
      .where('action', 'view')
      .where('timestamp', '>=', thirtyDaysAgo.toISOString())
      .count('id as count')
      .first();

    // Get total downloads (last 30 days) - include both single and bulk downloads
    const totalDownloads = await db('access_logs')
      .whereIn('action', ['download', 'download_all'])
      .where('timestamp', '>=', thirtyDaysAgo.toISOString())
      .count('id as count')
      .first();

    // Get archived events count
    const archivedEvents = await db('events')
      .where('is_archived', formatBoolean(true))
      .count('id as count')
      .first();

    // Calculate trends (compare with previous 30 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const previousViews = await db('access_logs')
      .where('action', 'view')
      .where('timestamp', '>=', sixtyDaysAgo.toISOString())
      .where('timestamp', '<', thirtyDaysAgo.toISOString())
      .count('id as count')
      .first();

    const previousDownloads = await db('access_logs')
      .whereIn('action', ['download', 'download_all'])
      .where('timestamp', '>=', sixtyDaysAgo.toISOString())
      .where('timestamp', '<', thirtyDaysAgo.toISOString())
      .count('id as count')
      .first();

    // Calculate trend percentages
    const viewsTrend = previousViews.count > 0 
      ? ((totalViews.count - previousViews.count) / previousViews.count) * 100 
      : 0;
    
    const downloadsTrend = previousDownloads.count > 0
      ? ((totalDownloads.count - previousDownloads.count) / previousDownloads.count) * 100
      : 0;

    res.json({
      activeEvents: activeEvents.count || 0,
      expiringEvents: expiringEvents.count || 0,
      totalPhotos: totalPhotos.count || 0,
      storageUsed: storageUsed.total || 0,
      totalViews: totalViews.count || 0,
      totalDownloads: totalDownloads.count || 0,
      viewsTrend: Math.round(viewsTrend * 10) / 10,
      downloadsTrend: Math.round(downloadsTrend * 10) / 10,
      archivedEvents: archivedEvents.count || 0
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activity
router.get('/activity', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const activities = await db('activity_logs')
      .select('activity_logs.*', 'events.event_name')
      .leftJoin('events', 'activity_logs.event_id', 'events.id')
      .orderBy('activity_logs.created_at', 'desc')
      .limit(limit);

    // Format activities
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      type: activity.activity_type,
      actorType: activity.actor_type,
      actorName: activity.actor_name,
      eventName: activity.event_name,
      metadata: (() => {
        try {
          if (!activity.metadata) return {};
          if (typeof activity.metadata === 'object') return activity.metadata;
          return JSON.parse(activity.metadata);
        } catch (e) {
          console.warn('Failed to parse metadata for activity:', activity.id, e.message);
          return {};
        }
      })(),
      createdAt: activity.created_at
    }));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// Get system health status
router.get('/health', adminAuth, async (req, res) => {
  try {
    const os = require('os');
    
    // Check database connectivity
    let dbStatus = 'healthy';
    try {
      await db.raw('SELECT 1');
    } catch (error) {
      dbStatus = 'error';
    }

    // Check email queue
    const [pendingEmails] = await db('email_queue')
      .where('status', 'pending')
      .count('* as count');
    
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const [failedEmails] = await db('email_queue')
      .where('status', 'failed')
      .where('scheduled_at', '>=', twentyFourHoursAgo.toISOString())
      .count('* as count');

    const emailStatus = failedEmails.count > 10 ? 'warning' : 'healthy';

    // Check disk space (simplified)
    const storageStatus = 'healthy'; // In production, check actual disk usage

    // Memory usage
    const memoryUsage = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
    };

    const memoryStatus = memoryUsage.percentage > 90 ? 'warning' : 'healthy';

    // Overall health
    const statuses = [dbStatus, emailStatus, storageStatus, memoryStatus];
    let overallHealth = 'healthy';
    if (statuses.includes('error')) overallHealth = 'error';
    else if (statuses.includes('warning')) overallHealth = 'warning';

    res.json({
      overall: overallHealth,
      services: {
        database: dbStatus,
        email: emailStatus,
        storage: storageStatus,
        memory: memoryStatus
      },
      details: {
        emailQueue: {
          pending: pendingEmails.count,
          failed: failedEmails.count
        },
        memory: memoryUsage
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      overall: 'error',
      error: 'Failed to check system health' 
    });
  }
});

// Get analytics data for charts
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const days = sanitizeDays(req.query.days || 7);
    
    // Generate date range
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      dates.push({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        views: 0,
        downloads: 0,
        uniqueVisitors: 0
      });
    }

    // Calculate the start date for queries
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Get views per day
    const viewsData = await db('access_logs')
      .select(db.raw('DATE(timestamp) as date'), db.raw('COUNT(*) as count'))
      .where('action', 'view')
      .where('timestamp', '>=', startDateStr)
      .groupByRaw('DATE(timestamp)');

    // Get downloads per day - include both single and bulk downloads
    const downloadsData = await db('access_logs')
      .select(db.raw('DATE(timestamp) as date'), db.raw('COUNT(*) as count'))
      .whereIn('action', ['download', 'download_all'])
      .where('timestamp', '>=', startDateStr)
      .groupByRaw('DATE(timestamp)');

    // Get unique visitors per day
    const visitorsData = await db('access_logs')
      .select(db.raw('DATE(timestamp) as date'), db.raw('COUNT(DISTINCT ip_address) as count'))
      .where('timestamp', '>=', startDateStr)
      .groupByRaw('DATE(timestamp)');

    // Merge data into dates array
    viewsData.forEach(row => {
      const dateObj = dates.find(d => d.date === row.date);
      if (dateObj) dateObj.views = row.count;
    });

    downloadsData.forEach(row => {
      const dateObj = dates.find(d => d.date === row.date);
      if (dateObj) dateObj.downloads = row.count;
    });

    visitorsData.forEach(row => {
      const dateObj = dates.find(d => d.date === row.date);
      if (dateObj) dateObj.uniqueVisitors = row.count;
    });

    // Get top galleries by views with additional metrics
    const topGalleries = await db('access_logs')
      .select('events.id', 'events.event_name', 'events.slug')
      .select(db.raw('COUNT(CASE WHEN action = \'view\' THEN 1 END) as views'))
      .select(db.raw('COUNT(DISTINCT CASE WHEN action = \'view\' THEN ip_address END) as uniqueVisitors'))
      .select(db.raw('COUNT(CASE WHEN action IN (\'download\', \'download_all\') THEN 1 END) as downloads'))
      .join('events', 'access_logs.event_id', 'events.id')
      .where('access_logs.timestamp', '>=', startDateStr)
      .groupBy('events.id', 'events.event_name', 'events.slug')
      .orderBy('views', 'desc')
      .limit(5);

    // Get device breakdown (simplified - based on user agent)
    const deviceData = await db('access_logs')
      .select(
        db.raw(`
          CASE 
            WHEN user_agent LIKE '%Mobile%' THEN 'mobile'
            WHEN user_agent LIKE '%Tablet%' OR user_agent LIKE '%iPad%' THEN 'tablet'
            ELSE 'desktop'
          END as device_type
        `),
        db.raw('COUNT(*) as count')
      )
      .where('timestamp', '>=', startDateStr)
      .groupBy('device_type');

    const totalDevices = deviceData.reduce((sum, d) => sum + d.count, 0);
    const devices = {
      desktop: 0,
      mobile: 0,
      tablet: 0
    };

    deviceData.forEach(d => {
      devices[d.device_type] = Math.round((d.count / totalDevices) * 100);
    });

    // Calculate totals for the period (matching /stats logic)
    const totalViews = await db('access_logs')
      .where('action', 'view')
      .where('timestamp', '>=', startDateStr)
      .count('id as count')
      .first();

    const totalDownloadsCount = await db('access_logs')
      .whereIn('action', ['download', 'download_all'])
      .where('timestamp', '>=', startDateStr)
      .count('id as count')
      .first();

    const totalUniqueVisitors = await db('access_logs')
      .where('timestamp', '>=', startDateStr)
      .countDistinct('ip_address as count')
      .first();

    res.json({
      chartData: dates,
      topGalleries,
      devices,
      totals: {
        views: totalViews?.count || 0,
        downloads: totalDownloadsCount?.count || 0,
        uniqueVisitors: totalUniqueVisitors?.count || 0
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

module.exports = router;