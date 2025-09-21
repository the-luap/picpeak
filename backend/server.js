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

const fs = require('fs');
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
const { getPublicSitePayload } = require('./src/services/publicSiteService');
const cookieParser = require('cookie-parser');
const {
  getAdminTokenFromRequest,
  getGalleryTokenFromRequest,
} = require('./src/utils/tokenUtils');

// Import routes
const authRoutes = require('./src/routes/auth-enhanced');
const eventRoutes = require('./src/routes/events');
const galleryRoutes = require('./src/routes/gallery');
const adminRoutes = require('./src/routes/admin');
const adminAuthRoutes = require('./src/routes/adminAuth');
const secureImagesRoutes = require('./src/routes/secureImages');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy headers (required for Traefik/nginx)
// Set to specific number of proxies or loopback to be more secure
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Security middleware with custom CSP
// In native HTTP installs, do NOT force HTTPS for subresources.
const enableHsts = process.env.ENABLE_HSTS === 'true';
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    'https://www.google.com',
    'https://www.gstatic.com'
  ],
  styleSrc: ["'self'", "'unsafe-inline'", "https:"], // Required for styled components
  imgSrc: ["'self'", "data:", "https:", "blob:"], // Allow data URLs and external images
  connectSrc: ["'self'", 'https://www.google.com', 'https://www.gstatic.com'], // API connections
  fontSrc: ["'self'", "https:", "data:"], // Web fonts
  objectSrc: ["'none'"], // Disable plugins
  mediaSrc: ["'self'"], // Audio/video
  frameSrc: ["'self'", 'https://www.google.com'],
};
// Only upgrade insecure requests when HSTS explicitly enabled (HTTPS deployment)
if (enableHsts) {
  // In helmet, an empty array enables the directive
  cspDirectives.upgradeInsecureRequests = [];
}

app.use(cookieParser());

app.use((req, res, next) => {
  if (req.headers.authorization) {
    return next();
  }

  const path = req.path || '';
  const slugMatch = path.match(/\/api\/(?:gallery|secure-images)\/([^\/]+)/);
  const slug = slugMatch ? slugMatch[1] : req.requestedSlug;
  const adminToken = getAdminTokenFromRequest(req);
  const galleryToken = getGalleryTokenFromRequest(req, slug);

  const isAdminRequest = path.startsWith('/api/admin') || path.startsWith('/admin');
  const isGalleryRequest = Boolean(slugMatch)
    || path.startsWith('/api/gallery')
    || path.startsWith('/gallery')
    || path.startsWith('/api/secure-images');

  // Prefer admin credentials on admin routes so gallery sessions cannot override them.
  if (isAdminRequest) {
    if (adminToken) {
      req.headers.authorization = `Bearer ${adminToken}`;
    }
  } else if (isGalleryRequest) {
    if (galleryToken) {
      req.headers.authorization = `Bearer ${galleryToken}`;
    } else if (adminToken) {
      req.headers.authorization = `Bearer ${adminToken}`;
    }
  } else if (adminToken) {
    req.headers.authorization = `Bearer ${adminToken}`;
  } else if (galleryToken) {
    req.headers.authorization = `Bearer ${galleryToken}`;
  }

  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    // Avoid helmet adding defaults like upgrade-insecure-requests when not desired
    useDefaults: false,
    directives: cspDirectives,
  },
  hsts: enableHsts ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// Additional security headers
app.use((req, res, next) => {
  // Permissions Policy (controls browser features)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// CORS configuration (apply only to API routes)
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

    // Allow requests with no origin (like curl) and allow-listed origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Do not error globally; just omit CORS headers on disallowed origins
      callback(null, false);
    }
  },
  credentials: true
};

// Only attach CORS to API endpoints, not static assets
app.use('/api', cors(corsOptions));
// Handle preflight explicitly for API paths
app.options('/api/*', cors(corsOptions));

// Initialize rate limiters (they will be created dynamically)
let generalRateLimiter;
let authRateLimiter;

function composeInlineStyles(payload) {
  const { branding } = payload;
  const cssSegments = [];

  cssSegments.push(`:root {
  --brand-primary: ${branding.colors.primary};
  --brand-accent: ${branding.colors.accent};
  --brand-background: ${branding.colors.background};
  --brand-text: ${branding.colors.text};
}`);

  if (payload.baseCss) {
    cssSegments.push(payload.baseCss);
  }

  if (payload.css) {
    cssSegments.push(`/* Custom styles */\n${payload.css}`);
  }

  return cssSegments.join('\n\n');
}

function renderBrandHeader(branding) {
  const displayName = branding.companyName || 'PicPeak';
  const logoSrc = branding.logoUrl || '/picpeak-logo-transparent.png';
  const logo = `<img src="${logoSrc}" alt="${displayName}" class="brand-logo" loading="lazy" decoding="async" />`;

  const tagline = branding.companyTagline
    ? `<p class="brand-tagline">${branding.companyTagline}</p>`
    : '';

  return `<header class="site-header">
  <div class="header-inner">
    <div class="brand">
      ${logo}
      <div class="brand-copy">
        <p class="brand-label">${displayName}</p>
        ${tagline}
      </div>
    </div>
    <nav class="site-nav">
      <a href="#features">${'Features'}</a>
      <a href="#workflow">${'Workflow'}</a>
      <a href="#collections">${'Collections'}</a>
      <a href="#stories">${'Stories'}</a>
      <a href="#contact">${'Contact'}</a>
    </nav>
  </div>
</header>`;
}

function renderBrandFooter(branding) {
  const displayName = branding.companyName || 'PicPeak';
  const footerNote = branding.footerText
    ? `<p>${branding.footerText}</p>`
    : '<p>Powered by PicPeak to keep every celebration beautifully organised.</p>';

  const supportLink = branding.supportEmail
    ? `<a href="mailto:${branding.supportEmail}">Support</a>`
    : '';

  const legalLinks = `
    <a href="/datenschutz">Privacy Policy</a>
    <a href="/impressum">Impressum</a>
    ${supportLink}
  `;

  return `<footer class="site-footer" id="contact">
  <div class="footer-inner">
    <div>
      <h2>${displayName}</h2>
      ${footerNote}
    </div>
    <div class="footer-links">
      ${legalLinks}
    </div>
  </div>
</footer>`;
}

function buildPublicSiteDocument(payload) {
  const inlineStyles = composeInlineStyles(payload);
  const header = renderBrandHeader(payload.branding);
  const footer = renderBrandFooter(payload.branding);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${payload.title}</title>
  <meta name="description" content="Curated photo galleries and stories from unforgettable celebrations." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${inlineStyles}</style>
</head>
<body>
  <div class="site-shell">
    ${header}
    <main class="site-main">
      ${payload.html}
    </main>
    ${footer}
  </div>
</body>
</html>`;
}

async function handlePublicSiteRequest(req, res, next) {
  try {
    const payload = await getPublicSitePayload();

    if (!payload.enabled) {
      res.redirect(302, '/admin/login');
      return;
    }

    if (payload.etag && req.headers['if-none-match'] === payload.etag) {
      res.status(304).end();
      return;
    }

    const document = buildPublicSiteDocument(payload);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.setHeader('ETag', payload.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; object-src 'none'; script-src 'self'; form-action 'self'");

    res.status(200).send(document);
  } catch (error) {
    logger.error('Failed to render public site', { error: error.message });
    next();
  }
}

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

// Request logging for API routes (with timestamps)
const apiRequestLogger = (req, res, next) => {
  try {
    const started = Date.now();
    const ts = new Date().toISOString();
    logger.info(`[${ts}] ${req.method} ${req.originalUrl}`);
    res.on('finish', () => {
      const ms = Date.now() - started;
      const tsDone = new Date().toISOString();
      logger.info(`[${tsDone}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
    });
  } catch (_) {}
  next();
};
app.use('/api', apiRequestLogger);

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
process.env.EXTERNAL_MEDIA_ROOT = process.env.EXTERNAL_MEDIA_ROOT || '/external-media';

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
  app.use('/api/admin/external-media', require('./src/routes/adminExternalMedia'));
// Gallery routes - main routes first, then feedback routes
app.use('/api/gallery', galleryRoutes);
app.use('/api/gallery', require('./src/routes/galleryFeedback'));
app.use('/api/admin', adminRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/system', require('./src/routes/adminSystem'));
app.use('/api/admin/backup', require('./src/routes/adminBackup'));
app.use('/api/admin/database-backup', require('./src/routes/adminDatabaseBackup'));
app.use('/api/admin/feedback', require('./src/routes/adminFeedback'));
app.use('/api/admin/image-security', require('./src/routes/adminImageSecurity'));
app.use('/api/admin/thumbnails', require('./src/routes/adminThumbnails'));
app.use('/api/admin/photos', require('./src/routes/adminPhotos'));
app.use('/api/public/settings', require('./src/routes/publicSettings'));
app.use('/api/public', require('./src/routes/publicCMS'));
app.use('/api/images', require('./src/routes/protectedImages'));
app.use('/api/secure-images', secureImagesRoutes);

// Optional: Serve built frontend (native installs)
try {
  const serveFrontendEnv = process.env.SERVE_FRONTEND; // 'true' | 'false' | undefined
  const frontendDir = process.env.FRONTEND_DIR || path.join(__dirname, '../frontend/dist');
  const indexPath = path.join(frontendDir, 'index.html');
  // Auto-serve when dist exists unless explicitly disabled
  const shouldServe = (serveFrontendEnv === 'true') || ((serveFrontendEnv === undefined || serveFrontendEnv === 'auto') && fs.existsSync(indexPath));
  if (shouldServe) {
    logger.info(`Serving frontend from ${frontendDir}`);
    // Serve pre-built assets
    app.use(express.static(frontendDir));

    // Landing page handler or SPA fallback
    app.get('/', handlePublicSiteRequest, (req, res) => {
      res.sendFile(indexPath);
    });

    // SPA fallback for admin + gallery routes
    app.get(['/admin', '/admin/*', '/gallery/*'], (req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    logger.info('Frontend static serving disabled or dist not found', { serveFrontendEnv, frontendDir });
    app.get('/', handlePublicSiteRequest, (req, res) => {
      res.status(503).send('Frontend bundle not available. Build frontend or enable public site.');
    });
  }
} catch (e) {
  logger.warn('Failed to enable frontend static serving', { error: e.message });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('EXPRESS ERROR HANDLER:', err);
  console.error('Error stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  logger.error('Express error handler:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
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
