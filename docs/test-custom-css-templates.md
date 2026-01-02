# Test Specification: Custom CSS Gallery Templates

This document specifies the test cases for the Custom CSS Gallery Templates feature, which allows administrators to create and manage up to 3 custom CSS templates for gallery styling.

## Prerequisites

- Local Docker environment running (`docker-compose up`)
- Access to admin dashboard
- Backend migrations applied (052_add_css_templates.js)

## Test Cases

### 1. Template Editor Access

#### TC-CCT-001: Access CSS Templates Tab
**Steps:**
1. Navigate to Settings page
2. Look for "Custom CSS Templates" or "Styling" section

**Expected Result:**
- CSS Templates editor is accessible
- Three template slots are visible as tabs

#### TC-CCT-002: Default Template Content
**Steps:**
1. Navigate to CSS Templates editor
2. Select Template 1 tab

**Expected Result:**
- Template 1 named "Elegant Dark"
- Contains pre-populated CSS content
- Is marked as enabled
- Is marked as default

### 2. Template Editing

#### TC-CCT-003: Edit Template Name
**Steps:**
1. Select Template 2
2. Change name from "Untitled" to "My Custom Theme"
3. Save template

**Expected Result:**
- Name updates in tab
- Save confirmation shown
- Name persists after refresh

#### TC-CCT-004: Edit CSS Content
**Steps:**
1. Select Template 2
2. Add CSS: `.gallery-page { background: #ff0000; }`
3. Save template

**Expected Result:**
- CSS saved successfully
- No sanitization warnings for valid CSS
- Character count updates

#### TC-CCT-005: Enable/Disable Template
**Steps:**
1. Select Template 2
2. Toggle "Enable this template" checkbox
3. Save template

**Expected Result:**
- Template status changes
- Tab shows check mark when enabled
- Disabled templates not available in event form

### 3. CSS Sanitization

#### TC-CCT-006: Block JavaScript Expressions
**Steps:**
1. Enter CSS with `expression(alert('xss'))`
2. Save template

**Expected Result:**
- Pattern blocked (replaced with /* BLOCKED */)
- Sanitization warning shown
- Template saves with sanitized content

#### TC-CCT-007: Block @import Rules
**Steps:**
1. Enter CSS with `@import url('http://evil.com/styles.css');`
2. Save template

**Expected Result:**
- @import blocked
- Warning shown
- External resource not loaded

#### TC-CCT-008: Block External URLs
**Steps:**
1. Enter CSS with `background-image: url('http://external.com/image.jpg');`
2. Save template

**Expected Result:**
- External URL blocked
- Only data: URIs allowed for images
- Warning shown

#### TC-CCT-009: Allow Safe CSS Properties
**Steps:**
1. Enter CSS with standard properties:
   ```css
   .gallery-page {
     background-color: #333;
     color: white;
     font-family: Arial, sans-serif;
     padding: 20px;
   }
   ```
2. Save template

**Expected Result:**
- All properties saved as-is
- No sanitization warnings
- CSS valid

### 4. Template Size Limits

#### TC-CCT-010: CSS Size Limit
**Steps:**
1. Try to save CSS content > 100KB
2. Attempt to save

**Expected Result:**
- Error message about size limit
- Template not saved
- User informed of 100KB limit

### 5. Reset to Default

#### TC-CCT-011: Reset Template 1
**Steps:**
1. Modify Template 1 CSS
2. Save changes
3. Click "Reset to Default"
4. Confirm action

**Expected Result:**
- Template reverts to default "Elegant Dark" content
- Name reset to "Elegant Dark"
- Enable status reset to true

#### TC-CCT-012: Reset Button Only on Template 1
**Steps:**
1. Select Template 2
2. Look for Reset button

**Expected Result:**
- Reset to Default button NOT shown for Template 2 or 3
- Only Template 1 has reset option

### 6. Event Integration

#### TC-CCT-013: Template Dropdown in Event Form
**Steps:**
1. Enable at least one CSS template
2. Navigate to Create Event page
3. Look for CSS Template selector

**Expected Result:**
- Dropdown shows "None (Use default theme)" option
- Enabled templates appear in list
- Disabled templates NOT shown

#### TC-CCT-014: Assign Template to Event
**Steps:**
1. Create new event
2. Select an enabled CSS template
3. Save event

**Expected Result:**
- Event created with template assigned
- Template ID stored in database
- Event edit shows selected template

#### TC-CCT-015: Update Event Template
**Steps:**
1. Edit existing event
2. Change CSS template selection
3. Save event

**Expected Result:**
- Template updated successfully
- Gallery reflects new template

### 7. Gallery CSS Loading

#### TC-CCT-016: Gallery Loads Custom CSS
**Steps:**
1. Assign template to an event
2. View gallery as guest
3. Inspect page source/styles

**Expected Result:**
- Custom CSS injected via `<style id="gallery-custom-css">`
- Gallery styling matches template
- CSS scoped to .gallery-page

#### TC-CCT-017: Gallery Without Template
**Steps:**
1. Create event without template (select "None")
2. View gallery

**Expected Result:**
- No custom CSS loaded
- Default theme used
- No errors

#### TC-CCT-018: Disabled Template Not Applied
**Steps:**
1. Assign template to event
2. Disable the template in settings
3. View gallery

**Expected Result:**
- Custom CSS NOT loaded
- Gallery uses default styling
- No errors

### 8. API Tests

#### TC-CCT-019: Get All Templates
**Steps:**
1. Call API: `GET /api/admin/css-templates`

**Expected Result:**
- Returns array of 3 templates
- Each has: id, slot_number, name, css_content, is_enabled, is_default, updated_at

#### TC-CCT-020: Get Enabled Templates
**Steps:**
1. Call API: `GET /api/admin/css-templates/enabled`

**Expected Result:**
- Returns only enabled templates
- Each has: id, name, slot_number

#### TC-CCT-021: Update Template
**Steps:**
1. Call API: `PUT /api/admin/css-templates/2`
   Body: `{ "name": "Test", "css_content": "...", "is_enabled": true }`

**Expected Result:**
- Returns 200 OK
- Template updated
- Sanitization warnings array included

#### TC-CCT-022: Gallery CSS Endpoint
**Steps:**
1. Assign template to event with slug "test-gallery"
2. Call API: `GET /api/gallery/test-gallery/css-template`

**Expected Result:**
- Returns 200 OK with Content-Type: text/css
- Body contains sanitized CSS content

#### TC-CCT-023: Gallery CSS Not Found
**Steps:**
1. Create event without template
2. Call API: `GET /api/gallery/no-template-event/css-template`

**Expected Result:**
- Returns 204 No Content
- No body

### 9. Edge Cases

#### TC-CCT-024: Empty CSS Content
**Steps:**
1. Save template with empty CSS content
2. Assign to event
3. View gallery

**Expected Result:**
- Template saves successfully
- Gallery loads without custom CSS
- No errors

#### TC-CCT-025: Invalid CSS Syntax
**Steps:**
1. Enter CSS with mismatched braces: `{ color: red;`
2. Try to save

**Expected Result:**
- Validation error shown
- Template not saved
- Error message indicates syntax issue

### 10. Persistence Tests

#### TC-CCT-026: Template Persists After Restart
**Steps:**
1. Create and save custom template
2. Restart backend container
3. Reload template editor

**Expected Result:**
- Template content preserved
- All settings intact
- No data loss

## Files Created/Modified

### Backend
- `/backend/migrations/core/052_add_css_templates.js`
- `/backend/src/utils/cssSanitizer.js`
- `/backend/src/routes/adminCssTemplates.js`
- `/backend/src/routes/gallery.js`
- `/backend/server.js`

### Frontend
- `/frontend/src/services/cssTemplates.service.ts`
- `/frontend/src/components/admin/CssTemplateEditor.tsx`
- `/frontend/src/components/admin/index.ts`
- `/frontend/src/hooks/useGalleryCustomCss.ts`

## Integration Notes

The following additional integrations are recommended:
1. Add CssTemplateEditor to Settings page styling tab
2. Add CSS template dropdown to CreateEventPageEnhanced.tsx
3. Add CSS template dropdown to CreateEventPage.tsx
4. Update event edit forms to show/edit template selection
5. Update GalleryPage.tsx to use useGalleryCustomCss hook
6. Add `.gallery-page` class to gallery container components

## Automated Testing Notes

For Playwright tests:
1. Login to admin dashboard
2. Navigate to CSS Templates editor
3. Manipulate template tabs, inputs, and checkboxes
4. Verify save operations via API calls
5. Navigate to Create Event, verify template dropdown
6. View gallery, verify custom CSS is applied
