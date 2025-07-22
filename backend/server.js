require('dotenv').config();

// Validate critical environment variables before proceeding
const { validateEnvironment } = require('./src/config/validateEnv');
validateEnvironment();

// Initialize logger early to capture startup logs
const logger = require('./src/utils/logger');
logger.info('Server starting up', {
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString()
});

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { initializeDatabase, db } = require('./src/database/db');
const { startFileWatcher } = require('./src/services/fileWatcher');
const { startExpirationChecker } = require('./src/services/expirationChecker');
const { initializeTransporter, startEmailQueueProcessor } = require('./src/services/emailProcessor');
const { startBackupService } = require('./src/services/backupService');
const { startScheduledBackups } = require('./src/services/databaseBackup');
const { maintenanceMiddleware } = require('./src/middleware/maintenance');
const { sessionTimeoutMiddleware } = require('./src/middleware/sessionTimeout');
const { createRateLimiter, createAuthRateLimiter } = require('./src/services/rateLimitService');

// Import routes
const authRoutes = require('./src/routes/auth-enhanced');
const eventRoutes = require('./src/routes/events');
const galleryRoutes = require('./src/routes/gallery');
const adminRoutes = require('./src/routes/admin');
const adminAuthRoutes = require('./src/routes/adminAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy headers (required for Traefik/nginx)
// Set to specific number of proxies or loopback to be more secure
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Security middleware with custom CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Required for React
      styleSrc: ["'self'", "'unsafe-inline'", "https:"], // Required for styled components
      imgSrc: ["'self'", "data:", "https:", "blob:"], // Allow data URLs and external images
      connectSrc: ["'self'"], // API connections
      fontSrc: ["'self'", "https:", "data:"], // Web fonts
      objectSrc: ["'none'"], // Disable plugins
      mediaSrc: ["'self'"], // Audio/video
      frameSrc: ["'none'"], // Disable iframes
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// Additional security headers
app.use((req, res, next) => {
  // Permissions Policy (controls browser features)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3005',
      process.env.ADMIN_URL || 'http://localhost:3005'
    ];
    
    // In development, also allow localhost origins
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push(
        'http://localhost:5173', // Vite dev server
        'http://localhost:3002', // Backend server
        'http://localhost:3001', // For API testing
        'http://localhost:3000'  // Direct backend access
      );
    }
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Initialize rate limiters (they will be created dynamically)
let generalRateLimiter;
let authRateLimiter;

// Function to initialize rate limiters
async function initializeRateLimiters() {
  generalRateLimiter = await createRateLimiter();
  authRateLimiter = await createAuthRateLimiter();
  
  // Apply rate limiting
  app.use('/api/', generalRateLimiter);
  app.use('/api/auth', authRateLimiter);
  app.use('/api/gallery/:slug/verify', authRateLimiter);
  app.use('/api/admin/auth/login', authRateLimiter);
}

// Note: Rate limiters will be initialized after database connection

// Body parsing middleware with increased limits for large uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Maintenance mode middleware - add after body parsing but before routes
app.use(maintenanceMiddleware);

// Session timeout middleware for admin routes
app.use('/api/admin', sessionTimeoutMiddleware);

// Middleware to set CORS headers for static files
const setCorsHeaders = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

// Import secure static middleware
const secureStatic = require('./src/middleware/secureStatic');

// Get storage path from environment or use default
const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../storage');

// Static file serving for photos (protected)
app.use('/photos', require('./src/middleware/photoAuth'), setCorsHeaders, secureStatic(path.join(storagePath, 'events/active')));

// Static file serving for thumbnails (protected)
app.use('/thumbnails', require('./src/middleware/photoAuth'), setCorsHeaders, secureStatic(path.join(storagePath, 'thumbnails')));

// Static file serving for uploads (public - logos, favicons)
app.use('/uploads', setCorsHeaders, secureStatic(path.join(storagePath, 'uploads')));

// Debug endpoint to check IP detection (only in development)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/ip', (req, res) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.ip;
    
    res.json({
      detectedIp: clientIp,
      reqIp: req.ip,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-forwarded-host': req.headers['x-forwarded-host']
      },
      trustProxy: app.get('trust proxy')
    });
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await db.raw('SELECT 1');
    
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/system', require('./src/routes/adminSystem'));
app.use('/api/admin/backup', require('./src/routes/adminBackup'));
app.use('/api/admin/database-backup', require('./src/routes/adminDatabaseBackup'));
app.use('/api/admin/feedback', require('./src/routes/adminFeedback'));
app.use('/api/gallery', require('./src/routes/galleryFeedback'));
app.use('/api/public/settings', require('./src/routes/publicSettings'));
app.use('/api/public', require('./src/routes/publicCMS'));
app.use('/api/images', require('./src/routes/protectedImages'));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize services
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize rate limiters after database is ready
    await initializeRateLimiters();
    logger.info('Rate limiters initialized with database configuration');

    // Initialize auth security cleanup job
    const { initializeCleanupJob } = require('./src/utils/authSecurity');
    initializeCleanupJob();
    
    // Initialize temp upload cleanup job
    const { cleanupTempUploads } = require('./src/utils/cleanupTempUploads');
    // Run cleanup on startup
    cleanupTempUploads();
    // Schedule periodic cleanup every hour
    setInterval(cleanupTempUploads, 60 * 60 * 1000);
    logger.info('Temp upload cleanup scheduled');
    
    // Start file watcher
    startFileWatcher();
    
    // Start expiration checker
    startExpirationChecker();
    
    // Initialize email transporter and start queue processor
    await initializeTransporter();
    startEmailQueueProcessor();
    
    // Start backup service
    await startBackupService();
    
    // Start database backup service
    await startScheduledBackups();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Admin interface: ${process.env.ADMIN_URL || 'http://localhost:3000'}`);
      logger.info(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app; // For testing
