# Test Specification: Optional Event Fields

This document specifies the test cases for the Optional Event Fields feature, which allows administrators to configure whether customer name, customer email, and admin email are required when creating events.

## Prerequisites

- Local Docker environment running (`docker-compose up`)
- Access to admin dashboard
- Backend migrations applied

## Test Cases

### 1. Settings Page - Event Creation Tab

#### TC-OEF-001: Event Creation Tab Visibility
**Steps:**
1. Navigate to Settings page (`/admin/settings`)
2. Verify "Event Creation" tab is visible

**Expected Result:**
- Tab labeled "Event Creation" or similar should be present in the settings navigation

#### TC-OEF-002: Default Field Requirements
**Steps:**
1. Navigate to Settings > Event Creation tab
2. Check initial state of all three toggles

**Expected Result:**
- "Require Customer Name" toggle is ON (enabled)
- "Require Customer Email" toggle is ON (enabled)
- "Require Admin Email" toggle is ON (enabled)

#### TC-OEF-003: Toggle Customer Name Requirement
**Steps:**
1. Navigate to Settings > Event Creation
2. Toggle OFF "Require Customer Name"
3. Click Save

**Expected Result:**
- Setting saves successfully
- Toast notification confirms save
- Toggle remains OFF after page refresh

#### TC-OEF-004: Toggle Customer Email Requirement
**Steps:**
1. Navigate to Settings > Event Creation
2. Toggle OFF "Require Customer Email"
3. Click Save

**Expected Result:**
- Setting saves successfully
- Warning message about email functionality is shown
- Toggle remains OFF after page refresh

#### TC-OEF-005: Toggle Admin Email Requirement
**Steps:**
1. Navigate to Settings > Event Creation
2. Toggle OFF "Require Admin Email"
3. Click Save

**Expected Result:**
- Setting saves successfully
- Warning message about notifications is shown
- Toggle remains OFF after page refresh

### 2. Create Event Form - Conditional Validation

#### TC-OEF-006: All Fields Required (Default)
**Steps:**
1. Ensure all three settings are ON in Settings > Event Creation
2. Navigate to Create Event page
3. Try to submit form without filling customer name, customer email, or admin email

**Expected Result:**
- Validation errors shown for all three empty fields
- Form does not submit

#### TC-OEF-007: Customer Name Optional
**Steps:**
1. Set "Require Customer Name" to OFF in Settings
2. Navigate to Create Event page
3. Verify Host Name field label shows "(optional)"
4. Submit form without customer name (but with required fields filled)

**Expected Result:**
- Host Name label shows "(optional)" suffix
- Form submits successfully without customer name
- Event is created

#### TC-OEF-008: Customer Email Optional
**Steps:**
1. Set "Require Customer Email" to OFF in Settings
2. Navigate to Create Event page
3. Verify Host Email field label shows "(optional)"
4. Submit form without customer email (but with required fields filled)

**Expected Result:**
- Host Email label shows "(optional)" suffix
- Form submits successfully without customer email
- Event is created

#### TC-OEF-009: Admin Email Optional
**Steps:**
1. Set "Require Admin Email" to OFF in Settings
2. Navigate to Create Event page
3. Verify Admin Email field label shows "(optional)"
4. Submit form without admin email (but with required fields filled)

**Expected Result:**
- Admin Email label shows "(optional)" suffix
- Form submits successfully without admin email
- Event is created

#### TC-OEF-010: All Fields Optional
**Steps:**
1. Set all three settings to OFF in Settings
2. Navigate to Create Event page
3. Submit form with only event name, date, and password

**Expected Result:**
- All three optional fields show "(optional)" suffix
- Form submits successfully
- Event is created with null/empty contact fields

### 3. Backend Validation

#### TC-OEF-011: Backend Respects Settings
**Steps:**
1. Set "Require Customer Email" to OFF
2. Make direct API call to create event without customer_email:
   ```
   POST /api/admin/events
   { event_name: "Test", event_date: "2025-01-15", ... }
   ```

**Expected Result:**
- API accepts the request
- Returns 201 Created
- Event is created without customer_email

#### TC-OEF-012: Backend Rejects When Required
**Steps:**
1. Set "Require Customer Email" to ON
2. Make direct API call to create event without customer_email

**Expected Result:**
- API rejects the request
- Returns 400 Bad Request with validation error
- Error message indicates customer_email is required

### 4. Format Validation for Optional Fields

#### TC-OEF-013: Invalid Email Format Still Rejected
**Steps:**
1. Set "Require Customer Email" to OFF
2. Navigate to Create Event page
3. Enter invalid email format (e.g., "notanemail")
4. Submit form

**Expected Result:**
- Validation error for invalid email format
- Form does not submit
- Error message: "Invalid email format"

### 5. Create Event Enhanced Page

#### TC-OEF-014: Enhanced Page Respects Settings
**Steps:**
1. Set all three settings to OFF
2. Navigate to enhanced Create Event page (`/admin/events/create`)
3. Verify all three fields show "(optional)"
4. Submit form without contact fields

**Expected Result:**
- All optional labels visible
- Form submits successfully
- Event is created

### 6. Settings Persistence

#### TC-OEF-015: Settings Persist Across Sessions
**Steps:**
1. Set specific combination (e.g., customer name OFF, emails ON)
2. Log out
3. Log back in
4. Navigate to Settings > Event Creation

**Expected Result:**
- Settings remain as configured
- Toggle states match what was saved

#### TC-OEF-016: Settings Persist Across Backend Restart
**Steps:**
1. Set specific combination of settings
2. Restart backend container
3. Create new event

**Expected Result:**
- Validation behavior matches saved settings
- Database persisted settings correctly

## Edge Cases

### TC-OEF-017: Empty String vs Null
**Steps:**
1. Set field to optional
2. Create event with empty string for that field
3. View event details

**Expected Result:**
- Field stores empty value appropriately
- No errors in display

### TC-OEF-018: Rapid Toggle Changes
**Steps:**
1. Quickly toggle settings on/off multiple times
2. Save after each change

**Expected Result:**
- Each save completes without error
- Final state matches last save action

## Automated Testing Notes

For Playwright tests:
1. Login to admin dashboard
2. Navigate to Settings
3. Click Event Creation tab
4. Manipulate toggles using checkbox selectors
5. Navigate to Create Event
6. Verify label text contains or doesn't contain "(optional)"
7. Attempt form submission with various field combinations
8. Assert on validation messages and success/failure states

## Files Modified

### Backend
- `/backend/migrations/core/050_add_optional_event_fields_settings.js`
- `/backend/src/routes/adminEvents.js`
- `/backend/src/routes/publicSettings.js`

### Frontend
- `/frontend/src/pages/admin/SettingsPage.tsx`
- `/frontend/src/pages/admin/CreateEventPage.tsx`
- `/frontend/src/pages/admin/CreateEventPageEnhanced.tsx`
