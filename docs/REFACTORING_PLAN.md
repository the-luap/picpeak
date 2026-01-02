# PicPeak Comprehensive Refactoring Plan

> **Version**: 1.0
> **Created**: January 2026
> **Status**: Approved for Implementation
> **Architecture Goal**: Clean Architecture with Domain-Driven Design principles

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Target Architecture Vision](#target-architecture-vision)
4. [Phase 1: Code Duplication Elimination](#phase-1-code-duplication-elimination)
5. [Phase 2: Backend Route & Service Refactoring](#phase-2-backend-route--service-refactoring)
6. [Phase 3: Frontend Page Decomposition](#phase-3-frontend-page-decomposition)
7. [Phase 4: Cross-Cutting Concerns](#phase-4-cross-cutting-concerns)
8. [Testing Strategy](#testing-strategy)
9. [Migration & Rollback Plan](#migration--rollback-plan)
10. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### Scope
This refactoring addresses **20+ files** totaling over **15,000 lines of code** that have grown beyond maintainable sizes or contain duplicated logic. The goal is to achieve world-class architecture following Clean Architecture and SOLID principles.

### Key Outcomes
- **50%+ reduction** in average file size for targeted files
- **Zero code duplication** for utility functions
- **Clear separation of concerns** between routes, services, and domain logic
- **Improved testability** with dependency injection and smaller units
- **Better developer experience** with intuitive file organization

### Risk Mitigation
- All changes are backwards-compatible
- Each phase can be deployed independently
- Comprehensive test coverage required before each merge
- Feature flags for gradual rollout where applicable

---

## Current Architecture Analysis

### Backend Issues

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                            │
├─────────────────────────────────────────────────────────────┤
│  Routes (1000+ lines each)                                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ adminEvents.js  │  │ adminSettings.js│                  │
│  │   1,088 lines   │  │   1,056 lines   │                  │
│  │ - HTTP handlers │  │ - HTTP handlers │                  │
│  │ - Business logic│  │ - Business logic│                  │
│  │ - DB queries    │  │ - File uploads  │                  │
│  │ - Validation    │  │ - Validation    │                  │
│  │ - Helpers       │  │ - Multer config │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  Services (1000+ lines each)                                │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ backupService   │  │ restoreService  │                  │
│  │   1,120 lines   │  │   1,220 lines   │                  │
│  │ - Scheduling    │  │ - Validation    │                  │
│  │ - Execution     │  │ - Execution     │                  │
│  │ - S3 upload     │  │ - Rollback      │                  │
│  │ - Notifications │  │ - Logging       │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  PROBLEMS:                                                  │
│  ✗ Business logic in route handlers                         │
│  ✗ No service layer abstraction for events/photos          │
│  ✗ Duplicate utility functions across files                │
│  ✗ God objects with too many responsibilities              │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Issues

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                            │
├─────────────────────────────────────────────────────────────┤
│  Pages (1000+ lines each)                                   │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ SettingsPage    │  │EventDetailsPage │                  │
│  │   1,839 lines   │  │   1,479 lines   │                  │
│  │ - 27 hooks      │  │ - 33 hooks      │                  │
│  │ - 8 tab sections│  │ - Photo grid    │                  │
│  │ - All mutations │  │ - Event editing │                  │
│  │ - All queries   │  │ - Theme config  │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  Duplicate Files                                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │CreateEventPage  │  │ CMSPage.tsx     │                  │
│  │CreateEventPage  │  │ CMSPageEnhanced │                  │
│  │   Enhanced      │  │                 │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  PROBLEMS:                                                  │
│  ✗ Mega-components with 20+ hooks                          │
│  ✗ Multiple duplicate page implementations                 │
│  ✗ No custom hooks for shared logic                        │
│  ✗ Mixed concerns in single components                     │
└─────────────────────────────────────────────────────────────┘
```

### Code Duplication Map

| Function/Pattern | Locations | Lines Duplicated |
|-----------------|-----------|------------------|
| `parseBooleanInput` | 3 files | ~60 lines |
| Auth routes | 3 versions | ~900 lines |
| CreateEvent pages | 2 versions | ~1,400 lines |
| CMS pages | 2 versions | ~1,100 lines |
| Multer config | 4+ files | ~200 lines |

---

## Target Architecture Vision

### Backend Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TARGET STATE                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    ROUTES LAYER                      │   │
│  │  (Thin controllers - HTTP handling only)             │   │
│  │  ~100-200 lines per file                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   SERVICES LAYER                     │   │
│  │  (Business logic orchestration)                      │   │
│  │  ~200-400 lines per file                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │EventService │ │PhotoService │ │SettingsServ │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  DOMAIN LAYER                        │   │
│  │  (Pure business logic, no I/O)                       │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ Validators  │ │ Transformers│ │  Factories  │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               INFRASTRUCTURE LAYER                   │   │
│  │  (Database, File System, External APIs)              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │Repositories │ │ FileStorage │ │ S3Adapter   │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  SHARED UTILITIES                    │   │
│  │  (Pure functions, zero side effects)                 │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ parsers.js  │ │validators.js│ │formatters.js│    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TARGET STATE                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                     PAGES                            │   │
│  │  (Route components - composition only)               │   │
│  │  ~100-200 lines per file                             │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ SettingsPage.tsx                             │    │   │
│  │  │   <SettingsLayout>                           │    │   │
│  │  │     <GeneralSettingsTab />                   │    │   │
│  │  │     <EventSettingsTab />                     │    │   │
│  │  │     <SecuritySettingsTab />                  │    │   │
│  │  │     ...                                      │    │   │
│  │  │   </SettingsLayout>                          │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   FEATURES                           │   │
│  │  (Feature-specific components with hooks)            │   │
│  │  ~200-400 lines per file                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ settings/   │ │  events/    │ │  photos/    │    │   │
│  │  │ ├─ tabs/    │ │ ├─ editor/  │ │ ├─ grid/    │    │   │
│  │  │ ├─ hooks/   │ │ ├─ viewer/  │ │ ├─ viewer/  │    │   │
│  │  │ └─ index.ts │ │ └─ hooks/   │ │ └─ export/  │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 SHARED COMPONENTS                    │   │
│  │  (Reusable UI primitives)                            │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │   common/   │ │   forms/    │ │   layout/   │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   SHARED HOOKS                       │   │
│  │  (Reusable stateful logic)                           │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │useSettings  │ │ usePhotos   │ │ useEvents   │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Code Duplication Elimination

> **Priority**: CRITICAL
> **Estimated Effort**: 2-3 days
> **Risk**: Low
> **Dependencies**: None

### 1.1 Extract Shared Parsers Utility

**Problem**: `parseBooleanInput` function duplicated in 3 files

**Files Affected**:
- `backend/src/routes/adminEvents.js` (lines 61-81)
- `backend/src/routes/events.js` (lines 14-34)
- `frontend/src/pages/admin/SettingsPage.tsx` (lines 33-52, named `toBoolean`)

**Solution**: Create unified parser utilities

#### Backend Implementation

**Create**: `backend/src/utils/parsers.js`

```javascript
/**
 * Shared Parser Utilities
 * Pure functions for parsing and transforming input values
 */

/**
 * Parse any input value to boolean with configurable default
 * @param {*} value - Input value to parse
 * @param {boolean} defaultValue - Default if value is undefined/null
 * @returns {boolean}
 */
const parseBooleanInput = (value, defaultValue = true) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return defaultValue;
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['false', '0', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
  }
  return defaultValue;
};

/**
 * Parse numeric input with validation
 * @param {*} value - Input value to parse
 * @param {number} defaultValue - Default if invalid
 * @param {Object} options - Min/max bounds
 * @returns {number}
 */
const parseNumberInput = (value, defaultValue, { min, max } = {}) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
};

/**
 * Parse string input with trimming and null handling
 * @param {*} value - Input value
 * @param {string|null} defaultValue - Default if empty
 * @returns {string|null}
 */
const parseStringInput = (value, defaultValue = null) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || defaultValue;
  }
  return String(value);
};

/**
 * Parse JSON string safely
 * @param {*} value - JSON string or already parsed value
 * @param {*} defaultValue - Default if parsing fails
 * @returns {*}
 */
const parseJsonInput = (value, defaultValue = null) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== 'string') {
    return value; // Already parsed
  }
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
};

module.exports = {
  parseBooleanInput,
  parseNumberInput,
  parseStringInput,
  parseJsonInput
};
```

#### Frontend Implementation

**Create**: `frontend/src/utils/parsers.ts`

```typescript
/**
 * Shared Parser Utilities for Frontend
 */

/**
 * Parse any input value to boolean with configurable default
 */
export const toBoolean = (value: unknown, defaultValue = false): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return defaultValue;
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return defaultValue;
};

/**
 * Parse numeric input with validation
 */
export const toNumber = (
  value: unknown,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  if (options?.min !== undefined && parsed < options.min) return options.min;
  if (options?.max !== undefined && parsed > options.max) return options.max;
  return parsed;
};
```

#### Migration Steps

1. Create new utility files
2. Add comprehensive unit tests for all parser functions
3. Update imports in affected files one at a time:
   - `adminEvents.js`: Replace inline function with import
   - `events.js`: Replace inline function with import
   - `SettingsPage.tsx`: Replace inline function with import
4. Remove duplicate function definitions
5. Run full test suite
6. Deploy

---

### 1.2 Consolidate Auth Routes

**Problem**: Three versions of auth routes exist

**Files**:
- `backend/src/routes/auth.js` (136 lines) - Basic version
- `backend/src/routes/auth-enhanced.js` (395 lines) - Enhanced v1
- `backend/src/routes/auth-enhanced-v2.js` (393 lines) - Enhanced v2

**Analysis Required**:
```bash
# Determine which version is actively used
grep -r "auth-enhanced" backend/src/ --include="*.js"
grep -r "auth.js" backend/src/ --include="*.js"
```

**Solution**: Consolidate into single `auth.js`

#### Implementation Plan

1. **Audit Current Usage**
   - Identify which auth file is mounted in `server.js`
   - Document all endpoints from each version
   - Create feature comparison matrix

2. **Merge Strategy**
   ```
   auth.js (NEW - Consolidated)
   ├── All endpoints from auth-enhanced-v2.js (active version)
   ├── Any unique endpoints from other versions
   └── Deprecated endpoints marked for removal
   ```

3. **Create Feature Flags** (if needed)
   ```javascript
   // config/features.js
   module.exports = {
     AUTH_USE_ENHANCED_TOKENS: true,
     AUTH_REQUIRE_EMAIL_VERIFICATION: false,
   };
   ```

4. **Migration Steps**
   - Create new consolidated `auth.js`
   - Update `server.js` to use new auth routes
   - Keep old files temporarily with deprecation notices
   - Monitor for errors in production
   - Remove deprecated files after 2 weeks

---

### 1.3 Consolidate CreateEvent Pages

**Problem**: Two nearly identical event creation pages

**Files**:
- `frontend/src/pages/admin/CreateEventPage.tsx` (709 lines)
- `frontend/src/pages/admin/CreateEventPageEnhanced.tsx` (709 lines)

**Solution**: Single `CreateEventPage.tsx` with all features

#### Difference Analysis

| Feature | Standard | Enhanced |
|---------|----------|----------|
| Basic form fields | ✓ | ✓ |
| Theme customizer | ✓ | ✓ |
| Password generator | ✓ | ✓ |
| Advanced validation | ? | ✓ |
| Auto-save draft | ? | ✓ |

#### Implementation Plan

1. **Diff the files** to identify exact differences:
   ```bash
   diff -u CreateEventPage.tsx CreateEventPageEnhanced.tsx > event_pages_diff.txt
   ```

2. **Merge enhanced features into standard page**

3. **Extract shared logic into custom hooks**:
   ```typescript
   // hooks/useEventForm.ts
   export function useEventForm(initialData?: Partial<Event>) {
     // Form state management
     // Validation logic
     // Submit handlers
   }

   // hooks/useEventDraft.ts
   export function useEventDraft(eventData: Partial<Event>) {
     // Auto-save logic
     // Draft recovery
   }
   ```

4. **Update router to use single page**

5. **Delete duplicate file**

---

### 1.4 Consolidate CMS Pages

**Problem**: Two CMS page implementations

**Files**:
- `frontend/src/pages/admin/CMSPage.tsx` (538 lines)
- `frontend/src/pages/admin/CMSPageEnhanced.tsx` (618 lines)

**Enhanced Features**:
- Auto-save functionality
- Unsaved changes warning
- Enhanced editor toolbar

**Solution**: Single `CMSPage.tsx` with optional features

#### Implementation Plan

1. **Create feature-complete CMSPage.tsx**:
   ```typescript
   interface CMSPageProps {
     enableAutoSave?: boolean;
     enableUnsavedWarning?: boolean;
   }

   export const CMSPage: React.FC<CMSPageProps> = ({
     enableAutoSave = true,
     enableUnsavedWarning = true
   }) => {
     // Merged implementation
   };
   ```

2. **Extract reusable hooks**:
   ```typescript
   // hooks/useAutoSave.ts
   export function useAutoSave<T>(
     data: T,
     saveFn: (data: T) => Promise<void>,
     debounceMs = 2000
   ) { ... }

   // hooks/useUnsavedChanges.ts
   export function useUnsavedChanges(hasChanges: boolean) { ... }
   ```

3. **Delete duplicate file**

---

### 1.5 Extract Multer Configuration Factory

**Problem**: Multer storage configuration duplicated across multiple route files

**Files with Multer configs**:
- `adminPhotos.js`
- `adminSettings.js`
- `adminEvents.js`
- `protectedImages.js`

**Solution**: Centralized multer configuration factory

#### Implementation

**Create**: `backend/src/config/multerConfig.js`

```javascript
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * Create disk storage configuration
 * @param {Object} options
 * @param {string} options.destination - Upload directory path
 * @param {Function} options.filenameGenerator - Custom filename generator
 */
const createDiskStorage = ({ destination, filenameGenerator }) => {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await fs.mkdir(destination, { recursive: true });
        cb(null, destination);
      } catch (error) {
        cb(error);
      }
    },
    filename: filenameGenerator || ((req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uniqueSuffix}${ext}`);
    })
  });
};

/**
 * Create multer upload instance with standard limits
 * @param {Object} options
 * @param {multer.StorageEngine} options.storage - Multer storage engine
 * @param {number} options.maxFileSize - Max file size in bytes (default 50MB)
 * @param {string[]} options.allowedMimeTypes - Allowed MIME types
 * @param {number} options.maxFiles - Max files per request (default 100)
 */
const createUpload = ({
  storage,
  maxFileSize = 50 * 1024 * 1024,
  allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFiles = 100
}) => {
  return multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`));
      }
    }
  });
};

/**
 * Pre-configured uploads for common use cases
 */
const uploads = {
  photos: (storagePath) => createUpload({
    storage: createDiskStorage({ destination: storagePath }),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
    maxFiles: 500
  }),

  logos: (storagePath) => createUpload({
    storage: createDiskStorage({ destination: storagePath }),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024,
    maxFiles: 1
  }),

  general: (storagePath) => createUpload({
    storage: createDiskStorage({ destination: storagePath })
  })
};

module.exports = {
  createDiskStorage,
  createUpload,
  uploads
};
```

---

## Phase 2: Backend Route & Service Refactoring

> **Priority**: HIGH
> **Estimated Effort**: 5-7 days
> **Risk**: Medium
> **Dependencies**: Phase 1 complete

### 2.1 Create Event Service Layer

**Current**: `adminEvents.js` (1,088 lines) with business logic in route handlers

**Target**: Thin routes + dedicated EventService

#### New File Structure

```
backend/src/
├── routes/
│   └── adminEvents.js          # ~200 lines (HTTP only)
├── services/
│   └── events/
│       ├── index.js            # Public exports
│       ├── eventService.js     # Main service (~300 lines)
│       ├── eventValidator.js   # Validation logic (~100 lines)
│       ├── eventMapper.js      # Data transformation (~80 lines)
│       └── eventRepository.js  # Database queries (~150 lines)
└── utils/
    └── parsers.js              # Shared parsers
```

#### EventService Implementation

**Create**: `backend/src/services/events/eventService.js`

```javascript
const { db, logActivity } = require('../../database/db');
const eventRepository = require('./eventRepository');
const eventValidator = require('./eventValidator');
const eventMapper = require('./eventMapper');
const { queueEmail } = require('../emailProcessor');
const { buildShareLinkVariants } = require('../shareLinkService');
const logger = require('../../utils/logger');

class EventService {
  /**
   * Create a new event
   * @param {Object} eventData - Event creation data
   * @param {Object} admin - Admin user creating the event
   * @returns {Promise<Object>} Created event
   */
  async createEvent(eventData, admin) {
    // Validate input
    const validation = await eventValidator.validateCreate(eventData);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    // Transform data
    const eventRecord = eventMapper.toDatabase(eventData);

    // Generate slug and share link
    const slug = this.generateSlug(eventData);
    const shareToken = crypto.randomBytes(16).toString('hex');
    const { shareLinkToStore } = await buildShareLinkVariants({ slug, shareToken });

    // Create in database
    const [event] = await eventRepository.create({
      ...eventRecord,
      slug,
      share_token: shareToken,
      share_link: shareLinkToStore,
      created_by: admin.id
    });

    // Create storage folder
    await this.createEventFolder(slug);

    // Queue welcome email
    if (eventData.customer_email) {
      await queueEmail(event.id, eventData.customer_email, 'event_created', {
        event_name: event.event_name,
        gallery_link: shareLinkToStore
      });
    }

    // Log activity
    await logActivity('event_created', 'admin', admin.id, admin.username, {
      event_id: event.id,
      event_name: event.event_name
    });

    return eventMapper.toApi(event);
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId, updateData, admin) {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const validation = await eventValidator.validateUpdate(updateData, event);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    const updatedEvent = await eventRepository.update(eventId,
      eventMapper.toDatabase(updateData)
    );

    await logActivity('event_updated', 'admin', admin.id, admin.username, {
      event_id: eventId,
      changes: updateData
    });

    return eventMapper.toApi(updatedEvent);
  }

  /**
   * Archive an event
   */
  async archiveEvent(eventId, admin) {
    // Implementation
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId, admin) {
    // Implementation
  }

  /**
   * List events with filtering
   */
  async listEvents(filters, pagination) {
    const events = await eventRepository.findMany(filters, pagination);
    return events.map(eventMapper.toApi);
  }
}

module.exports = new EventService();
```

#### Refactored Route Handler

**Update**: `backend/src/routes/adminEvents.js`

```javascript
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { adminAuth } = require('../middleware/auth-enhanced-v2');
const eventService = require('../services/events');
const { handleAsync } = require('../utils/routeHelpers');

const router = express.Router();

// Apply admin auth to all routes
router.use(adminAuth);

/**
 * GET /api/admin/events
 * List all events with optional filtering
 */
router.get('/', [
  query('status').optional().isIn(['active', 'archived', 'expiring']),
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const events = await eventService.listEvents(req.query, {
    page: req.query.page || 1,
    limit: req.query.limit || 20
  });

  res.json(events);
}));

/**
 * POST /api/admin/events
 * Create a new event
 */
router.post('/', [
  body('event_name').isString().trim().isLength({ min: 3, max: 200 }),
  body('event_type').isIn(['wedding', 'birthday', 'corporate', 'other']),
  body('event_date').isISO8601(),
  body('customer_email').optional().isEmail(),
  body('password').optional().isLength({ min: 6 })
], handleAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const event = await eventService.createEvent(req.body, req.admin);
  res.status(201).json(event);
}));

/**
 * PUT /api/admin/events/:id
 * Update an event
 */
router.put('/:id', handleAsync(async (req, res) => {
  const event = await eventService.updateEvent(
    parseInt(req.params.id),
    req.body,
    req.admin
  );
  res.json(event);
}));

/**
 * DELETE /api/admin/events/:id
 * Delete an event
 */
router.delete('/:id', handleAsync(async (req, res) => {
  await eventService.deleteEvent(parseInt(req.params.id), req.admin);
  res.status(204).send();
}));

/**
 * POST /api/admin/events/:id/archive
 * Archive an event
 */
router.post('/:id/archive', handleAsync(async (req, res) => {
  const result = await eventService.archiveEvent(
    parseInt(req.params.id),
    req.admin
  );
  res.json(result);
}));

module.exports = router;
```

---

### 2.2 Create Photo Service Layer

**Current**: `adminPhotos.js` (1,005 lines)

**Target**: Similar structure to EventService

#### New File Structure

```
backend/src/services/photos/
├── index.js
├── photoService.js        # Main service
├── photoProcessor.js      # Image/video processing
├── photoRepository.js     # Database queries
├── photoStorage.js        # File system operations
└── photoValidator.js      # Validation
```

---

### 2.3 Create Settings Service Layer

**Current**: `adminSettings.js` (1,056 lines)

**Target**: Domain-specific services

#### New File Structure

```
backend/src/services/settings/
├── index.js
├── settingsService.js     # Main orchestrator
├── brandingService.js     # Logo, favicon, company info
├── themeService.js        # Theme configuration
├── securityService.js     # Security settings
└── settingsRepository.js  # Database queries
```

---

### 2.4 Decompose Backup/Restore Services

**Current**:
- `backupService.js` (1,120 lines)
- `restoreService.js` (1,220 lines)

**Target**: Smaller, focused classes

#### New File Structure

```
backend/src/services/backup/
├── index.js
├── BackupOrchestrator.js    # Main coordinator (~200 lines)
├── BackupScheduler.js       # Cron job management (~150 lines)
├── BackupExecutor.js        # Backup creation (~300 lines)
├── BackupUploader.js        # S3/remote upload (~200 lines)
├── BackupValidator.js       # Validation logic (~100 lines)
└── BackupNotifier.js        # Email notifications (~100 lines)

backend/src/services/restore/
├── index.js
├── RestoreOrchestrator.js   # Main coordinator (~200 lines)
├── RestoreValidator.js      # Pre-restore validation (~200 lines)
├── RestoreExecutor.js       # Actual restore logic (~300 lines)
├── RestoreRollback.js       # Rollback on failure (~150 lines)
└── RestoreLogger.js         # Detailed logging (~100 lines)
```

---

## Phase 3: Frontend Page Decomposition

> **Priority**: HIGH
> **Estimated Effort**: 5-7 days
> **Risk**: Medium
> **Dependencies**: Phase 1 complete

### 3.1 Decompose SettingsPage

**Current**: `SettingsPage.tsx` (1,839 lines) with 8 tabs and 27 hooks

**Target**: Composition-based page with tab components

#### New File Structure

```
frontend/src/features/settings/
├── index.ts                           # Public exports
├── SettingsPage.tsx                   # Main page (~100 lines)
├── SettingsLayout.tsx                 # Tab layout component
├── tabs/
│   ├── index.ts
│   ├── GeneralSettingsTab.tsx         # ~200 lines
│   ├── EventSettingsTab.tsx           # ~150 lines
│   ├── StatusTab.tsx                  # ~200 lines
│   ├── SecuritySettingsTab.tsx        # ~200 lines
│   ├── CategoriesTab.tsx              # ~100 lines
│   ├── AnalyticsSettingsTab.tsx       # ~150 lines
│   ├── ModerationTab.tsx              # ~100 lines
│   └── StylingTab.tsx                 # ~100 lines
├── hooks/
│   ├── index.ts
│   ├── useGeneralSettings.ts          # Settings query/mutation
│   ├── useSecuritySettings.ts
│   ├── useAnalyticsSettings.ts
│   ├── useSystemStatus.ts
│   └── useAdminProfile.ts
└── components/
    ├── AccountForm.tsx
    ├── FeatureToggles.tsx
    ├── StorageIndicator.tsx
    └── SystemStatusCard.tsx
```

#### Refactored SettingsPage

```typescript
// features/settings/SettingsPage.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsLayout } from './SettingsLayout';
import {
  GeneralSettingsTab,
  EventSettingsTab,
  StatusTab,
  SecuritySettingsTab,
  CategoriesTab,
  AnalyticsSettingsTab,
  ModerationTab,
  StylingTab
} from './tabs';

type SettingsTab =
  | 'general'
  | 'events'
  | 'status'
  | 'security'
  | 'categories'
  | 'analytics'
  | 'moderation'
  | 'styling';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs = [
    { id: 'general', label: t('settings.general.title') },
    { id: 'events', label: t('settings.events.title') },
    { id: 'status', label: t('settings.status.title') },
    { id: 'security', label: t('settings.security.title') },
    { id: 'categories', label: t('settings.categories.title') },
    { id: 'analytics', label: t('settings.analytics.title') },
    { id: 'moderation', label: t('settings.moderation.title') },
    { id: 'styling', label: t('settings.styling.title') },
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettingsTab />;
      case 'events':
        return <EventSettingsTab />;
      case 'status':
        return <StatusTab />;
      case 'security':
        return <SecuritySettingsTab />;
      case 'categories':
        return <CategoriesTab />;
      case 'analytics':
        return <AnalyticsSettingsTab />;
      case 'moderation':
        return <ModerationTab />;
      case 'styling':
        return <StylingTab />;
    }
  };

  return (
    <SettingsLayout
      title={t('settings.title')}
      description={t('settings.description')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {renderTabContent()}
    </SettingsLayout>
  );
};
```

#### Example Tab Component

```typescript
// features/settings/tabs/GeneralSettingsTab.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/common';
import {
  useGeneralSettings,
  useAdminProfile,
  useSaveGeneralSettings
} from '../hooks';
import { AccountForm } from '../components/AccountForm';
import { FeatureToggles } from '../components/FeatureToggles';
import { LanguageSelector } from '../components/LanguageSelector';
import { DateFormatSelector } from '../components/DateFormatSelector';

export const GeneralSettingsTab: React.FC = () => {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useGeneralSettings();
  const { data: profile } = useAdminProfile();
  const saveMutation = useSaveGeneralSettings();

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      <Card padding="md">
        <h2 className="text-lg font-semibold mb-4">
          {t('settings.general.accountSection')}
        </h2>
        <AccountForm
          initialData={profile}
          onSave={(data) => saveMutation.mutate(data)}
          isSaving={saveMutation.isPending}
        />
      </Card>

      <Card padding="md">
        <h2 className="text-lg font-semibold mb-4">
          {t('settings.general.features')}
        </h2>
        <FeatureToggles settings={settings} />
      </Card>

      <Card padding="md">
        <h2 className="text-lg font-semibold mb-4">
          {t('settings.general.localization')}
        </h2>
        <LanguageSelector />
        <DateFormatSelector />
      </Card>
    </div>
  );
};
```

---

### 3.2 Decompose EventDetailsPage

**Current**: `EventDetailsPage.tsx` (1,479 lines) with 33 hooks

**Target**: Section-based composition

#### New File Structure

```
frontend/src/features/events/
├── index.ts
├── EventDetailsPage.tsx              # Main page (~150 lines)
├── sections/
│   ├── index.ts
│   ├── EventInfoSection.tsx          # ~200 lines
│   ├── PhotoManagementSection.tsx    # ~250 lines
│   ├── ThemeSection.tsx              # ~150 lines
│   ├── FeedbackSection.tsx           # ~150 lines
│   ├── ShareLinkSection.tsx          # ~150 lines
│   └── ActionsSection.tsx            # ~100 lines
├── hooks/
│   ├── index.ts
│   ├── useEventDetails.ts
│   ├── useEventPhotos.ts
│   ├── useEventTheme.ts
│   ├── useEventFeedback.ts
│   └── useEventActions.ts
└── components/
    ├── EventHeader.tsx
    ├── EventStats.tsx
    ├── PhotoGrid.tsx
    └── PhotoViewer.tsx
```

---

### 3.3 Decompose Large Components

#### ThemeCustomizerEnhanced (607 lines)

**Split into**:
```
frontend/src/components/admin/theme/
├── index.ts
├── ThemeCustomizer.tsx        # Main component (~150 lines)
├── ColorEditor.tsx            # Color pickers (~150 lines)
├── TypographyEditor.tsx       # Font selection (~100 lines)
├── LayoutSelector.tsx         # Gallery layout (~100 lines)
├── PresetSelector.tsx         # Theme presets (~80 lines)
└── ThemePreview.tsx           # Live preview (~100 lines)
```

#### CMSEditor (572 lines)

**Split into**:
```
frontend/src/components/admin/cms/
├── index.ts
├── CMSEditor.tsx              # Main editor (~150 lines)
├── EditorToolbar.tsx          # Formatting toolbar (~150 lines)
├── EditorPreview.tsx          # Preview pane (~80 lines)
├── ViewModeSelector.tsx       # Edit/Preview/Split (~60 lines)
├── EditorStats.tsx            # Word/char count (~50 lines)
└── EditorHelp.tsx             # Help modal (~80 lines)
```

#### AdminPhotoViewer (515 lines)

**Split into**:
```
frontend/src/components/admin/photos/
├── index.ts
├── PhotoViewer.tsx            # Main viewer (~150 lines)
├── PhotoNavigation.tsx        # Prev/next controls (~80 lines)
├── PhotoMetadata.tsx          # File info display (~100 lines)
├── PhotoFeedback.tsx          # Ratings/comments (~100 lines)
├── PhotoActions.tsx           # Download/delete (~80 lines)
└── hooks/
    ├── usePhotoNavigation.ts
    └── usePhotoFeedback.ts
```

---

## Phase 4: Cross-Cutting Concerns

> **Priority**: MEDIUM
> **Estimated Effort**: 2-3 days
> **Dependencies**: Phases 1-3 complete

### 4.1 Create Route Helpers Utility

**Create**: `backend/src/utils/routeHelpers.js`

```javascript
/**
 * Async route handler wrapper
 * Catches errors and passes to error middleware
 */
const handleAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validate request and return early if invalid
 */
const validateRequest = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

/**
 * Standard success response
 */
const successResponse = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data
  });
};

/**
 * Standard error response
 */
const errorResponse = (res, message, statusCode = 500, details = null) => {
  res.status(statusCode).json({
    success: false,
    error: message,
    details
  });
};

module.exports = {
  handleAsync,
  validateRequest,
  successResponse,
  errorResponse
};
```

### 4.2 Create Custom Error Classes

**Create**: `backend/src/utils/errors.js`

```javascript
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
};
```

### 4.3 Create Global Error Handler

**Update**: `backend/src/middleware/errorHandler.js`

```javascript
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.admin?.id
  });

  // Operational errors (expected)
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.errors && { errors: err.errors })
    });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large',
      code: 'FILE_TOO_LARGE'
    });
  }

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY'
    });
  }

  // Unknown errors - don't leak details
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR'
  });
};

module.exports = errorHandler;
```

---

## Testing Strategy

### Unit Tests Required

#### Backend

| File | Test File | Coverage Target |
|------|-----------|-----------------|
| `utils/parsers.js` | `parsers.test.js` | 100% |
| `services/events/eventService.js` | `eventService.test.js` | 90% |
| `services/events/eventValidator.js` | `eventValidator.test.js` | 100% |
| `services/photos/photoService.js` | `photoService.test.js` | 90% |
| `services/settings/settingsService.js` | `settingsService.test.js` | 90% |
| `services/backup/BackupOrchestrator.js` | `BackupOrchestrator.test.js` | 85% |
| `services/restore/RestoreOrchestrator.js` | `RestoreOrchestrator.test.js` | 85% |

#### Frontend

| Component | Test File | Coverage Target |
|-----------|-----------|-----------------|
| `utils/parsers.ts` | `parsers.test.ts` | 100% |
| `features/settings/hooks/*` | `*.test.ts` | 90% |
| `features/settings/tabs/*` | `*.test.tsx` | 80% |
| `features/events/hooks/*` | `*.test.ts` | 90% |

### Integration Tests Required

| Scenario | Test File |
|----------|-----------|
| Event CRUD operations | `events.integration.test.js` |
| Photo upload flow | `photos.integration.test.js` |
| Settings management | `settings.integration.test.js` |
| Backup/Restore cycle | `backup.integration.test.js` |

### E2E Tests Required

| Flow | Test File |
|------|-----------|
| Create event end-to-end | `create-event.e2e.ts` |
| Settings page navigation | `settings.e2e.ts` |
| Photo management | `photos.e2e.ts` |

---

## Migration & Rollback Plan

### Pre-Migration Checklist

- [ ] All existing tests pass
- [ ] Database backup created
- [ ] Feature flags configured
- [ ] Rollback scripts prepared
- [ ] Monitoring alerts configured

### Phase Rollout Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    ROLLOUT TIMELINE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Week 1: Phase 1 (Code Duplication)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Day 1-2: Create shared utilities                    │   │
│  │ Day 3:   Update imports, run tests                  │   │
│  │ Day 4:   Deploy to staging                          │   │
│  │ Day 5:   Monitor, fix issues, deploy to production  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Week 2-3: Phase 2 (Backend Services)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Day 1-3: EventService extraction                    │   │
│  │ Day 4-5: PhotoService extraction                    │   │
│  │ Day 6-7: SettingsService extraction                 │   │
│  │ Day 8-10: Backup/Restore decomposition              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Week 4-5: Phase 3 (Frontend Decomposition)                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Day 1-3: SettingsPage decomposition                 │   │
│  │ Day 4-5: EventDetailsPage decomposition             │   │
│  │ Day 6-7: Component decomposition                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Week 6: Phase 4 (Cross-Cutting) + Cleanup                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Day 1-2: Error handling, route helpers              │   │
│  │ Day 3-4: Delete deprecated files                    │   │
│  │ Day 5:   Final testing, documentation               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Rollback Procedures

#### Phase 1 Rollback
```bash
# Revert parser utility changes
git revert <commit-hash>
# No database changes required
```

#### Phase 2 Rollback
```bash
# Service layer changes are additive
# Routes can be reverted without data loss
git revert <commit-hash>
# Restart backend services
docker-compose restart backend
```

#### Phase 3 Rollback
```bash
# Frontend changes are purely presentational
git revert <commit-hash>
# Rebuild frontend
docker-compose build frontend
docker-compose restart frontend
```

---

## Implementation Checklist

### Phase 1: Code Duplication (Days 1-3)

- [ ] **1.1 Shared Parsers**
  - [ ] Create `backend/src/utils/parsers.js`
  - [ ] Create `frontend/src/utils/parsers.ts`
  - [ ] Write unit tests (100% coverage)
  - [ ] Update `adminEvents.js` imports
  - [ ] Update `events.js` imports
  - [ ] Update `SettingsPage.tsx` imports
  - [ ] Delete inline function definitions
  - [ ] Run full test suite

- [ ] **1.2 Auth Routes Consolidation**
  - [ ] Audit current auth route usage
  - [ ] Create consolidated `auth.js`
  - [ ] Update `server.js` mount point
  - [ ] Add deprecation notices to old files
  - [ ] Test auth flows
  - [ ] Schedule old file deletion

- [ ] **1.3 CreateEvent Page Consolidation**
  - [ ] Diff files to identify differences
  - [ ] Create `hooks/useEventForm.ts`
  - [ ] Merge enhanced features into standard
  - [ ] Update router
  - [ ] Delete duplicate file

- [ ] **1.4 CMS Page Consolidation**
  - [ ] Diff files to identify differences
  - [ ] Create `hooks/useAutoSave.ts`
  - [ ] Create `hooks/useUnsavedChanges.ts`
  - [ ] Merge into single CMSPage
  - [ ] Delete duplicate file

- [ ] **1.5 Multer Config Factory**
  - [ ] Create `config/multerConfig.js`
  - [ ] Update `adminPhotos.js`
  - [ ] Update `adminSettings.js`
  - [ ] Update other files using multer
  - [ ] Test all upload flows

### Phase 2: Backend Services (Days 4-10)

- [ ] **2.1 Event Service**
  - [ ] Create `services/events/` directory structure
  - [ ] Implement `eventService.js`
  - [ ] Implement `eventRepository.js`
  - [ ] Implement `eventValidator.js`
  - [ ] Implement `eventMapper.js`
  - [ ] Refactor `adminEvents.js` to use service
  - [ ] Write unit tests (90% coverage)
  - [ ] Write integration tests

- [ ] **2.2 Photo Service**
  - [ ] Create `services/photos/` directory structure
  - [ ] Implement service layer
  - [ ] Refactor `adminPhotos.js`
  - [ ] Write tests

- [ ] **2.3 Settings Service**
  - [ ] Create `services/settings/` directory structure
  - [ ] Implement service layer
  - [ ] Refactor `adminSettings.js`
  - [ ] Write tests

- [ ] **2.4 Backup/Restore Decomposition**
  - [ ] Create `services/backup/` directory structure
  - [ ] Split `backupService.js` into components
  - [ ] Create `services/restore/` directory structure
  - [ ] Split `restoreService.js` into components
  - [ ] Write tests

### Phase 3: Frontend Decomposition (Days 11-17)

- [ ] **3.1 Settings Page**
  - [ ] Create `features/settings/` directory structure
  - [ ] Extract tab components
  - [ ] Create custom hooks
  - [ ] Refactor main page
  - [ ] Write tests

- [ ] **3.2 Event Details Page**
  - [ ] Create `features/events/` directory structure
  - [ ] Extract section components
  - [ ] Create custom hooks
  - [ ] Refactor main page
  - [ ] Write tests

- [ ] **3.3 Component Decomposition**
  - [ ] Split `ThemeCustomizerEnhanced`
  - [ ] Split `CMSEditor`
  - [ ] Split `AdminPhotoViewer`
  - [ ] Write tests

### Phase 4: Cross-Cutting (Days 18-20)

- [ ] **4.1 Route Helpers**
  - [ ] Create `utils/routeHelpers.js`
  - [ ] Update routes to use helpers
  - [ ] Write tests

- [ ] **4.2 Error Classes**
  - [ ] Create `utils/errors.js`
  - [ ] Create global error handler
  - [ ] Update services to throw typed errors
  - [ ] Write tests

- [ ] **4.3 Cleanup**
  - [ ] Delete deprecated auth route files
  - [ ] Delete duplicate page files
  - [ ] Update documentation
  - [ ] Final review

### Post-Implementation

- [ ] Update README with new architecture
- [ ] Create architecture diagram
- [ ] Conduct code review
- [ ] Performance benchmarking
- [ ] Monitor error rates for 1 week

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Largest file (lines) | 1,839 | < 400 |
| Average file size | ~500 | < 200 |
| Code duplication | ~3,500 lines | 0 |
| Test coverage | ~60% | > 85% |
| Build time | - | No increase |
| Bundle size | - | No increase |

---

## Appendix: File Impact Summary

### Files to Create

| Path | Purpose | Est. Lines |
|------|---------|------------|
| `backend/src/utils/parsers.js` | Shared parsers | 80 |
| `backend/src/utils/routeHelpers.js` | Route utilities | 50 |
| `backend/src/utils/errors.js` | Error classes | 60 |
| `backend/src/config/multerConfig.js` | Upload config | 100 |
| `backend/src/services/events/*` | Event service layer | 600 |
| `backend/src/services/photos/*` | Photo service layer | 500 |
| `backend/src/services/settings/*` | Settings service layer | 400 |
| `backend/src/services/backup/*` | Backup components | 800 |
| `backend/src/services/restore/*` | Restore components | 700 |
| `frontend/src/utils/parsers.ts` | Shared parsers | 50 |
| `frontend/src/features/settings/*` | Settings feature | 1,200 |
| `frontend/src/features/events/*` | Events feature | 1,000 |

### Files to Modify

| Path | Change Type |
|------|-------------|
| `backend/src/routes/adminEvents.js` | Reduce to ~200 lines |
| `backend/src/routes/adminPhotos.js` | Reduce to ~200 lines |
| `backend/src/routes/adminSettings.js` | Reduce to ~200 lines |
| `backend/server.js` | Update route imports |
| `frontend/src/pages/admin/SettingsPage.tsx` | Reduce to ~100 lines |
| `frontend/src/pages/admin/EventDetailsPage.tsx` | Reduce to ~150 lines |

### Files to Delete

| Path | Reason |
|------|--------|
| `backend/src/routes/auth-enhanced.js` | Consolidated into auth.js |
| `backend/src/routes/auth-enhanced-v2.js` | Consolidated into auth.js |
| `frontend/src/pages/admin/CreateEventPageEnhanced.tsx` | Merged into CreateEventPage |
| `frontend/src/pages/admin/CMSPageEnhanced.tsx` | Merged into CMSPage |

---

*Document maintained by: Development Team*
*Last updated: January 2026*
