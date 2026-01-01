# Feature: Optional Event Contact Fields

## Overview

This feature adds a settings option to configure whether client/customer contact information (name, email) and admin email are required fields when creating new events. This addresses the needs of users who don't use the email/SMTP functionality and find these mandatory fields unnecessary.

**GitHub Issue:** [#60](https://github.com/the-luap/picpeak/issues/60)

---

## Problem Statement

Currently, when creating a new event, the following fields are **mandatory**:
- Customer Name
- Customer Email
- Admin Email

For users who:
- Don't use SMTP/email functionality
- Share galleries via manual link distribution
- Self-host for personal use without client management

These required fields create unnecessary friction and force users to enter placeholder data.

---

## User Story

As an administrator, I want to configure whether client contact information is required when creating events, so that I can streamline event creation when I don't need email functionality.

---

## Feature Requirements

### 1. New Settings Options

Add three new settings to the Admin Settings page under a new section "Event Creation":

| Setting | Label | Type | Default | Description |
|---------|-------|------|---------|-------------|
| `event_require_customer_name` | Require customer name | Toggle | `true` | When enabled, customer name is required for new events |
| `event_require_customer_email` | Require customer email | Toggle | `true` | When enabled, customer email is required for new events |
| `event_require_admin_email` | Require admin email | Toggle | `true` | When enabled, admin email is required for new events |

### 2. Settings UI Location

**Path:** Admin Panel → Settings → Event Creation (new section)

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                     │
├─────────────────────────────────────────────────────────────┤
│ ▼ General                                                    │
│ ▼ Gallery Display                                            │
│ ▼ Storage                                                    │
│ ▼ Event Creation                        ← NEW SECTION        │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Required Fields                                      │   │
│   │                                                      │   │
│   │ Configure which contact fields are required when    │   │
│   │ creating new events.                                │   │
│   │                                                      │   │
│   │ [✓] Require customer name                           │   │
│   │     Customer name must be provided for new events   │   │
│   │                                                      │   │
│   │ [✓] Require customer email                          │   │
│   │     Customer email must be provided for new events  │   │
│   │     ⚠️ Required for sending gallery invitations     │   │
│   │                                                      │   │
│   │ [✓] Require admin email                             │   │
│   │     Admin email must be provided for new events     │   │
│   │     ⚠️ Required for receiving event notifications   │   │
│   └─────────────────────────────────────────────────────┘   │
│ ▼ Security                                                   │
│ ▼ Email/SMTP                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 3. Event Creation Form Updates

The event creation form (`/admin/events/new`) should:

1. **Fetch settings** on load to determine field requirements
2. **Conditionally apply validation** based on settings
3. **Update field labels** to show optional indicator when not required
4. **Remove asterisk (*)** from non-required fields

#### Field Display Logic

| Setting Value | Field Label | Validation | Placeholder |
|---------------|-------------|------------|-------------|
| `true` (required) | "Customer Name *" | Required | "Enter customer name" |
| `false` (optional) | "Customer Name (optional)" | Optional | "Enter customer name (optional)" |

### 4. Warning Messages

When disabling email-related required fields, show informational warnings:

**When disabling "Require customer email":**
> Note: Without a customer email, you won't be able to send gallery invitation emails automatically. You'll need to share gallery links manually.

**When disabling "Require admin email":**
> Note: Without an admin email, you won't receive event notifications such as expiration reminders or guest feedback alerts.

### 5. Backward Compatibility

- Existing events with empty contact fields remain valid
- Default values maintain current behavior (`true` = required)
- Settings changes only affect new event creation

---

## Technical Specification

### 6. Database Changes

#### 6.1 Settings Table Entries

Add new rows to `app_settings` table:

```sql
INSERT INTO app_settings (key, value, category, description) VALUES
('event_require_customer_name', 'true', 'events', 'Require customer name when creating events'),
('event_require_customer_email', 'true', 'events', 'Require customer email when creating events'),
('event_require_admin_email', 'true', 'events', 'Require admin email when creating events');
```

#### 6.2 Migration File

**File:** `/backend/migrations/core/YYYYMMDDHHMMSS_add_optional_event_fields_settings.js`

```javascript
exports.up = function(knex) {
  return knex('app_settings').insert([
    {
      key: 'event_require_customer_name',
      value: 'true',
      category: 'events',
      description: 'Require customer name when creating events'
    },
    {
      key: 'event_require_customer_email',
      value: 'true',
      category: 'events',
      description: 'Require customer email when creating events'
    },
    {
      key: 'event_require_admin_email',
      value: 'true',
      category: 'events',
      description: 'Require admin email when creating events'
    }
  ]);
};

exports.down = function(knex) {
  return knex('app_settings')
    .whereIn('key', [
      'event_require_customer_name',
      'event_require_customer_email',
      'event_require_admin_email'
    ])
    .del();
};
```

---

### 7. API Changes

#### 7.1 Settings Endpoint (Existing)

The existing settings endpoints should already handle these new settings:

**GET `/api/admin/settings`** - Returns all settings including new ones
**PUT `/api/admin/settings`** - Updates settings including new ones

#### 7.2 Public Settings Endpoint

**GET `/api/public/settings`** - Should include event field requirements for frontend validation

Add to public settings response:
```json
{
  "event_require_customer_name": true,
  "event_require_customer_email": true,
  "event_require_admin_email": true
}
```

#### 7.3 Event Creation Validation Update

**File:** `/backend/src/routes/adminEvents.js`

Update the event creation endpoint to conditionally validate fields:

```javascript
// Before (current)
if (!customer_name) {
  return res.status(400).json({ error: 'Customer name is required' });
}

// After (with settings check)
const settings = await getSettings();
if (settings.event_require_customer_name && !customer_name) {
  return res.status(400).json({ error: 'Customer name is required' });
}
```

---

### 8. Backend Implementation

#### 8.1 Update Event Validation

**File:** `/backend/src/routes/adminEvents.js`

```javascript
// POST /api/admin/events
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      event_name,
      event_type,
      event_date,
      customer_name,
      customer_email,
      admin_email,
      // ... other fields
    } = req.body;

    // Get settings for validation
    const settings = await db('app_settings')
      .whereIn('key', [
        'event_require_customer_name',
        'event_require_customer_email',
        'event_require_admin_email'
      ])
      .select('key', 'value');

    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value === 'true';
      return acc;
    }, {});

    // Conditional validation
    const errors = [];

    if (!event_name) {
      errors.push('Event name is required');
    }

    if (settingsMap.event_require_customer_name && !customer_name) {
      errors.push('Customer name is required');
    }

    if (settingsMap.event_require_customer_email && !customer_email) {
      errors.push('Customer email is required');
    }

    if (settingsMap.event_require_admin_email && !admin_email) {
      errors.push('Admin email is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Continue with event creation...
  } catch (error) {
    // Error handling...
  }
});
```

#### 8.2 Add Settings to Public Endpoint

**File:** `/backend/src/routes/publicSettings.js`

```javascript
// Add to public settings response
const eventFieldSettings = await db('app_settings')
  .whereIn('key', [
    'event_require_customer_name',
    'event_require_customer_email',
    'event_require_admin_email'
  ])
  .select('key', 'value');

// Include in response
response.eventFieldRequirements = eventFieldSettings.reduce((acc, s) => {
  acc[s.key] = s.value === 'true';
  return acc;
}, {});
```

---

### 9. Frontend Implementation

#### 9.1 Settings Page Update

**File:** `/frontend/src/components/admin/Settings.tsx` (or similar)

Add new section for Event Creation settings:

```tsx
// New section component
const EventCreationSettings: React.FC = () => {
  const { settings, updateSetting } = useSettings();

  return (
    <SettingsSection title="Event Creation" icon={<CalendarIcon />}>
      <SettingsGroup title="Required Fields">
        <p className="text-sm text-gray-500 mb-4">
          Configure which contact fields are required when creating new events.
        </p>

        <ToggleSetting
          label="Require customer name"
          description="Customer name must be provided for new events"
          checked={settings.event_require_customer_name}
          onChange={(value) => updateSetting('event_require_customer_name', value)}
        />

        <ToggleSetting
          label="Require customer email"
          description="Customer email must be provided for new events"
          checked={settings.event_require_customer_email}
          onChange={(value) => updateSetting('event_require_customer_email', value)}
          warning="Required for sending gallery invitations"
        />

        <ToggleSetting
          label="Require admin email"
          description="Admin email must be provided for new events"
          checked={settings.event_require_admin_email}
          onChange={(value) => updateSetting('event_require_admin_email', value)}
          warning="Required for receiving event notifications"
        />
      </SettingsGroup>
    </SettingsSection>
  );
};
```

#### 9.2 Event Creation Form Update

**File:** `/frontend/src/components/admin/EventForm.tsx` (or similar)

```tsx
interface EventFormProps {
  // ... existing props
}

const EventForm: React.FC<EventFormProps> = () => {
  const { settings } = usePublicSettings();

  const isCustomerNameRequired = settings?.event_require_customer_name ?? true;
  const isCustomerEmailRequired = settings?.event_require_customer_email ?? true;
  const isAdminEmailRequired = settings?.event_require_admin_email ?? true;

  // Form validation schema (using Zod or Yup)
  const validationSchema = useMemo(() => {
    return z.object({
      event_name: z.string().min(1, 'Event name is required'),
      customer_name: isCustomerNameRequired
        ? z.string().min(1, 'Customer name is required')
        : z.string().optional(),
      customer_email: isCustomerEmailRequired
        ? z.string().email('Valid email required')
        : z.string().email().optional().or(z.literal('')),
      admin_email: isAdminEmailRequired
        ? z.string().email('Valid email required')
        : z.string().email().optional().or(z.literal('')),
      // ... other fields
    });
  }, [isCustomerNameRequired, isCustomerEmailRequired, isAdminEmailRequired]);

  return (
    <form>
      {/* Customer Name Field */}
      <FormField
        label={isCustomerNameRequired ? 'Customer Name' : 'Customer Name (optional)'}
        required={isCustomerNameRequired}
      >
        <Input
          name="customer_name"
          placeholder={isCustomerNameRequired
            ? 'Enter customer name'
            : 'Enter customer name (optional)'
          }
        />
      </FormField>

      {/* Customer Email Field */}
      <FormField
        label={isCustomerEmailRequired ? 'Customer Email' : 'Customer Email (optional)'}
        required={isCustomerEmailRequired}
      >
        <Input
          name="customer_email"
          type="email"
          placeholder={isCustomerEmailRequired
            ? 'Enter customer email'
            : 'Enter customer email (optional)'
          }
        />
      </FormField>

      {/* Admin Email Field */}
      <FormField
        label={isAdminEmailRequired ? 'Admin Email' : 'Admin Email (optional)'}
        required={isAdminEmailRequired}
      >
        <Input
          name="admin_email"
          type="email"
          placeholder={isAdminEmailRequired
            ? 'Enter admin email'
            : 'Enter admin email (optional)'
          }
        />
      </FormField>

      {/* ... rest of form */}
    </form>
  );
};
```

#### 9.3 Update Types

**File:** `/frontend/src/types/settings.ts`

```typescript
interface PublicSettings {
  // ... existing settings
  event_require_customer_name: boolean;
  event_require_customer_email: boolean;
  event_require_admin_email: boolean;
}
```

---

### 10. Email Functionality Impact

When contact fields are optional and left empty:

| Field Empty | Impact |
|-------------|--------|
| Customer Email | Cannot send invitation email, "Send Email" button disabled |
| Admin Email | No notifications sent, warning shown in event details |
| Customer Name | Email salutation uses generic greeting |

#### 10.1 UI Adjustments for Empty Fields

**Event Details Page:**
- If no customer email: Hide/disable "Send Invitation Email" button
- If no admin email: Show info message "No admin email configured for notifications"

**Event Creation Success:**
- If customer email provided: "Event created. Send invitation email?"
- If no customer email: "Event created. Share the gallery link manually."

---

## Implementation Checklist

### Phase 1: Backend
- [ ] Create database migration for new settings
- [ ] Run migration to add default settings
- [ ] Update event creation endpoint with conditional validation
- [ ] Add new settings to public settings endpoint
- [ ] Update event update endpoint with same validation logic
- [ ] Write unit tests for conditional validation

### Phase 2: Frontend - Settings
- [ ] Add "Event Creation" section to Settings page
- [ ] Create toggle components for each setting
- [ ] Add warning messages for email-related settings
- [ ] Test settings save/load functionality

### Phase 3: Frontend - Event Form
- [ ] Update EventForm to fetch settings
- [ ] Implement conditional validation schema
- [ ] Update field labels based on requirements
- [ ] Update placeholder text
- [ ] Test form validation with various settings combinations

### Phase 4: UI Polish
- [ ] Update event details page for empty contact fields
- [ ] Disable email buttons when no email provided
- [ ] Add informational messages where appropriate
- [ ] Update any tooltips or help text

### Phase 5: Testing
- [ ] Test with all settings enabled (default behavior)
- [ ] Test with all settings disabled
- [ ] Test with mixed settings
- [ ] Test event editing with changed settings
- [ ] End-to-end testing

---

## Test Scenarios

| # | Settings | Action | Expected Result |
|---|----------|--------|-----------------|
| 1 | All required (default) | Create event without customer name | Validation error |
| 2 | All required | Create event with all fields | Success |
| 3 | Name optional | Create event without customer name | Success |
| 4 | Email optional | Create event without customer email | Success, email button disabled |
| 5 | All optional | Create event with only event name/date | Success |
| 6 | Mixed | Edit settings, create event | Respects new settings |

---

## Acceptance Criteria

1. ✅ Three new toggle settings available in Admin Settings
2. ✅ Settings persist after save and page refresh
3. ✅ Event creation form respects settings for field requirements
4. ✅ Field labels update to show "(optional)" when not required
5. ✅ Backend validates according to settings
6. ✅ Warning messages shown when disabling email-related fields
7. ✅ Email functionality gracefully handles empty contact fields
8. ✅ Default behavior unchanged (all fields required)
9. ✅ Existing events unaffected by settings changes

---

## Security Considerations

1. Settings changes require admin authentication
2. Public settings endpoint only exposes necessary field requirements
3. No sensitive data exposed through settings

---

## Related Files

### Backend
- `/backend/src/routes/adminEvents.js` - Event creation/update
- `/backend/src/routes/adminSettings.js` - Settings management
- `/backend/src/routes/publicSettings.js` - Public settings API
- `/backend/migrations/core/` - Database migrations

### Frontend
- `/frontend/src/components/admin/Settings.tsx` - Settings page
- `/frontend/src/components/admin/EventForm.tsx` - Event creation form
- `/frontend/src/components/admin/EventDetails.tsx` - Event detail page
- `/frontend/src/services/settingsService.ts` - Settings API service
- `/frontend/src/hooks/useSettings.ts` - Settings hook

---

## Future Enhancements

1. **Field-level defaults**: Set default values for optional fields
2. **Conditional fields**: Show/hide fields based on other selections
3. **Custom required fields**: Allow adding custom required fields
4. **Per-event-type settings**: Different requirements for wedding vs corporate
