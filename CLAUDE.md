# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product Overview

A secure photo sharing platform designed for weddings and events, enabling photographers to share time-limited, password-protected galleries. The platform features automatic expiration, archiving, and a scrappbook.de-inspired modern, minimalist UI.

## Architecture Overview

- **Backend**: Node.js/Express API with SQLite/PostgreSQL, file-based photo storage
- **Frontend**: React SPA with scrappbook.de-style design (requires implementation)
- **Storage**: File-based with active/archived separation
- **Services**: Background workers for email, archiving, file watching, and expiration monitoring
- **Analytics**: Umami integration for engagement tracking

## Essential Commands

### Backend Development
```bash
cd backend
npm install               # Install dependencies
npm run migrate          # Initialize database schema
npm run dev              # Start with hot-reload (port 3001)
npm test                 # Run Jest tests
npm run lint             # ESLint checks
```

### Running a Single Test
```bash
cd backend
npm test -- path/to/test.test.js
npm test -- --testNamePattern="test name"
```

### Production Deployment
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for comprehensive deployment instructions including:
- Docker Compose deployment
- PM2 deployment
- Manual installation
- Non-nginx deployment options
- SSL/HTTPS setup
- Troubleshooting guide

**⚠️ CRITICAL PRODUCTION NOTICE:**
- Production runs on a SEPARATE SERVER - never assume local changes affect production
- ALWAYS request production server details before any troubleshooting
- NO trial-and-error approaches in production - data loss is unacceptable
- Every change must be thoroughly analyzed and tested locally first

## Key Product Requirements (from PRD)

### Core Features
1. **File-Based System**: Drop photos in folders → automatic gallery creation
2. **Automatic Expiration**: Default 30 days, with 7-day warning emails
3. **Password Protection**: Secure access with customizable passwords
4. **Automatic Archiving**: ZIP compression and storage after expiration
5. **Email Notifications**: Creation, warning, and expiration notifications
6. **Analytics**: Umami tracking for views, downloads, and engagement

### Folder Structure
```
/events/
  ├── active/
  │   ├── wedding-smith-jones-2024-06-15/
  │   │   ├── collages/
  │   │   └── individual/
  │   └── birthday-emma-2024-07-20/
  └── archived/
      └── wedding-smith-jones-2024-06-15.zip
```

## Frontend Implementation Requirements

### Design Style (scrappbook.de-inspired)
- **Color Palette**: Primary green (#5C8762), neutral backgrounds
- **Typography**: Clean, modern sans-serif (Noto Sans or similar)
- **Layout**: Minimalist, modular sections with grid-based photo displays
- **Aesthetic**: Professional yet approachable, photographer-focused

### Key Frontend Components to Build
1. **Landing Page**: Password entry with event preview
2. **Gallery View**: 
   - Responsive photo grid with lazy loading
   - Toggle between collages/individual photos
   - Prominent expiration banner
   - Download urgency indicators
3. **Photo Lightbox**: Full-screen viewing with zoom
4. **Mobile-First**: Responsive design with touch gestures
5. **Personalization**: Dynamic theming per event type

### User Experience Priorities
- Clear expiration warnings (sticky banner)
- One-click "Download All" for urgent galleries
- Smooth image loading with skeleton screens
- Intuitive navigation between photo categories
- Professional presentation matching photographer branding

## Key Architecture Patterns

### Authentication Flow
- JWT-based with separate tokens for admin and gallery access
- Gallery tokens include event-specific claims
- Auth middleware: `backend/src/middleware/auth.js`
  - `adminAuth` - Admin panel protection
  - `photoAuth` - Protected photo access  
  - `verifyGalleryAccess` - Gallery-specific validation

### Database Schema (Knex/SQLite)
Main tables:
- `events` - Gallery metadata with expiration, custom messages, themes
- `photos` - Photo records linked to events
- `access_logs` - IP-based usage tracking
- `email_queue` - Async email processing
- `admin_users` - Admin authentication

### Service Architecture
Background services run as separate processes:
- **emailService**: Processes email queue with retry logic
- **archiveService**: Creates ZIP archives of expired events
- **expirationChecker**: Cron job for expiration warnings
- **fileWatcher**: Monitors for new photo uploads
- **backupService**: Scheduled backups with checksum-based change detection

### API Structure
- `/api/admin/*` - Admin panel endpoints (requires adminAuth)
- `/api/gallery/*` - Public gallery endpoints  
- `/api/auth/*` - Authentication endpoints
- Rate limiting: 100 req/15min (general), 5 req/15min (auth)

## Critical Implementation Notes

1. **Security**: All gallery access requires valid JWT with event-specific claims
2. **Expiration**: Events auto-expire based on `expires_at`, with 7-day email warnings
3. **Email Queue**: Async processing with retry logic, check `email_queue` table
4. **File Processing**: Sharp library for thumbnail generation (300x300)
5. **Frontend Status**: Only skeleton exists - requires full implementation based on PRD
6. **Umami Analytics**: Track password entries, downloads, views, expiration warnings

## Troubleshooting Guidelines

### Before ANY Production Troubleshooting:
1. **ALWAYS request specific details**:
   - Production server URL/IP
   - Current error messages/logs
   - Recent changes or deployments
   - Affected users/galleries
   - Time of issue occurrence

2. **Thorough Analysis Required**:
   - Use detailed thinking/analysis for EVERY troubleshooting task
   - Review all related code before suggesting changes
   - Consider all potential side effects
   - Never make assumptions about production environment

3. **Safe Troubleshooting Steps**:
   - First, reproduce issue in local/dev environment
   - Analyze logs without modifying production
   - Create detailed action plan before any changes
   - Always have rollback strategy ready
   - Document every step taken

### Common Issues & Safe Approaches:
- **Email not sending**: Check email_queue table, SMTP settings, service status
- **Photos not loading**: Verify file permissions, storage paths, nginx config
- **Gallery access issues**: Check JWT tokens, expiration dates, access_logs
- **Performance problems**: Analyze with monitoring tools first, never experiment

### Data Safety Rules:
- NEVER delete or modify production data without explicit backup confirmation
- ALWAYS verify backups exist before any data operations
- NO direct database modifications without transaction safety
- Log all actions for audit trail

## Environment Variables

### Backend (.env)
- `JWT_SECRET` - Token signing
- `ADMIN_URL`, `FRONTEND_URL` - CORS origins
- `SMTP_*` - Email configuration
- `DB_*` - PostgreSQL credentials (production)
- `UMAMI_URL` - Umami instance URL (for server-side tracking)
- `UMAMI_WEBSITE_ID` - Website ID from Umami

### Frontend (.env)
- `VITE_API_URL` - Backend API URL
- `VITE_UMAMI_URL` - Umami analytics URL
- `VITE_UMAMI_WEBSITE_ID` - Website ID from Umami
- `VITE_UMAMI_SHARE_URL` - (Optional) Public share URL for embedded dashboard

## Testing Approach
- Jest with Supertest for API testing
- Test files in `__tests__` directories
- Database migrations run before tests
- Mock email sending in tests

## Umami Analytics Integration

The frontend includes comprehensive Umami analytics integration for tracking user behavior and gallery performance.

### Tracked Events:
- **Gallery Events**:
  - `gallery_password_entry` - Password attempts (success/failure)
  - `gallery_photo_view` - Individual photo views
  - `gallery_photo_download` - Single photo downloads
  - `gallery_bulk_download` - Bulk/all photo downloads
  - `gallery_expired` - Expired gallery access attempts
- **Admin Events**:
  - `admin_login` - Admin authentication
  - `admin_event_created` - New event creation
  - `admin_event_archived` - Event archiving
  - `admin_event_deleted` - Event deletion
  - `admin_settings_updated` - Settings changes
- **User Behavior**:
  - Search queries (with debouncing)
  - Expiration warning views
  - Page views with automatic tracking

### Setup:
1. Install Umami (self-hosted or cloud)
2. Create a website in Umami dashboard
3. Set environment variables:
   ```
   VITE_UMAMI_URL=https://your-umami-instance.com
   VITE_UMAMI_WEBSITE_ID=your-website-id
   VITE_UMAMI_SHARE_URL=https://your-umami-instance.com/share/...
   ```

### Analytics Dashboard:
- Admin panel includes analytics page at `/admin/analytics`
- Summary view with key metrics
- Option to embed full Umami dashboard
- Real-time event tracking

## Accessibility & Performance Features

### Accessibility (WCAG 2.1 AA Compliance)
- **Error Boundaries**: Graceful error handling with recovery options
- **Skip Links**: Skip to main content for keyboard navigation
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Focus trap in modals, visible focus indicators
- **Keyboard Navigation**: Full keyboard support in gallery lightbox (arrows, escape, +/-, d for download)
- **Loading States**: Skeleton screens instead of spinners for better UX
- **Offline Support**: Visual indicator when offline
- **Form Validation**: Accessible error messages with aria-describedby

### Performance Optimizations
- **Lazy Loading**: Images load on scroll with Intersection Observer
- **Skeleton Screens**: Instant visual feedback during loading
- **Error Recovery**: Component-level error boundaries prevent full page crashes
- **Optimistic Updates**: Immediate UI updates with background sync
- **Debounced Search**: Prevents excessive API calls
- **Analytics**: Non-blocking Umami integration

### Component Library Enhancements
- `<ErrorBoundary>` - Catches and displays errors gracefully
- `<PageErrorBoundary>` - Full-page error recovery
- `<Skeleton>` - Flexible skeleton loader with variants
- `<OfflineIndicator>` - Network status monitoring
- `<SkipLink>` - Accessibility navigation
- `useFocusTrap` - Modal focus management hook
- `useOnlineStatus` - Network status hook

## Theme System & Branding

### Theme Features
- **Dynamic Theming**: CSS variables for runtime theme switching
- **Preset Themes**: Default, Wedding, Birthday, Corporate, Minimal
- **Customization Options**:
  - Primary/Accent/Background/Text colors
  - Font family selection
  - Border radius (none, sm, md, lg)
  - Custom logo upload
  - Custom CSS injection
- **Event-Specific Themes**: Override global theme per gallery
- **Live Preview**: Real-time theme changes in admin panel

### Theme Context API
```typescript
const { theme, setTheme, setThemeByName } = useTheme();
```

### Branding Settings
- Company name, tagline, and support email
- Custom footer text
- Optional watermarking on downloads
- Logo upload for gallery header

### CSS Variables
```css
--color-primary: #5C8762;
--color-primary-light: #7aa583;
--color-primary-dark: #4a6f4f;
--color-accent: #22c55e;
--color-background: #fafafa;
--color-text: #171717;
--font-family: 'Inter', sans-serif;
--border-radius: 0.5rem;
```

## Backup Service

### Overview
The backup service provides automated, scheduled backups of all photo data with checksum-based change detection to minimize transfer overhead.

### Features
- **Multiple Destinations**: Local directory, remote server (rsync), S3-compatible storage
- **Change Detection**: SHA256 checksums track file changes, only modified files are backed up
- **Scheduled Execution**: Configurable cron-based scheduling (default: 2 AM daily)
- **Email Notifications**: Alerts on backup failure, optional success notifications
- **Retention Management**: Automatic cleanup of old backup runs based on retention policy
- **Progress Tracking**: Database storage of backup history, file states, and statistics

### Configuration
Backup settings are stored in `app_settings` table with `backup_` prefix:
- `backup_enabled`: Enable/disable the service
- `backup_schedule`: Cron expression (e.g., '0 2 * * *')
- `backup_destination_type`: 'local', 'rsync', or 's3'
- `backup_retention_days`: How long to keep backup history
- `backup_include_archived`: Whether to backup archived events
- `backup_exclude_patterns`: File patterns to exclude

### API Endpoints
- `GET /api/admin/backup/config` - Get current configuration
- `PUT /api/admin/backup/config` - Update configuration
- `GET /api/admin/backup/status` - Get backup status and history
- `POST /api/admin/backup/run` - Trigger manual backup
- `POST /api/admin/backup/test-connection` - Test destination connectivity

### Testing
Run backup service test: `npm run test-backup`

### Database Tables
- `backup_runs`: Tracks each backup execution with statistics
- `backup_file_states`: Stores file checksums for change detection

## Thumbnail Generation

### Square Thumbnail Implementation (Issue #12 Fix)
The system now generates **square 300x300px thumbnails** to prevent blurry/stretched images in the gallery grid:

- **Problem**: Previously generated 300px width with proportional height (e.g., 300x200 for 3:2 photos), but CSS forced square display causing distortion
- **Solution**: Thumbnails now use `cover` fit mode to crop to exact 300x300px dimensions with center positioning
- **Configuration**: Settings stored in `app_settings` table with keys: `thumbnail_width`, `thumbnail_height`, `thumbnail_fit`, `thumbnail_quality`, `thumbnail_format`
- **Migration**: Run `040_add_thumbnail_settings.js` to add default square thumbnail settings
- **Regeneration Script**: Use `scripts/regenerate-square-thumbnails.js` to update existing thumbnails

### Thumbnail Settings API
- `GET /api/admin/thumbnails/settings` - Get current thumbnail configuration
- `PUT /api/admin/thumbnails/settings` - Update thumbnail settings (requires regeneration)
- `POST /api/admin/thumbnails/regenerate` - Regenerate all thumbnails with new settings
- `GET /api/admin/thumbnails/regenerate/status` - Check regeneration progress

## Success Metrics (from PRD)
- Time to generate gallery: <2 minutes
- Guest satisfaction: >90%
- System uptime: 99.9%
- Email delivery rate: >98%
- Successful archiving: 100%

## Documentation & Development Practices

### Documentation Guidelines:
- **NEVER create new documentation files for simple tasks**
- **ALWAYS update existing documentation (like this CLAUDE.md)**
- Only create new .md files when explicitly requested
- Avoid creating temporary scripts for one-off tasks

### Development Best Practices:
- Test all changes thoroughly in local environment first
- Use version control for all changes
- Keep commits atomic and well-described
- Review impact on all integrated services
- Consider backward compatibility
- Update tests when changing functionality

### Production Deployment Checklist:
- [ ] All tests passing locally
- [ ] Linting and type checks pass
- [ ] Database migrations tested with rollback plan
- [ ] Environment variables documented
- [ ] Backup strategy confirmed
- [ ] Monitoring alerts configured
- [ ] Rollback procedure documented
- [ ] Stakeholders notified of maintenance window
- always use docker deployment for testing