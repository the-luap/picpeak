# Test Specification: Photo Filtering & Export

This document specifies the test cases for the Photo Filtering & Export feature, which allows administrators to filter photos by guest feedback and export filtered selections in various formats.

## Prerequisites

- Local Docker environment running (`docker-compose up`)
- Access to admin dashboard
- Event with photos that have feedback (ratings, likes, favorites, comments)
- Backend migrations applied (051_add_photo_filter_indexes.js)

## Test Cases

### 1. Filter Panel UI

#### TC-PFE-001: Filter Panel Visibility
**Steps:**
1. Navigate to Event Details > Photos tab
2. Verify "Feedback Filters" panel is visible

**Expected Result:**
- Filter panel shows rating dropdown
- Checkboxes for: Has likes, Has favorites, Has comments
- Summary counts displayed

#### TC-PFE-002: Rating Filter Options
**Steps:**
1. Open the Rating dropdown in filter panel
2. Verify all rating options are present

**Expected Result:**
- Options: All photos, Any rating, 1+ stars, 2+ stars, 3+ stars, 4+ stars, 5 stars only
- Dropdown is functional

#### TC-PFE-003: Filter by Rating
**Steps:**
1. Select "4+ stars" from rating dropdown
2. Observe changes

**Expected Result:**
- Filter is applied
- Export menu becomes enabled (if photos match)

#### TC-PFE-004: Filter by Likes
**Steps:**
1. Check "Has likes" checkbox
2. Observe changes

**Expected Result:**
- Count shows number of photos with likes
- Filter is applied

#### TC-PFE-005: Filter by Favorites
**Steps:**
1. Check "Has favorites" checkbox
2. Observe changes

**Expected Result:**
- Count shows number of favorited photos
- Filter is applied

#### TC-PFE-006: Filter by Comments
**Steps:**
1. Check "Has comments" checkbox
2. Observe changes

**Expected Result:**
- Count shows number of commented photos
- Filter is applied

#### TC-PFE-007: AND/OR Logic Toggle
**Steps:**
1. Check multiple feedback filters (e.g., Has likes AND Has favorites)
2. Toggle between AND and OR
3. Observe export button state

**Expected Result:**
- AND: Photos must have both likes AND favorites
- OR: Photos can have likes OR favorites
- Toggle is visible when multiple filters selected

#### TC-PFE-008: Clear Filters
**Steps:**
1. Apply multiple filters
2. Click "Clear" button

**Expected Result:**
- All filters reset to default
- Rating dropdown shows "All photos"
- All checkboxes unchecked

### 2. Export Menu

#### TC-PFE-009: Export Menu Disabled State
**Steps:**
1. Clear all feedback filters
2. Ensure no photos are selected
3. Observe Export button

**Expected Result:**
- Export button is disabled
- Hint text: "Select photos or apply filters to export"

#### TC-PFE-010: Export Menu Enabled with Filters
**Steps:**
1. Apply a feedback filter (e.g., rating >= 3)
2. Observe Export button

**Expected Result:**
- Export button becomes enabled
- Dropdown shows export format options

#### TC-PFE-011: Export Format Options
**Steps:**
1. Enable Export button with filters
2. Click to open dropdown

**Expected Result:**
- Four format options visible:
  - Filename List (TXT)
  - Filename List (CSV)
  - XMP Sidecar Files (ZIP)
  - Metadata (JSON)
- Each has description text

### 3. Export Functionality

#### TC-PFE-012: Export TXT Format
**Steps:**
1. Apply filter (e.g., has favorites)
2. Click Export > Filename List (TXT)
3. Open downloaded file

**Expected Result:**
- File downloads with .txt extension
- Contains one filename per line
- Uses original filenames (e.g., IMG_0001.jpg)

#### TC-PFE-013: Export CSV Format
**Steps:**
1. Apply filter
2. Click Export > Filename List (CSV)
3. Open in spreadsheet

**Expected Result:**
- File downloads with .csv extension
- Headers: filename, original_filename, rating, rating_count, likes, favorites, comments, category, etc.
- Data rows for each filtered photo

#### TC-PFE-014: Export XMP Format
**Steps:**
1. Apply filter
2. Click Export > XMP Sidecar Files (ZIP)
3. Extract ZIP and inspect files

**Expected Result:**
- ZIP file downloads
- Contains .xmp files for each photo
- XMP files contain:
  - xmp:Rating (1-5)
  - xmp:Label (color)
  - Description with feedback summary
  - Keywords including "picpeak-export"

#### TC-PFE-015: Export JSON Format
**Steps:**
1. Apply filter
2. Click Export > Metadata (JSON)
3. Open/parse JSON file

**Expected Result:**
- JSON file downloads
- Contains export_info (event name, date, exported_at, total_photos)
- Contains photos array with full metadata

#### TC-PFE-016: XMP Rating Mapping
**Steps:**
1. Have photos with various ratings
2. Export XMP
3. Check xmp:Rating values

**Expected Result:**
- 4.5-5.0 stars → xmp:Rating="5", Label="Red"
- 3.5-4.4 stars → xmp:Rating="4", Label="Yellow"
- 2.5-3.4 stars → xmp:Rating="3", Label="Green"
- 1.5-2.4 stars → xmp:Rating="2", Label="Blue"
- 0.5-1.4 stars → xmp:Rating="1", Label="Purple"

### 4. Backend API Tests

#### TC-PFE-017: Filtered Photos Endpoint
**Steps:**
1. Call API: `GET /api/admin/photo-export/:eventId/filtered?min_rating=4&has_likes=true`

**Expected Result:**
- Returns 200 OK
- Response includes photos, pagination, and summary
- Only photos matching filter returned

#### TC-PFE-018: Filter Summary Endpoint
**Steps:**
1. Call API: `GET /api/admin/photo-export/:eventId/filter-summary`

**Expected Result:**
- Returns 200 OK
- Response includes: total, withRatings, withLikes, withFavorites, withComments

#### TC-PFE-019: Export Endpoint with Photo IDs
**Steps:**
1. Call API: `POST /api/admin/photo-export/:eventId/export`
   Body: `{ "photo_ids": [1, 2, 3], "format": "csv" }`

**Expected Result:**
- Returns CSV file
- Contains only specified photos

#### TC-PFE-020: Export Endpoint with Filters
**Steps:**
1. Call API: `POST /api/admin/photo-export/:eventId/export`
   Body: `{ "filter": { "minRating": 4 }, "format": "txt" }`

**Expected Result:**
- Returns TXT file
- Contains all photos matching filter

### 5. Edge Cases

#### TC-PFE-021: Empty Filter Results
**Steps:**
1. Apply filter that matches no photos (e.g., rating = 5 when no 5-star photos exist)
2. Try to export

**Expected Result:**
- Export button disabled or shows "0 photos"
- Error message if attempting export

#### TC-PFE-022: Large Export
**Steps:**
1. Filter to include 100+ photos
2. Export as XMP ZIP

**Expected Result:**
- Export completes (may take time)
- ZIP contains all matching .xmp files
- Loading indicator shown during export

#### TC-PFE-023: Special Characters in Filenames
**Steps:**
1. Have photo with special characters in original filename
2. Export CSV

**Expected Result:**
- Filename properly escaped in CSV
- No parsing errors

### 6. Integration Tests

#### TC-PFE-024: XMP Import to Lightroom
**Steps:**
1. Export XMP files
2. Place XMP files next to original photos
3. In Lightroom: Select photos > Metadata > Read Metadata from Files

**Expected Result:**
- Lightroom reads XMP files
- Ratings appear on photos
- Color labels applied
- Keywords visible in metadata panel

#### TC-PFE-025: TXT List in Lightroom Search
**Steps:**
1. Export TXT filename list
2. In Lightroom: Library > Filter > Text > Filename > Contains
3. Paste comma-separated list

**Expected Result:**
- Lightroom filters to matching files
- Can select and add to collection

### 7. Performance Tests

#### TC-PFE-026: Filter Performance
**Steps:**
1. Event with 500+ photos
2. Apply feedback filter
3. Measure response time

**Expected Result:**
- Filter applied within 2 seconds
- UI remains responsive

#### TC-PFE-027: Export Performance
**Steps:**
1. Export 200 photos as XMP ZIP
2. Measure download time

**Expected Result:**
- Export completes within reasonable time
- Progress indicator shown for large exports

## Automated Testing Notes

For Playwright tests:
1. Login to admin dashboard
2. Navigate to an event with photos
3. Go to Photos tab
4. Manipulate filter panel controls
5. Click export menu
6. Verify file downloads
7. For API tests, use direct fetch/axios calls

## Files Modified

### Backend
- `/backend/migrations/core/051_add_photo_filter_indexes.js`
- `/backend/src/utils/photoFilterBuilder.js`
- `/backend/src/services/xmpGenerator.js`
- `/backend/src/services/photoExportService.js`
- `/backend/src/routes/adminPhotoExport.js`
- `/backend/server.js`

### Frontend
- `/frontend/src/services/photos.service.ts`
- `/frontend/src/components/admin/PhotoFilterPanel.tsx`
- `/frontend/src/components/admin/PhotoExportMenu.tsx`
- `/frontend/src/components/admin/index.ts`
- `/frontend/src/pages/admin/EventDetailsPage.tsx`
