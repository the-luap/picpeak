# Test Specification: Event Rename Feature

## Overview
This document specifies the test cases for the Event Rename feature, which allows administrators to rename events from the admin panel.

---

## Test Environment
- **URL**: http://localhost:7100
- **Admin Credentials**: admin / AdminTest@2026!
- **Prerequisites**: At least one active (non-archived) event with photos

---

## Test Cases

### TC-RN-001: Access Rename Dialog
**Description**: Verify the Rename button is visible and opens the rename dialog

**Steps**:
1. Login to admin panel
2. Navigate to an active event's detail page
3. Verify "Rename" button is visible in the header action buttons
4. Click the "Rename" button
5. Verify rename dialog opens

**Expected Results**:
- Rename button visible next to Edit button
- Dialog opens with current event name pre-filled
- Dialog shows input field for new name

---

### TC-RN-002: Validate New Name - Too Short
**Description**: Verify validation error for names shorter than 3 characters

**Steps**:
1. Open rename dialog for an event
2. Enter a name with 2 characters (e.g., "AB")
3. Observe validation state

**Expected Results**:
- Rename button remains disabled
- No API call made for validation

---

### TC-RN-003: Validate New Name - Same as Current
**Description**: Verify error when new name generates same slug as current

**Steps**:
1. Open rename dialog for an event
2. Enter the same name as current (or minor variation that results in same slug)
3. Wait for validation

**Expected Results**:
- Error message: "New name generates the same URL as the current name"
- Rename button disabled

---

### TC-RN-004: Validate New Name - Duplicate Slug
**Description**: Verify error when new name would conflict with existing event

**Steps**:
1. Create two events with different names on the same date
2. Open rename dialog for event A
3. Enter event B's name
4. Wait for validation

**Expected Results**:
- Error message: "An event with this name already exists for the same date"
- Rename button disabled

---

### TC-RN-005: Validate New Name - Valid
**Description**: Verify successful validation of a valid new name

**Steps**:
1. Open rename dialog for an event
2. Enter a valid, unique new name (at least 3 characters)
3. Wait for validation

**Expected Results**:
- New URL preview shown in green box
- Rename button becomes enabled
- No error messages

---

### TC-RN-006: Successful Rename
**Description**: Verify complete rename operation

**Steps**:
1. Open rename dialog for an event with photos
2. Enter a valid new name
3. Wait for validation to complete
4. Click "Rename Event" button
5. Wait for operation to complete

**Expected Results**:
- Progress indicator shown during operation
- Success message displayed
- New share link shown
- Files renamed count displayed
- Event name updated in UI
- Share link updated

---

### TC-RN-007: Rename with Email Notification
**Description**: Verify rename with email notification option

**Steps**:
1. Open rename dialog for event with customer email
2. Enter valid new name
3. Check "Resend invitation email with new gallery link" checkbox
4. Click "Rename Event"
5. Wait for completion

**Expected Results**:
- Operation completes successfully
- Email sent confirmation shown
- (If SMTP configured) Email received with new link

---

### TC-RN-008: Old URL Redirects to New URL
**Description**: Verify old gallery URLs redirect to new location

**Steps**:
1. Note the current gallery share link before rename
2. Rename the event
3. Try to access the old share link
4. Verify redirect to new URL

**Expected Results**:
- Old URL returns 301 redirect response
- Browser redirects to new gallery URL
- Gallery is accessible at new URL

---

### TC-RN-009: Archived Events Cannot Be Renamed
**Description**: Verify rename button is not available for archived events

**Steps**:
1. Navigate to an archived event's detail page
2. Check for Rename button presence

**Expected Results**:
- Rename button is NOT visible
- Only archive-related actions available

---

### TC-RN-010: Rename Dialog Cancel
**Description**: Verify cancel functionality in rename dialog

**Steps**:
1. Open rename dialog
2. Enter a new name
3. Click Cancel button
4. Verify dialog closes
5. Verify event name unchanged

**Expected Results**:
- Dialog closes
- No changes made to event
- Event name remains original

---

### TC-RN-011: Rename Dialog Close (X Button)
**Description**: Verify X button closes dialog without changes

**Steps**:
1. Open rename dialog
2. Enter a new name
3. Click X button in top-right
4. Verify dialog closes
5. Verify event name unchanged

**Expected Results**:
- Dialog closes
- No changes made to event

---

### TC-RN-012: Photo File Paths Updated
**Description**: Verify photo file paths are updated after rename

**Steps**:
1. Create event with photos
2. Note photo paths in database
3. Rename the event
4. Verify photos are still accessible
5. Check photo paths in database

**Expected Results**:
- All photos remain accessible
- Photo paths updated to reflect new slug
- Thumbnails still work

---

### TC-RN-013: Activity Log Entry Created
**Description**: Verify rename operation is logged

**Steps**:
1. Rename an event
2. Check activity logs in database or admin panel

**Expected Results**:
- Activity log entry created with type "event_renamed"
- Metadata includes old name, new name, old slug, new slug
- Actor information recorded

---

## API Test Cases

### TC-RN-API-001: POST /api/admin/events/:id/rename
**Description**: Test rename API endpoint

**Request**:
```json
{
  "newEventName": "New Event Name",
  "resendEmail": false
}
```

**Expected Response (200)**:
```json
{
  "success": true,
  "message": "Event renamed successfully",
  "data": {
    "eventId": 1,
    "oldName": "Old Event Name",
    "newName": "New Event Name",
    "oldSlug": "wedding-old-event-name-2026-01-01",
    "newSlug": "wedding-new-event-name-2026-01-01",
    "newShareLink": "/gallery/wedding-new-event-name-2026-01-01/abc123...",
    "emailSent": false,
    "filesRenamed": 3
  }
}
```

---

### TC-RN-API-002: POST /api/admin/events/:id/validate-rename
**Description**: Test rename validation endpoint

**Request**:
```json
{
  "newEventName": "New Event Name"
}
```

**Expected Response (200)**:
```json
{
  "valid": true,
  "newSlug": "wedding-new-event-name-2026-01-01"
}
```

---

### TC-RN-API-003: Rename Requires Authentication
**Description**: Verify API requires admin authentication

**Steps**:
1. Call rename endpoint without auth token
2. Call rename endpoint with invalid token

**Expected Results**:
- 401 Unauthorized response

---

## Database Verification

### TC-RN-DB-001: Events Table Updated
After successful rename, verify:
- `event_name` updated to new name
- `slug` updated to new slug
- `share_link` updated with new slug

### TC-RN-DB-002: Photos Table Updated
After successful rename, verify:
- `path` column updated for all event photos
- `thumbnail_path` column updated for all event photos

### TC-RN-DB-003: Slug Redirects Table Populated
After successful rename, verify:
- Entry created in `slug_redirects` table
- `old_slug` contains previous slug
- `new_slug` contains new slug
- `event_id` references correct event

---

## Error Handling

### TC-RN-ERR-001: Database Error During Rename
**Description**: Verify rollback on database error

**Expected Behavior**:
- File system changes rolled back
- Original event state preserved
- Error message returned to user

### TC-RN-ERR-002: File System Error During Rename
**Description**: Verify handling of file system errors

**Expected Behavior**:
- Transaction rolled back
- Error message returned to user
- Event remains unchanged

---

## Performance

### TC-RN-PERF-001: Rename Large Event
**Description**: Verify performance with events containing many photos

**Steps**:
1. Create event with 100+ photos
2. Rename the event
3. Measure time taken

**Expected Results**:
- Operation completes within reasonable time
- Progress indicator keeps user informed
- All photos remain accessible
