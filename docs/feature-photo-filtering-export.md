# Feature: Photo Filtering & Export for Professional Workflows

## Overview

This feature enables administrators to filter photos by guest feedback (rated, liked, favorited) and export filtered selections in formats compatible with professional photo editing tools like Adobe Lightroom, Capture One, Photo Mechanic, and Affinity Photo.

**Priority:** Low
**Status:** Open

---

## Problem Statement

Currently, PicPeak collects valuable guest feedback (ratings, likes, favorites) but administrators cannot easily:
1. Filter photos in the admin panel based on this feedback
2. Export filtered selections for use in professional photo editing workflows
3. Identify "client picks" to prioritize in post-processing

Professional photographers need to:
- Quickly identify which photos guests loved most
- Export these selections to Lightroom/Capture One for final editing
- Create client-approved photo sets without manual searching

---

## User Stories

1. **As an administrator**, I want to filter photos by rating, likes, or favorites, so that I can quickly see which photos guests preferred.

2. **As an administrator**, I want to export a filtered selection of photos, so that I can import them into Lightroom or Capture One for final processing.

3. **As an administrator**, I want multiple export format options, so that I can use whichever format works best with my photo editing software.

---

## Research: Professional Photo Tool Import Formats

### Industry Standards

Based on research into professional photo editing workflows:

| Format | Description | Compatibility |
|--------|-------------|---------------|
| **XMP Sidecar** | XML-based metadata files with ratings/labels | Lightroom, Bridge, Capture One, ACR |
| **CSV/Text List** | Simple filename list for manual selection | All tools (via search/filter) |
| **ZIP Archive** | Direct photo export with folder structure | All tools (file import) |
| **JSON Metadata** | Structured data for programmatic workflows | Scripts, automation |

### Sources Referenced
- [Adobe XMP Metadata Documentation](https://helpx.adobe.com/lightroom-classic/help/metadata-basics-actions.html)
- [Capture One EIP Format](https://support.captureone.com/hc/en-us/articles/360002478617-Enhanced-Image-Package-EIP-overview)
- [IPTC Photo Metadata Standard](https://iptc.org/standards/photo-metadata/iptc-standard/)
- [ExifTool Documentation](https://exiftool.org/)
- [Lightroom Filename Search Method](https://community.adobe.com/t5/lightroom-classic-discussions/how-to-make-a-selection-of-images-in-lightroom-classic-from-a-list-of-filenames/td-p/12002275)

---

## Current PicPeak Feedback System

### Existing Features (from codebase analysis)

| Feedback Type | Database Column | Scale | Guest Toggle |
|---------------|-----------------|-------|--------------|
| **Ratings** | `average_rating`, `feedback_count` | 1-5 stars | Update/Remove |
| **Likes** | `like_count` | Count | Toggle on/off |
| **Favorites** | `favorite_count` | Count | Toggle on/off |
| **Comments** | `photo_feedback` table | Text | No |

### Database Schema (photos table)
```sql
average_rating  DECIMAL(3,2)  -- 0.00 to 5.00
feedback_count  INTEGER       -- Total rating count
like_count      INTEGER       -- Total likes
favorite_count  INTEGER       -- Total favorites
```

### Existing Export (feedback only)
- Endpoint: `GET /admin/feedback/events/:eventId/feedback/export`
- Formats: JSON, CSV
- Exports feedback records, not filtered photo lists

---

## Feature Requirements

### 1. Admin Photo Filter UI

#### 1.1 Filter Panel Location
**Path:** Admin Panel → Event → Photos Tab

Add filter controls above the photo grid:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Photos                                                    [Upload]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ Filters ──────────────────────────────────────────────────────┐  │
│ │                                                                 │  │
│ │ Feedback:  [All ▼]  [Rated ▼]  [≥ 3 stars ▼]                  │  │
│ │                                                                 │  │
│ │ ☑ Has likes (15)   ☑ Has favorites (8)   ☐ Has comments (3)   │  │
│ │                                                                 │  │
│ │ [Clear Filters]                    Showing: 23 of 150 photos   │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ [Select All Filtered] [Export Selection ▼]                          │
│                                                                      │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ ☑  │ │ ☑  │ │ ☑  │ │ ☐  │ │ ☐  │ │ ☐  │   ...                │
│ │ IMG │ │ IMG │ │ IMG │ │ IMG │ │ IMG │ │ IMG │                    │
│ │ ⭐⭐⭐│ │ ⭐⭐⭐│ │ ⭐⭐⭐│ │     │ │     │ │     │                    │
│ │ ❤ 5 │ │ ❤ 3 │ │ ❤ 8 │ │     │ │     │ │     │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

#### 1.2 Filter Options

| Filter | Type | Options |
|--------|------|---------|
| **Rating** | Dropdown | All, Any Rating, ≥1 star, ≥2 stars, ≥3 stars, ≥4 stars, 5 stars only |
| **Likes** | Checkbox | Has likes (show count) |
| **Favorites** | Checkbox | Has favorites (show count) |
| **Comments** | Checkbox | Has comments (show count) |
| **Combine Logic** | Toggle | AND / OR (default: AND) |

#### 1.3 Quick Filter Presets

| Preset | Description | Filter Applied |
|--------|-------------|----------------|
| "Guest Picks" | Photos guests loved | Rating ≥4 OR Likes ≥3 OR Favorites ≥1 |
| "Top Rated" | Highest rated photos | Rating ≥4 stars |
| "Most Popular" | Most liked photos | Sorted by like_count DESC |
| "Client Favorites" | Favorited by guests | Has favorites |

---

### 2. Photo Selection & Batch Actions

#### 2.1 Selection Controls
- Individual photo checkbox selection
- "Select All Filtered" button (selects all photos matching current filter)
- "Select All" button (selects all photos regardless of filter)
- "Deselect All" button
- Selection counter: "23 photos selected"

#### 2.2 Selection Persistence
- Selection persists when changing filters
- Selection cleared on page navigation (with confirmation if >0 selected)

---

### 3. Export Functionality

#### 3.1 Export Button/Menu

```
┌──────────────────────────────┐
│ Export Selection ▼           │
├──────────────────────────────┤
│ 📋 Filename List (TXT)       │  ← Simple text list
│ 📊 Filename List (CSV)       │  ← Spreadsheet compatible
│ 📦 XMP Sidecar Files (ZIP)   │  ← Lightroom/Bridge/C1
│ 🗂️ Original Photos (ZIP)     │  ← Direct file export
│ 📄 Metadata (JSON)           │  ← Programmatic use
│ ──────────────────────────── │
│ ⚙️ Export Settings...        │  ← Configure defaults
└──────────────────────────────┘
```

#### 3.2 Export Formats

##### Format 1: Filename List (TXT)
**Use Case:** Paste into Lightroom's Library Filter to select matching photos

**Output:**
```
IMG_0001.jpg
IMG_0015.jpg
IMG_0023.jpg
IMG_0089.jpg
```

**Lightroom Workflow:**
1. Export TXT from PicPeak
2. In Lightroom: Library → Filter → Text → Filename → Contains
3. Paste comma-separated list: `IMG_0001, IMG_0015, IMG_0023, IMG_0089`
4. Select filtered photos → Add to Collection

##### Format 2: Filename List (CSV)
**Use Case:** Spreadsheet analysis, Photo Mechanic code replacement

**Output:**
```csv
filename,original_filename,rating,likes,favorites,category
Test_Wedding_individual_0001.jpg,IMG_0001.jpg,4.5,12,3,Ceremony
Test_Wedding_individual_0015.jpg,IMG_0015.jpg,5.0,8,5,Reception
Test_Wedding_individual_0023.jpg,IMG_0023.jpg,4.0,15,2,Portraits
```

##### Format 3: XMP Sidecar Files (ZIP)
**Use Case:** Import ratings/labels directly into Lightroom, Bridge, Capture One

**Output Structure:**
```
export_wedding_picks_2026-01-01.zip
├── IMG_0001.xmp
├── IMG_0015.xmp
├── IMG_0023.xmp
└── IMG_0089.xmp
```

**XMP Content Example:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
      xmp:Rating="4"
      xmp:Label="Yellow"
      photoshop:Instructions="Guest Rating: 4.5 stars, 12 likes, 3 favorites">
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">PicPeak Export - Guest Picks</rdf:li>
        </rdf:Alt>
      </dc:description>
      <Iptc4xmpCore:SubjectCode>
        <rdf:Bag>
          <rdf:li>guest-pick</rdf:li>
          <rdf:li>rating-4</rdf:li>
        </rdf:Bag>
      </Iptc4xmpCore:SubjectCode>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
```

**XMP Rating Mapping:**
| PicPeak Rating | XMP Rating | XMP Label |
|----------------|------------|-----------|
| 4.5 - 5.0 | 5 | Red |
| 3.5 - 4.4 | 4 | Yellow |
| 2.5 - 3.4 | 3 | Green |
| 1.5 - 2.4 | 2 | Blue |
| 0.5 - 1.4 | 1 | Purple |
| No rating | 0 | None |

**Lightroom Import Workflow:**
1. Export XMP ZIP from PicPeak
2. Extract to folder containing original RAW/JPEG files
3. In Lightroom: Select photos → Metadata → Read Metadata from Files
4. Ratings and labels appear on photos

##### Format 4: Original Photos (ZIP)
**Use Case:** Direct photo export for clients or backup

**Output Structure:**
```
export_wedding_picks_2026-01-01.zip
├── Ceremony/
│   ├── IMG_0001.jpg
│   └── IMG_0002.jpg
├── Reception/
│   ├── IMG_0015.jpg
│   └── IMG_0016.jpg
└── export_manifest.json
```

**Options:**
- Include/exclude categories subfolder organization
- Include/exclude thumbnails
- Include/exclude metadata JSON
- Quality: Original / High (2048px) / Medium (1024px)

##### Format 5: Metadata JSON
**Use Case:** Programmatic workflows, custom integrations

**Output:**
```json
{
  "export_info": {
    "event_name": "Test Wedding Gallery",
    "event_date": "2026-01-01",
    "exported_at": "2026-01-02T10:30:00Z",
    "filter_applied": {
      "min_rating": 4,
      "has_likes": true,
      "has_favorites": null
    },
    "total_photos": 23
  },
  "photos": [
    {
      "filename": "Test_Wedding_individual_0001.jpg",
      "original_filename": "IMG_0001.jpg",
      "path": "wedding-test-2026-01-01/individual/Test_Wedding_individual_0001.jpg",
      "category": "Ceremony",
      "rating": {
        "average": 4.5,
        "count": 8
      },
      "likes": 12,
      "favorites": 3,
      "comments": 2,
      "dimensions": {
        "width": 5472,
        "height": 3648
      },
      "size_bytes": 4521984,
      "uploaded_at": "2026-01-01T14:30:00Z"
    }
  ]
}
```

---

### 4. Export Settings Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│ Export Settings                                           [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ XMP Sidecar Options                                             │
│ ─────────────────────────────────────────────────────────────── │
│ Filename matching:  ○ PicPeak filename (Test_Wedding_0001.jpg)  │
│                     ● Original filename (IMG_0001.jpg)          │
│                                                                  │
│ Include in XMP:     ☑ Rating (as XMP Rating 1-5)               │
│                     ☑ Color label (based on rating)             │
│                     ☑ Description (feedback summary)            │
│                     ☑ Keywords (guest-pick, category)           │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│ Photo Export Options                                            │
│ ─────────────────────────────────────────────────────────────── │
│ Quality:            ○ Original  ● High (2048px)  ○ Medium       │
│ Organization:       ☑ Group by category                         │
│ Include:            ☑ Metadata JSON  ☐ Thumbnails               │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│ CSV/TXT Options                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Filename format:    ○ PicPeak filename  ● Original filename     │
│ Separator:          ○ Newline  ● Comma  ○ Semicolon             │
│                                                                  │
│                              [Cancel]  [Save as Default]  [OK]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Specification

### 5. API Endpoints

#### 5.1 Get Filtered Photos
```
GET /api/admin/photos/:eventId/filtered
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `min_rating` | number | Minimum average rating (0-5) |
| `max_rating` | number | Maximum average rating (0-5) |
| `has_likes` | boolean | Filter photos with likes |
| `min_likes` | number | Minimum like count |
| `has_favorites` | boolean | Filter photos with favorites |
| `min_favorites` | number | Minimum favorite count |
| `has_comments` | boolean | Filter photos with comments |
| `category_id` | number | Filter by category |
| `logic` | string | 'AND' or 'OR' (default: AND) |
| `sort` | string | 'rating', 'likes', 'favorites', 'date' |
| `order` | string | 'asc' or 'desc' |
| `page` | number | Page number |
| `limit` | number | Photos per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "photos": [...],
    "pagination": {
      "total": 150,
      "filtered": 23,
      "page": 1,
      "limit": 50,
      "pages": 1
    },
    "summary": {
      "with_ratings": 45,
      "with_likes": 78,
      "with_favorites": 23,
      "with_comments": 12
    }
  }
}
```

#### 5.2 Export Photos
```
POST /api/admin/photos/:eventId/export
```

**Request Body:**
```json
{
  "photo_ids": [1, 5, 12, 23, 45],
  "format": "xmp",
  "options": {
    "filename_format": "original",
    "include_rating": true,
    "include_label": true,
    "include_description": true,
    "include_keywords": true
  }
}
```

**Or with filter (export all matching):**
```json
{
  "filter": {
    "min_rating": 4,
    "has_likes": true
  },
  "format": "xmp",
  "options": {...}
}
```

**Response:**
- For small exports: Direct file download
- For large exports: Background job with status polling

```json
{
  "success": true,
  "job_id": "export_abc123",
  "status": "processing",
  "progress": 45,
  "estimated_time": 30
}
```

#### 5.3 Check Export Status
```
GET /api/admin/exports/:jobId/status
```

#### 5.4 Download Export
```
GET /api/admin/exports/:jobId/download
```

---

### 6. Backend Implementation

#### 6.1 New Files

| File | Purpose |
|------|---------|
| `/backend/src/routes/adminPhotoExport.js` | Export API routes |
| `/backend/src/services/photoExportService.js` | Export logic |
| `/backend/src/services/xmpGenerator.js` | XMP file generation |
| `/backend/src/utils/photoFilterBuilder.js` | Query builder for filters |

#### 6.2 XMP Generator Service

```javascript
// /backend/src/services/xmpGenerator.js

class XmpGenerator {
  /**
   * Generate XMP sidecar content for a photo
   */
  generateXmp(photo, options = {}) {
    const rating = this.mapRating(photo.average_rating);
    const label = this.mapLabel(photo.average_rating);

    return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmp:Rating="${rating}"
      ${label ? `xmp:Label="${label}"` : ''}>
      ${this.generateDescription(photo, options)}
      ${this.generateKeywords(photo, options)}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
  }

  mapRating(avgRating) {
    if (!avgRating || avgRating === 0) return 0;
    if (avgRating >= 4.5) return 5;
    if (avgRating >= 3.5) return 4;
    if (avgRating >= 2.5) return 3;
    if (avgRating >= 1.5) return 2;
    return 1;
  }

  mapLabel(avgRating) {
    if (!avgRating || avgRating === 0) return null;
    if (avgRating >= 4.5) return 'Red';      // Top picks
    if (avgRating >= 3.5) return 'Yellow';   // Good
    if (avgRating >= 2.5) return 'Green';    // Average
    if (avgRating >= 1.5) return 'Blue';     // Below average
    return 'Purple';                          // Low
  }

  generateDescription(photo, options) {
    if (!options.include_description) return '';
    const desc = `PicPeak Guest Feedback: ${photo.average_rating?.toFixed(1) || 0} stars, ${photo.like_count || 0} likes, ${photo.favorite_count || 0} favorites`;
    return `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${desc}</rdf:li></rdf:Alt></dc:description>`;
  }

  generateKeywords(photo, options) {
    if (!options.include_keywords) return '';
    const keywords = ['picpeak-export'];
    if (photo.average_rating >= 4) keywords.push('guest-pick');
    if (photo.category_name) keywords.push(photo.category_name.toLowerCase());

    return `<dc:subject><rdf:Bag>${keywords.map(k => `<rdf:li>${k}</rdf:li>`).join('')}</rdf:Bag></dc:subject>`;
  }
}
```

#### 6.3 Export Service

```javascript
// /backend/src/services/photoExportService.js

class PhotoExportService {
  async exportPhotos(eventId, photoIds, format, options) {
    const photos = await this.getPhotosWithFeedback(eventId, photoIds);

    switch (format) {
      case 'txt':
        return this.exportAsTxt(photos, options);
      case 'csv':
        return this.exportAsCsv(photos, options);
      case 'xmp':
        return this.exportAsXmpZip(photos, options);
      case 'photos':
        return this.exportPhotosZip(photos, options);
      case 'json':
        return this.exportAsJson(photos, options);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  async exportAsXmpZip(photos, options) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const xmpGenerator = new XmpGenerator();

    for (const photo of photos) {
      const filename = options.filename_format === 'original'
        ? photo.original_filename
        : photo.filename;
      const xmpFilename = filename.replace(/\.[^.]+$/, '.xmp');
      const xmpContent = xmpGenerator.generateXmp(photo, options);

      archive.append(xmpContent, { name: xmpFilename });
    }

    return archive;
  }

  // ... other export methods
}
```

---

### 7. Frontend Implementation

#### 7.1 New Components

| Component | Purpose |
|-----------|---------|
| `PhotoFilterPanel.tsx` | Filter controls UI |
| `PhotoExportMenu.tsx` | Export dropdown menu |
| `ExportSettingsDialog.tsx` | Export configuration modal |
| `ExportProgressModal.tsx` | Progress indicator for large exports |

#### 7.2 Filter Panel Component

```typescript
// /frontend/src/components/admin/PhotoFilterPanel.tsx

interface PhotoFilters {
  minRating: number | null;
  hasLikes: boolean;
  hasFavorites: boolean;
  hasComments: boolean;
  logic: 'AND' | 'OR';
}

interface PhotoFilterPanelProps {
  filters: PhotoFilters;
  onChange: (filters: PhotoFilters) => void;
  summary: {
    total: number;
    filtered: number;
    withRatings: number;
    withLikes: number;
    withFavorites: number;
  };
}

export const PhotoFilterPanel: React.FC<PhotoFilterPanelProps> = ({
  filters,
  onChange,
  summary
}) => {
  // Component implementation
};
```

#### 7.3 State Management

```typescript
// Use React Query for filtered photos
const useFilteredPhotos = (eventId: string, filters: PhotoFilters) => {
  return useQuery({
    queryKey: ['photos', eventId, 'filtered', filters],
    queryFn: () => photoService.getFilteredPhotos(eventId, filters),
    keepPreviousData: true
  });
};

// Selection state
const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
```

---

### 8. Database Considerations

#### 8.1 Indexing for Filter Performance

```sql
-- Add indexes for common filter queries
CREATE INDEX idx_photos_average_rating ON photos(event_id, average_rating) WHERE average_rating > 0;
CREATE INDEX idx_photos_like_count ON photos(event_id, like_count) WHERE like_count > 0;
CREATE INDEX idx_photos_favorite_count ON photos(event_id, favorite_count) WHERE favorite_count > 0;
```

#### 8.2 Export Jobs Table (for large exports)

```sql
CREATE TABLE export_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(50) UNIQUE NOT NULL,
  event_id INTEGER REFERENCES events(id),
  admin_user_id INTEGER REFERENCES admin_users(id),
  format VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  total_photos INTEGER,
  options JSONB,
  file_path VARCHAR(500),
  file_size BIGINT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

---

## Implementation Checklist

### Phase 1: Backend - Filtering
- [ ] Create `photoFilterBuilder.js` utility
- [ ] Add filtered photos endpoint to admin routes
- [ ] Add database indexes for performance
- [ ] Write unit tests for filter logic

### Phase 2: Backend - Export
- [ ] Create `xmpGenerator.js` service
- [ ] Create `photoExportService.js` service
- [ ] Add export endpoint to admin routes
- [ ] Implement TXT export
- [ ] Implement CSV export
- [ ] Implement XMP ZIP export
- [ ] Implement Photos ZIP export
- [ ] Implement JSON export
- [ ] Add background job support for large exports
- [ ] Write unit tests for export formats

### Phase 3: Frontend - Filter UI
- [ ] Create `PhotoFilterPanel.tsx` component
- [ ] Integrate filter panel into Photos tab
- [ ] Add filter state management
- [ ] Implement filter summary display
- [ ] Add preset filter buttons

### Phase 4: Frontend - Selection
- [ ] Add photo selection checkboxes
- [ ] Implement "Select All Filtered" functionality
- [ ] Add selection counter
- [ ] Persist selection across filter changes

### Phase 5: Frontend - Export
- [ ] Create `PhotoExportMenu.tsx` component
- [ ] Create `ExportSettingsDialog.tsx` component
- [ ] Create `ExportProgressModal.tsx` component
- [ ] Integrate export functionality
- [ ] Handle download responses

### Phase 6: Testing & Documentation
- [ ] End-to-end testing with real Lightroom import
- [ ] Test Capture One XMP compatibility
- [ ] Test with large photo sets (500+ photos)
- [ ] Document workflow guides for users
- [ ] Update API documentation

---

## Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Filter by rating ≥4 stars | Only high-rated photos shown |
| 2 | Filter by likes AND favorites | Photos with both shown |
| 3 | Filter by likes OR favorites | Photos with either shown |
| 4 | Export XMP for 10 photos | ZIP with 10 .xmp files |
| 5 | Import XMP into Lightroom | Ratings appear on matched photos |
| 6 | Export TXT list | Newline-separated filename list |
| 7 | Export large set (500 photos) | Background job with progress |

---

## Acceptance Criteria

1. ✅ Admin can filter photos by rating threshold
2. ✅ Admin can filter photos by likes/favorites/comments
3. ✅ Admin can combine filters with AND/OR logic
4. ✅ Filter counts shown in UI
5. ✅ Admin can select individual or all filtered photos
6. ✅ Export menu shows all format options
7. ✅ TXT export contains filename list
8. ✅ CSV export contains metadata columns
9. ✅ XMP export creates valid sidecar files
10. ✅ XMP files import correctly into Lightroom
11. ✅ ZIP export includes organized photos
12. ✅ Large exports show progress indicator
13. ✅ Export settings can be customized

---

## Security Considerations

1. Admin authentication required for all endpoints
2. Event ownership validation before export
3. Rate limiting on export endpoints
4. Temporary file cleanup after download
5. No sensitive data in exported files

---

## Related Files

### Backend
- `/backend/src/routes/adminPhotos.js` - Existing photo routes
- `/backend/src/routes/adminFeedback.js` - Existing feedback export
- `/backend/src/services/feedbackService.js` - Feedback queries

### Frontend
- `/frontend/src/components/admin/EventPhotos.tsx` - Photos tab
- `/frontend/src/components/admin/PhotoGrid.tsx` - Photo display
- `/frontend/src/services/photoService.ts` - Photo API service

---

## Future Enhancements

1. **Scheduled exports**: Auto-export daily/weekly
2. **Email delivery**: Send export to admin email
3. **Cloud storage**: Export directly to Dropbox/Google Drive
4. **Custom XMP templates**: User-defined XMP structures
5. **Batch operations**: Apply ratings/labels in bulk from PicPeak
6. **Two-way sync**: Import ratings back from Lightroom
