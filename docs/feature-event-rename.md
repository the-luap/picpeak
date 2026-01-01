# Feature: Event Rename

## Overview

This feature allows administrators to rename gallery events from the admin panel. When an event is renamed, all associated resources (database records, file system folders, photo paths, and URLs) are updated to reflect the new name.

## User Story

As an administrator, I want to rename a gallery event so that I can correct typos, update event names after changes, or better organize my galleries while maintaining data integrity.

---

## Feature Requirements

### 1. UI Components

#### 1.1 Rename Button
- **Location**: Event detail page (next to "Edit" button)
- **Label**: "Rename Event" or icon with tooltip
- **Visibility**: Always visible for active (non-archived) events
- **Disabled state**: During rename operation or for archived events

#### 1.2 Rename Dialog/Modal
- **Trigger**: Click on "Rename Event" button
- **Components**:
  - Header: "Rename Event"
  - Current name display (read-only, for reference)
  - Text input field for new event name
    - Pre-filled with current name
    - Validation: Required, min 3 characters, max 100 characters
    - Real-time preview of new slug
  - Checkbox: "Resend invitation email with new gallery link"
    - Default: Unchecked
    - Helper text: "Send updated gallery access email to {customer_email}"
  - Cancel button
  - Confirm button ("Rename Event")

#### 1.3 Progress/Status Indicator
- **Display**: Replace dialog content during operation
- **States**:
  1. "Validating new name..."
  2. "Renaming files..."
  3. "Updating database..."
  4. "Updating photo records..."
  5. "Sending email..." (if checkbox selected)
  6. "Complete!"
- **Error state**: Show error message with retry option

#### 1.4 Post-Rename Redirect
- After successful rename, redirect to: `/admin/events/{eventId}`
- Show success toast notification: "Event renamed successfully"
- If email sent: "Event renamed and invitation email sent"

---

## Technical Specification

### 2. Database Changes

#### 2.1 Events Table Updates
```sql
UPDATE events SET
  event_name = :newEventName,
  slug = :newSlug,
  share_link = :newShareLink,
  updated_at = NOW()
WHERE id = :eventId;
```

#### 2.2 Photos Table Updates
```sql
UPDATE photos SET
  path = REPLACE(path, :oldSlug, :newSlug),
  thumbnail_path = REPLACE(thumbnail_path, :oldSlug, :newSlug),
  updated_at = NOW()
WHERE event_id = :eventId;
```

#### 2.3 New Table: Slug Redirects (Optional - for backward compatibility)
```sql
CREATE TABLE slug_redirects (
  id SERIAL PRIMARY KEY,
  old_slug VARCHAR(255) NOT NULL UNIQUE,
  new_slug VARCHAR(255) NOT NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_slug_redirects_old_slug ON slug_redirects(old_slug);
```

#### 2.4 Activity Log Entry
```sql
INSERT INTO activity_logs (
  event_id, action, details, created_at
) VALUES (
  :eventId,
  'event_renamed',
  '{"old_name": "...", "new_name": "...", "old_slug": "...", "new_slug": "...", "email_sent": true/false}',
  NOW()
);
```

---

### 3. File System Changes

#### 3.1 Folder Rename
```
Source: /storage/events/active/{oldSlug}/
Target: /storage/events/active/{newSlug}/
```

#### 3.2 Photo File Rename (within folder)
```
Source: {OldEventName}_individual_0001.jpg
Target: {NewEventName}_individual_0001.jpg
```

#### 3.3 Thumbnail Updates
Thumbnails are stored alongside photos - paths updated via database

#### 3.4 Rollback Strategy
1. Create backup of folder structure before rename
2. If any step fails, restore from backup
3. Use atomic operations where possible

---

### 4. API Endpoints

#### 4.1 Rename Event
```
POST /api/admin/events/:eventId/rename
```

**Request Body:**
```json
{
  "newEventName": "New Wedding Gallery Name",
  "resendEmail": true
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Event renamed successfully",
  "data": {
    "eventId": 1,
    "oldName": "Test Wedding Gallery",
    "newName": "New Wedding Gallery Name",
    "oldSlug": "wedding-test-wedding-gallery-2026-01-01",
    "newSlug": "wedding-new-wedding-gallery-name-2026-01-01",
    "newShareLink": "/gallery/wedding-new-wedding-gallery-name-2026-01-01/abc123...",
    "emailSent": true,
    "filesRenamed": 3
  }
}
```

**Response (Error - 400/500):**
```json
{
  "success": false,
  "error": "Event name already exists for this date",
  "code": "DUPLICATE_SLUG"
}
```

#### 4.2 Validate New Name (Optional - for real-time validation)
```
POST /api/admin/events/:eventId/validate-rename
```

**Request Body:**
```json
{
  "newEventName": "New Wedding Gallery Name"
}
```

**Response:**
```json
{
  "valid": true,
  "newSlug": "wedding-new-wedding-gallery-name-2026-01-01",
  "conflicts": []
}
```

---

### 5. Backend Implementation

#### 5.1 New Route File
**Location**: `/backend/src/routes/adminEventRename.js`

#### 5.2 New Service File
**Location**: `/backend/src/services/eventRenameService.js`

**Service Methods:**
```javascript
class EventRenameService {
  // Validate new name and check for conflicts
  async validateRename(eventId, newEventName)

  // Generate new slug from name
  generateSlug(eventType, eventName, eventDate)

  // Rename event folder on filesystem
  async renameEventFolder(oldSlug, newSlug)

  // Rename individual photo files
  async renamePhotoFiles(eventId, oldName, newName)

  // Update database records (events + photos)
  async updateDatabaseRecords(eventId, oldSlug, newSlug, newName)

  // Store old slug redirect
  async createSlugRedirect(eventId, oldSlug, newSlug)

  // Main orchestration method
  async renameEvent(eventId, newEventName, resendEmail)

  // Rollback on failure
  async rollbackRename(eventId, backupData)
}
```

#### 5.3 Transaction Handling
```javascript
async renameEvent(eventId, newEventName, resendEmail) {
  const trx = await db.transaction();
  const backupData = {};

  try {
    // 1. Validate
    const validation = await this.validateRename(eventId, newEventName);
    if (!validation.valid) throw new Error(validation.error);

    // 2. Get current event data
    const event = await trx('events').where({ id: eventId }).first();
    backupData.event = event;

    // 3. Generate new slug
    const newSlug = this.generateSlug(event.event_type, newEventName, event.event_date);

    // 4. Rename folder (filesystem)
    await this.renameEventFolder(event.slug, newSlug);
    backupData.folderRenamed = true;

    // 5. Rename photo files
    const renamedFiles = await this.renamePhotoFiles(eventId, event.event_name, newEventName);
    backupData.renamedFiles = renamedFiles;

    // 6. Update database
    await this.updateDatabaseRecords(trx, eventId, event.slug, newSlug, newEventName);

    // 7. Create redirect entry
    await this.createSlugRedirect(trx, eventId, event.slug, newSlug);

    // 8. Commit transaction
    await trx.commit();

    // 9. Send email (after commit, non-critical)
    if (resendEmail && event.customer_email) {
      await this.sendRenamedEventEmail(eventId);
    }

    return { success: true, newSlug, ... };

  } catch (error) {
    await trx.rollback();
    await this.rollbackRename(backupData);
    throw error;
  }
}
```

---

### 6. Frontend Implementation

#### 6.1 New Components
**Location**: `/frontend/src/components/admin/`

- `EventRenameButton.tsx` - Button component
- `EventRenameDialog.tsx` - Modal dialog with form
- `RenameProgressIndicator.tsx` - Status display during operation

#### 6.2 New Service Method
**Location**: `/frontend/src/services/eventService.ts`

```typescript
interface RenameEventRequest {
  newEventName: string;
  resendEmail: boolean;
}

interface RenameEventResponse {
  success: boolean;
  message: string;
  data: {
    eventId: number;
    oldName: string;
    newName: string;
    oldSlug: string;
    newSlug: string;
    newShareLink: string;
    emailSent: boolean;
    filesRenamed: number;
  };
}

export const renameEvent = async (
  eventId: number,
  request: RenameEventRequest
): Promise<RenameEventResponse> => {
  const response = await api.post(`/admin/events/${eventId}/rename`, request);
  return response.data;
};
```

#### 6.3 State Management
- Use React Query mutation for rename operation
- Invalidate event queries on success
- Handle optimistic updates if needed

---

### 7. Email Template Updates

#### 7.1 New/Updated Template
**Template**: Gallery link updated notification

**Subject**: "Your gallery link has been updated - {event_name}"

**Content**:
```
Hello {customer_name},

The gallery for {event_name} has been updated with a new link.

Your new gallery access link:
{new_gallery_url}

Password: (unchanged)

The previous link will automatically redirect to the new location.

Best regards,
{admin_name}
```

---

### 8. Slug Redirect Handling

#### 8.1 Gallery Route Update
**Location**: `/backend/src/routes/gallery.js`

```javascript
// Check for slug redirect before 404
router.get('/:slugOrToken/:token?', async (req, res) => {
  let event = await findEventBySlug(req.params.slugOrToken);

  if (!event) {
    // Check redirect table
    const redirect = await db('slug_redirects')
      .where({ old_slug: req.params.slugOrToken })
      .first();

    if (redirect) {
      // Redirect to new slug
      const newUrl = `/gallery/${redirect.new_slug}/${req.params.token || ''}`;
      return res.redirect(301, newUrl);
    }
  }

  // Continue with normal flow...
});
```

---

## Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Create database migration for `slug_redirects` table
- [ ] Create `eventRenameService.js` with core logic
- [ ] Create `adminEventRename.js` route file
- [ ] Add rename endpoint to admin routes
- [ ] Implement file system rename operations
- [ ] Add rollback mechanism
- [ ] Write unit tests for rename service

### Phase 2: Frontend UI
- [ ] Create `EventRenameButton.tsx` component
- [ ] Create `EventRenameDialog.tsx` modal component
- [ ] Create `RenameProgressIndicator.tsx` component
- [ ] Add rename service method to `eventService.ts`
- [ ] Integrate rename button into event detail page
- [ ] Add form validation
- [ ] Handle loading/error states
- [ ] Implement redirect after success

### Phase 3: Email Integration
- [ ] Create/update email template for renamed events
- [ ] Add email sending logic to rename service
- [ ] Test email delivery

### Phase 4: Redirect Support
- [ ] Update gallery route to check slug_redirects
- [ ] Add redirect logging for analytics
- [ ] Test old URLs redirect correctly

### Phase 5: Testing & Polish
- [ ] End-to-end testing with Chrome DevTools
- [ ] Test error scenarios and rollback
- [ ] Test with events containing many photos
- [ ] Performance testing
- [ ] Update API documentation

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File rename fails mid-operation | Medium | High | Transaction + rollback mechanism |
| Duplicate slug collision | Low | Medium | Pre-validation + counter suffix |
| Old bookmarked URLs break | High | Medium | Slug redirect table |
| Email send fails | Low | Low | Non-blocking, log error, notify admin |
| Large events slow to rename | Medium | Low | Progress indicator, async processing |

---

## Security Considerations

1. **Authorization**: Only admin users can rename events
2. **Input validation**: Sanitize new event name, prevent path traversal
3. **Rate limiting**: Prevent abuse of rename endpoint
4. **Audit logging**: Log all rename operations with before/after state

---

## Future Enhancements

1. **Bulk rename**: Rename multiple events at once
2. **Rename history**: View previous names of an event
3. **Undo rename**: Revert to previous name within time window
4. **Scheduled rename**: Set future date for rename to take effect

---

## Related Files

### Backend
- `/backend/src/routes/adminEvents.js` - Existing event routes
- `/backend/src/routes/gallery.js` - Gallery public routes
- `/backend/src/services/photoProcessor.js` - Photo handling
- `/backend/src/utils/filenameSanitizer.js` - Name sanitization
- `/backend/src/utils/shareLinkUtils.js` - Share link generation

### Frontend
- `/frontend/src/components/admin/EventDetails.tsx` - Event detail page
- `/frontend/src/services/eventService.ts` - Event API service
- `/frontend/src/components/admin/EventForm.tsx` - Event form components

### Database
- `/backend/migrations/` - Migration files
- `/backend/src/database/db.js` - Database schema

---

## Acceptance Criteria

1. Admin can click "Rename Event" button on event detail page
2. Rename dialog shows current name and input for new name
3. New slug preview is shown as user types
4. Checkbox option to resend invitation email
5. Progress indicator shows rename steps
6. All files are renamed on filesystem
7. All database records are updated
8. Old gallery URLs redirect to new URLs (301)
9. Admin is redirected to event page after success
10. Success/error notifications are displayed
11. If email checkbox selected, customer receives email with new link
12. Operation can be cancelled before confirmation
13. Archived events cannot be renamed
