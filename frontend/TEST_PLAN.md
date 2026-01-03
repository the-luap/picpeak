# PicPeak E2E Test Plan

## Overview

This document provides a comprehensive end-to-end test plan for the PicPeak photo sharing platform. All tests are designed to be executed using **Playwright MCP Browser** or **Chrome DevTools MCP** tools.

## Prerequisites

### Environment Setup
- [ ] Frontend dev server running on `http://localhost:5173`
- [ ] Backend server running on `http://localhost:3001`
- [ ] Database seeded with test data
- [ ] Admin credentials available (default: admin/admin)

### MCP Tools Required
- `mcp__playwright__browser_navigate` - Navigate to URLs
- `mcp__playwright__browser_snapshot` - Capture page state
- `mcp__playwright__browser_click` - Click elements
- `mcp__playwright__browser_fill_form` - Fill form fields
- `mcp__playwright__browser_type` - Type text
- `mcp__playwright__browser_console_messages` - Check console errors
- `mcp__chrome-devtools__list_console_messages` - Alternative console check
- `mcp__chrome-devtools__list_network_requests` - Monitor API calls

### Test Data Requirements
- At least 2 active events with photos
- At least 1 expired event
- At least 1 archived event (optional)
- Categories configured
- Email templates configured

---

## Test Execution Methodology

### Before Each Test Section
```
1. Navigate to the target page
2. Take a snapshot to verify page loaded
3. Check console for errors: browser_console_messages(level: "error")
4. Verify no network request failures
```

### After Each Test Section
```
1. Take final snapshot
2. Check console for new errors
3. Document any issues found
```

---

## 1. Authentication Tests

### 1.1 Admin Login
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-001 | Valid login | Navigate to `/admin/login`, enter valid credentials, click Login | Redirect to dashboard, session created |
| AUTH-002 | Invalid password | Enter wrong password | Error message displayed, no redirect |
| AUTH-003 | Empty fields | Submit with empty fields | Validation errors shown |
| AUTH-004 | Session persistence | Login, refresh page | Stay logged in |
| AUTH-005 | Logout | Click logout button | Redirect to login, session cleared |

### 1.2 Gallery Authentication
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAUTH-001 | Valid gallery password | Navigate to gallery, enter correct password | Gallery content displayed |
| GAUTH-002 | Invalid gallery password | Enter wrong password | Error message, access denied |
| GAUTH-003 | Token-based access | Access gallery with token in URL | Direct access without password |
| GAUTH-004 | Expired gallery access | Access expired gallery | Appropriate expiration message |

---

## 2. Dashboard Tests

### 2.1 Dashboard Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-001 | Stats display | Navigate to `/admin/dashboard` | All stat cards show correct values |
| DASH-002 | Active Events count | Check "Active Events" card | Matches actual active events |
| DASH-003 | Expiring Soon count | Check "Expiring Soon" card | Shows events expiring in 7 days |
| DASH-004 | Total Photos count | Check "Total Photos" card | Matches sum of all event photos |
| DASH-005 | Storage Used | Check "Storage Used" card | Shows correct storage value |
| DASH-006 | Total Views | Check "Total Views" card | Shows accumulated views |
| DASH-007 | Downloads count | Check "Downloads" card | Shows accumulated downloads |
| DASH-008 | Archived Events | Check "Archived Events" card | Matches archived count |
| DASH-009 | System Health | Check "System Health" card | Shows "Healthy" or appropriate status |

### 2.2 Dashboard Widgets
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-010 | Expiring events list | Check "Events Expiring Soon" section | Lists events expiring within 7 days |
| DASH-011 | Recent activity | Check "Recent Activity" section | Shows recent actions with timestamps |
| DASH-012 | Create Event button | Click "Create Event" | Navigate to event creation |

### 2.3 Translation Check - Dashboard
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-T01 | English translation | Set language to English | All text in English, no translation keys visible |
| DASH-T02 | German translation | Set language to German | All text in German, no translation keys visible |
| DASH-T03 | Translation completeness | Check all labels and buttons | No `t('...')` keys or undefined text |

---

## 3. Events Management Tests

### 3.1 Events List Page
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EVT-001 | Events table display | Navigate to `/admin/events` | Table shows all events |
| EVT-002 | Stats cards | Check stat cards | Total, Active, Photos, Expiring counts correct |
| EVT-003 | Search functionality | Type in search box | Events filtered by name |
| EVT-004 | Filter - All | Click "All" filter | All events shown |
| EVT-005 | Filter - Active | Click "Active" filter | Only active events shown |
| EVT-006 | Filter - Expiring | Click "Expiring" filter | Only expiring events shown |
| EVT-007 | Filter - Archived | Click "Archived" filter | Only archived events shown |
| EVT-008 | Select all checkbox | Click header checkbox | All events selected |
| EVT-009 | Bulk actions | Select multiple, check actions | Bulk action options available |

### 3.2 Event Creation
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EVT-010 | Open create form | Click "Create Event" | Modal/page opens |
| EVT-011 | Required fields validation | Submit empty form | Validation errors for required fields |
| EVT-012 | Event name required | Leave name empty | Error shown |
| EVT-013 | Event date required | Leave date empty | Error shown |
| EVT-014 | Event type selection | Select different types | Type saved correctly |
| EVT-015 | Password generation | Click generate password | Random password generated |
| EVT-016 | Custom password | Enter custom password | Password accepted |
| EVT-017 | Expiry date setting | Set expiry date | Date saved correctly |
| EVT-018 | Customer email optional | Leave email empty (if not required) | Event created without email |
| EVT-019 | Customer email required | Leave email empty (when required) | Validation error shown |
| EVT-020 | Successful creation | Fill all required, submit | Event created, redirect to details |

### 3.3 Event Creation - CSS Template Selection
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EVT-CSS-001 | CSS templates visible | Check Theme & Style section | "Custom CSS Template" section shown (if templates exist) |
| EVT-CSS-002 | No template option | Check "No Template" card | Selectable, selected by default |
| EVT-CSS-003 | Template cards display | Check enabled templates | Templates show name and slot number |
| EVT-CSS-004 | Select template | Click template card | Card highlighted, template selected |
| EVT-CSS-005 | Template persistence | Create event with template | Template saved with event |
| EVT-CSS-006 | Hidden when no templates | Disable all CSS templates | Section not visible |

### 3.4 Event Creation - Required Fields Settings
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EVT-REQ-001 | Email required - enabled | Enable in settings, create event without email | Validation error for email |
| EVT-REQ-002 | Email required - disabled | Disable in settings, create event without email | Event created successfully |
| EVT-REQ-003 | Customer name required - enabled | Enable in settings, create event without name | Validation error for customer name |
| EVT-REQ-004 | Customer name required - disabled | Disable in settings, create event without name | Event created successfully |
| EVT-REQ-005 | Admin email required - enabled | Enable in settings, create event without admin email | Validation error |
| EVT-REQ-006 | Admin email required - disabled | Disable in settings, create event without admin email | Event created successfully |
| EVT-REQ-007 | Welcome message required - enabled | Enable in settings, create without message | Validation error |
| EVT-REQ-008 | Welcome message required - disabled | Disable in settings, create without message | Event created successfully |

### 3.4 Event Actions
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EVT-020 | View details | Click actions → View Details | Navigate to event details |
| EVT-021 | View gallery | Click actions → View Gallery | Opens gallery in new tab |
| EVT-022 | Archive event | Click actions → Archive | Confirmation dialog, event archived |
| EVT-023 | Delete event | Click actions → Delete | Confirmation dialog, event deleted |

### 3.5 Translation Check - Events
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EVT-T01 | Events list - English | Check all labels | No translation keys visible |
| EVT-T02 | Events list - German | Switch to German | All text translated |
| EVT-T03 | Create event modal - both languages | Check form labels | All properly translated |

---

## 4. Event Details Tests

### 4.1 Overview Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DET-001 | Event header | Check header section | Title, date, type, status displayed |
| DET-002 | Event information | Check info section | All fields displayed correctly |
| DET-003 | Source mode display | Check source mode | Shows "Managed" or "Watch folder" |
| DET-004 | Customer info | Check customer details | Name, email displayed |
| DET-005 | Dates display | Check created/expires | Both dates shown correctly |
| DET-006 | Share link | Check share link section | Link displayed with copy button |
| DET-007 | Copy link | Click copy button | Link copied to clipboard |
| DET-008 | Reset password | Click "Reset Gallery Password" | Confirmation, new password generated |
| DET-009 | Resend email | Click "Resend Creation Email" | Email sent notification |
| DET-010 | Photo statistics | Check stats section | Views, downloads, visitors shown |
| DET-011 | Theme preview | Check theme section | Current theme settings displayed |

### 4.2 Photos Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DET-020 | Photos grid | Click Photos tab | Photo grid displayed |
| DET-021 | Search photos | Type in search box | Photos filtered by filename |
| DET-022 | Category filter | Select category | Photos filtered by category |
| DET-023 | Sort by date | Select "Sort by Date" | Photos sorted chronologically |
| DET-024 | Sort by name | Select "Sort by Name" | Photos sorted alphabetically |
| DET-025 | Sort by size | Select "Sort by Size" | Photos sorted by file size |
| DET-026 | Sort by rating | Select "Sort by Rating" | Photos sorted by rating |
| DET-027 | Sort direction | Click sort direction button | Order reversed |
| DET-028 | Rating filter | Select rating filter | Photos filtered by minimum rating |
| DET-029 | Has likes filter | Check "Has likes" | Only liked photos shown |
| DET-030 | Has favorites filter | Check "Has favorites" | Only favorited photos shown |
| DET-031 | Has comments filter | Check "Has comments" | Only commented photos shown |
| DET-032 | Upload photos | Click "Upload Photos" | Upload modal opens |
| DET-033 | Photo upload | Select and upload files | Photos uploaded, appear in grid |
| DET-034 | Select photos | Click "Select Photos" | Selection mode enabled |
| DET-035 | Bulk select | Select multiple photos | Selection count updates |
| DET-036 | Export selected | Select photos, click Export | Export options shown |
| DET-037 | Delete photos | Select photos, delete | Confirmation, photos removed |

### 4.3 Categories Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DET-040 | Categories display | Click Categories tab | Global and event categories shown |
| DET-041 | Add category | Click "Add", enter name | New category created |
| DET-042 | Edit category | Edit category name | Name updated |
| DET-043 | Delete category | Delete event category | Category removed |
| DET-044 | Global categories | Check global list | All global categories displayed |

### 4.4 Event Edit
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DET-050 | Open edit | Click "Edit" button | Edit modal/page opens |
| DET-051 | Edit name | Change event name | Name updated |
| DET-052 | Edit date | Change event date | Date updated |
| DET-053 | Edit expiry | Change expiry date | Expiry updated |
| DET-054 | Edit customer info | Change customer details | Info updated |
| DET-055 | Edit theme | Change theme settings | Theme updated |
| DET-056 | Save changes | Click save | Changes persisted |
| DET-057 | Cancel edit | Click cancel | Changes discarded |

### 4.5 Translation Check - Event Details
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DET-T01 | Overview tab | Check all labels | No translation keys |
| DET-T02 | Photos tab | Check all labels | No translation keys |
| DET-T03 | Categories tab | Check all labels | No translation keys |
| DET-T04 | Both languages | Switch languages | All text properly translated |

---

## 5. Gallery (Public View) Tests

### 5.1 Gallery Access
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAL-001 | Password prompt | Navigate to gallery URL | Password form displayed |
| GAL-002 | Enter password | Enter correct password | Gallery content shown |
| GAL-003 | Token access | Use URL with token | Direct access granted |
| GAL-004 | Invalid password | Enter wrong password | Error message shown |
| GAL-005 | Session persistence | Enter password, navigate away, return | Still authenticated |

### 5.2 Gallery Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAL-010 | Header display | Check gallery header | Event name, branding shown |
| GAL-011 | Photo grid | Check main content | Photos displayed in configured layout |
| GAL-012 | Grid layout | Set grid layout | Photos in uniform grid |
| GAL-013 | Masonry layout | Set masonry layout | Pinterest-style layout |
| GAL-014 | Hero layout | Set hero layout | Featured image with grid below |
| GAL-015 | Carousel layout | Set carousel layout | Slideshow navigation |
| GAL-016 | Timeline layout | Set timeline layout | Photos by date |
| GAL-017 | Mosaic layout | Set mosaic layout | Varied sizes |
| GAL-018 | Footer display | Check footer | Legal links, copyright |

### 5.3 Gallery Features
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAL-020 | Search photos | Type in search | Photos filtered |
| GAL-021 | Sort by date | Click sort by date | Photos reordered |
| GAL-022 | Sort by name | Click sort by name | Photos reordered |
| GAL-023 | Sort by size | Click sort by size | Photos reordered |
| GAL-024 | Sort by rating | Click sort by rating | Photos reordered |
| GAL-025 | Category filter | Select category | Photos filtered |

### 5.4 Photo Interactions
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAL-030 | Open lightbox | Click photo | Lightbox opens |
| GAL-031 | Navigate lightbox | Use arrows/keys | Navigate between photos |
| GAL-032 | Close lightbox | Click close/escape | Lightbox closes |
| GAL-033 | Download single | Click download in lightbox | Photo downloaded |
| GAL-034 | Like photo | Click like button | Like registered, count updates |
| GAL-035 | Favorite photo | Click favorite button | Favorite registered |
| GAL-036 | Rate photo | Click rating stars | Rating saved |
| GAL-037 | Add comment | Type and submit comment | Comment added |

### 5.5 Bulk Download
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAL-040 | Download all | Click "Download All" | ZIP download starts |
| GAL-041 | Select photos | Click "Select Photos" | Selection mode enabled |
| GAL-042 | Download selected | Select photos, download | Selected photos in ZIP |

### 5.6 Translation Check - Gallery
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| GAL-T01 | Password page | Check all labels | No translation keys |
| GAL-T02 | Gallery view | Check all buttons/labels | No translation keys |
| GAL-T03 | Lightbox | Check all controls | No translation keys |
| GAL-T04 | German locale | Switch to German | All text translated |

---

## 6. Archives Tests

### 6.1 Archives List
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ARC-001 | Archives page | Navigate to `/admin/archives` | Archives list displayed |
| ARC-002 | Stats cards | Check stat cards | Total, storage, photos, avg size shown |
| ARC-003 | Search archives | Type in search | Archives filtered |
| ARC-004 | Type filter | Select event type | Archives filtered |
| ARC-005 | Sort by date | Select sort by date | Archives sorted |
| ARC-006 | Sort by name | Select sort by name | Archives sorted |
| ARC-007 | Sort by size | Select sort by size | Archives sorted |
| ARC-008 | Empty state | No archives | "No archives found" message |

### 6.2 Archive Actions
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ARC-010 | Download archive | Click download action | ZIP file downloads |
| ARC-011 | Restore archive | Click restore action | Confirmation, event restored |
| ARC-012 | Delete archive | Click delete action | Confirmation, archive removed |
| ARC-013 | View archive info | Click archive row | Archive details shown |

### 6.3 Translation Check - Archives
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ARC-T01 | Archives page - English | Check all labels | No translation keys |
| ARC-T02 | Archives page - German | Switch to German | All text translated |

---

## 7. Settings Tests

### 7.1 General Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-001 | General tab display | Navigate to Settings, General tab | All sections visible |
| SET-002 | Account section | Check account form | Username, password fields |
| SET-003 | Update password | Change password, save | Password updated |
| SET-004 | Site name | Change site name, save | Name updated |
| SET-005 | Timezone | Change timezone, save | Timezone updated |
| SET-006 | Date format | Change format, save | Format updated |
| SET-007 | Language setting | Change default language | Language updated |
| SET-008 | Feature toggles | Toggle features on/off | Settings saved |
| SET-009 | Max uploads setting | Change max files per upload | Setting saved |

### 7.2 Event Creation Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-010 | Events tab display | Click "Event Creation" tab | Required fields options shown |
| SET-011 | Customer email required | Toggle on/off | Setting saved |
| SET-012 | Customer name required | Toggle on/off | Setting saved |
| SET-013 | Admin email required | Toggle on/off | Setting saved |
| SET-014 | Welcome message required | Toggle on/off | Setting saved |
| SET-015 | Settings persistence | Change settings, refresh | Settings persisted |

### 7.3 System Status Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-020 | Status tab display | Click "System Status" tab | All status sections shown |
| SET-021 | Storage overview | Check storage section | Used, available, limit shown |
| SET-022 | Soft limit setting | Set soft limit, save | Limit saved |
| SET-023 | Capacity override | Set override values | Values saved |
| SET-024 | System info | Check system section | Version, uptime, memory shown |
| SET-025 | Database info | Check database section | Type, size, connections shown |
| SET-026 | Background services | Check services list | Service status indicators |

### 7.4 Security Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-030 | Security tab display | Click "Security" tab | All security options shown |
| SET-031 | Password requirements | Change min length | Setting saved |
| SET-032 | Session timeout | Change timeout value | Setting saved |
| SET-033 | Max login attempts | Change attempts value | Setting saved |
| SET-034 | reCAPTCHA settings | Configure reCAPTCHA | Settings saved |
| SET-035 | reCAPTCHA site key | Enter site key | Key saved |
| SET-036 | reCAPTCHA secret | Enter secret key | Key saved |

### 7.5 Categories Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-040 | Categories tab display | Click "Categories" tab | Category manager shown |
| SET-041 | List categories | Check categories list | All global categories shown |
| SET-042 | Add category | Add new category | Category created |
| SET-043 | Edit category | Edit category name | Name updated |
| SET-044 | Delete category | Delete category | Category removed |
| SET-045 | Reorder categories | Drag to reorder | Order saved |

### 7.6 Analytics Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-050 | Analytics tab display | Click "Analytics" tab | Analytics settings shown |
| SET-051 | Umami website ID | Enter website ID | ID saved |
| SET-052 | Umami host URL | Enter host URL | URL saved |
| SET-053 | Backend analytics info | Check backend section | Connection status shown |

### 7.7 Moderation Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-060 | Moderation tab display | Click "Moderation" tab | Word filter manager shown |
| SET-061 | Add filter word | Add blocked word | Word added to list |
| SET-062 | Remove filter word | Remove word | Word removed |
| SET-063 | Filter action | Change filter action | Action saved |

### 7.8 Custom CSS Tab
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-070 | Styling tab display | Click "Custom CSS" tab | CSS editor shown |
| SET-071 | Template selection | Select template 1/2/3 | Template loaded |
| SET-072 | Template name | Change template name | Name saved |
| SET-073 | Enable template | Toggle enable checkbox | State saved |
| SET-074 | Edit CSS | Modify CSS content | CSS saved |
| SET-075 | Reset to default | Click reset button | Default CSS restored |
| SET-076 | Character count | Check character counter | Shows correct count |

### 7.9 Liquid Glass CSS Templates (FEATURE-006)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-080 | Liquid Glass Light | Check template slot 2 | "Liquid Glass Light" template present |
| SET-081 | Liquid Glass Dark | Check template slot 3 | "Liquid Glass Dark" template present |
| SET-082 | Glass variables | Check Light template CSS | Contains --glass-bg, --glass-blur variables |
| SET-083 | Neon glow variables | Check Dark template CSS | Contains --neon-glow variable |
| SET-084 | Backdrop filter | Check templates | Contains backdrop-filter: blur() |
| SET-085 | Reduced motion | Check templates | Contains @media (prefers-reduced-motion) |
| SET-086 | Reduced transparency | Check templates | Contains @media (prefers-reduced-transparency) |
| SET-087 | Responsive styles | Check templates | Contains @media (max-width: 768px) |
| SET-088 | Template enabled | Toggle enable for Liquid Glass | Template becomes available in event creation |

### 7.10 Translation Check - Settings
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SET-T01 | All tabs - English | Check every tab | No translation keys visible |
| SET-T02 | All tabs - German | Switch to German, check tabs | All text translated |
| SET-T03 | Form labels | Check all form labels | Properly translated |
| SET-T04 | Button text | Check all buttons | Properly translated |
| SET-T05 | Error messages | Trigger validation errors | Errors translated |

---

## 8. Analytics Page Tests

### 8.1 Analytics Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ANA-001 | Analytics page | Navigate to `/admin/analytics` | Dashboard displayed |
| ANA-002 | Page views card | Check page views | Count and chart shown |
| ANA-003 | Unique visitors | Check visitors card | Count and chart shown |
| ANA-004 | Downloads card | Check downloads | Count shown |
| ANA-005 | Time range filter | Select 7/30/90 days | Data updates |
| ANA-006 | Top pages list | Check top pages section | Pages with view counts |
| ANA-007 | Device breakdown | Check device section | Desktop/mobile/tablet % |
| ANA-008 | Storage usage | Check storage section | Used/available/photos |
| ANA-009 | Refresh data | Click refresh button | Data reloads |

### 8.2 Translation Check - Analytics
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ANA-T01 | Analytics - English | Check all labels | No translation keys |
| ANA-T02 | Analytics - German | Switch to German | All text translated |

---

## 9. Email Settings Tests

### 9.1 SMTP Configuration
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EML-001 | Email page | Navigate to `/admin/email` | SMTP settings shown |
| EML-002 | SMTP host | Enter host value | Field accepts input |
| EML-003 | SMTP port | Enter port number | Field accepts number |
| EML-004 | Security type | Select TLS/SSL | Selection saved |
| EML-005 | Username | Enter username | Field accepts input |
| EML-006 | Password | Enter password | Field masked |
| EML-007 | Show password | Click show button | Password visible |
| EML-008 | From email | Enter from address | Field accepts email |
| EML-009 | From name | Enter from name | Field accepts input |
| EML-010 | Save settings | Click save | Settings persisted |
| EML-011 | Ignore SSL toggle | Toggle certificate check | Setting saved |

### 9.2 Test Email
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EML-020 | Test email input | Enter test email address | Field accepts email |
| EML-021 | Send test email | Click send button | Email sent, success message |
| EML-022 | Test email failure | Wrong SMTP config | Error message shown |

### 9.3 Email Templates
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EML-030 | Templates tab | Click "Email Templates" | Template list shown |
| EML-031 | Template list | Check all templates | 10 templates listed |
| EML-032 | Select template | Click template | Editor loads template |
| EML-033 | Edit subject | Modify subject line | Subject updated |
| EML-034 | Edit body | Modify HTML body | Body updated |
| EML-035 | Language switch | Click English/German | Language version loaded |
| EML-036 | Preview template | Click preview | Preview rendered |
| EML-037 | Save template | Click save | Template saved |
| EML-038 | Variables display | Check variables section | Available variables listed |

### 9.4 Translation Check - Email
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| EML-T01 | SMTP tab - English | Check all labels | No translation keys |
| EML-T02 | Templates tab - English | Check all labels | No translation keys |
| EML-T03 | Both tabs - German | Switch to German | All text translated |

---

## 10. Branding Tests

### 10.1 Company Information
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-001 | Branding page | Navigate to `/admin/branding` | All sections shown |
| BRD-002 | Company name | Enter company name | Field accepts input |
| BRD-003 | Company tagline | Enter tagline | Field accepts input |
| BRD-004 | Support email | Enter email | Field accepts email |
| BRD-005 | Footer text | Enter footer text | Field accepts input |
| BRD-006 | Upload favicon | Upload favicon file | Favicon saved |
| BRD-007 | Upload logo | Upload logo file | Logo displayed |
| BRD-008 | Remove logo | Click remove button | Logo removed |
| BRD-009 | Logo size | Select size option | Size applied |
| BRD-010 | Logo position | Select left/center/right | Position saved |
| BRD-011 | Display mode | Select logo/name/both | Mode applied |
| BRD-012 | Header logo toggle | Toggle show in header | Setting saved |
| BRD-013 | Hero logo toggle | Toggle show in hero | Setting saved |
| BRD-014 | White label | Toggle hide PicPeak | Branding hidden |
| BRD-015 | Watermarks | Toggle watermarks | Setting saved |

### 10.2 Theme Presets
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-020 | Classic Grid preset | Select Classic Grid | Theme applied |
| BRD-021 | Elegant Wedding preset | Select Elegant Wedding | Theme applied |
| BRD-022 | Modern Masonry preset | Select Modern Masonry | Theme applied |
| BRD-023 | Birthday preset | Select Birthday | Theme applied |
| BRD-024 | Corporate preset | Select Corporate | Theme applied |
| BRD-025 | Artistic preset | Select Artistic | Theme applied |

### 10.3 Gallery Layout
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-030 | Grid layout | Select grid | Layout applied |
| BRD-031 | Masonry layout | Select masonry | Layout applied |
| BRD-032 | Carousel layout | Select carousel | Layout applied |
| BRD-033 | Timeline layout | Select timeline | Layout applied |
| BRD-034 | Hero layout | Select hero | Layout applied |
| BRD-035 | Mosaic layout | Select mosaic | Layout applied |
| BRD-036 | Photo spacing | Change spacing | Setting applied |
| BRD-037 | Photo animation | Change animation | Setting applied |

### 10.4 Colors and Typography
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-040 | Primary color | Change primary color | Color picker works, color applied |
| BRD-041 | Accent color | Change accent color | Color applied |
| BRD-042 | Background color | Change background | Color applied |
| BRD-043 | Text color | Change text color | Color applied |
| BRD-044 | Body font | Select body font | Font applied |
| BRD-045 | Heading font | Select heading font | Font applied |
| BRD-046 | Font size | Select font size | Size applied |
| BRD-047 | Border radius | Select radius | Radius applied |
| BRD-048 | Shadow style | Select shadow | Shadow applied |
| BRD-049 | Background pattern | Select pattern | Pattern applied |

### 10.5 Live Preview
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-050 | Preview display | Check live preview section | Preview shown |
| BRD-051 | Preview updates | Change settings | Preview updates |
| BRD-052 | Live preview toggle | Toggle live preview | Immediate updates |
| BRD-053 | Save changes | Click save | All settings persisted |
| BRD-054 | Preview button | Click preview button | Full preview opens |

### 10.6 Custom CSS Instructions Panel
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-060 | Instructions toggle | Click "How to use Custom CSS" | Panel expands/collapses |
| BRD-061 | CSS variables section | Check variables section | Theme variables displayed with current values |
| BRD-062 | Gallery layouts section | Check layouts section | CSS selectors documented |
| BRD-063 | Glassmorphism example | Check glass effect section | Example CSS shown |
| BRD-064 | Tip section | Check tip box | Links to CSS Templates |
| BRD-065 | Panel closed by default | Load page | Instructions panel collapsed |

### 10.7 Typography Row Layout
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-070 | Font size & border radius | Check first row | 2 items per row, fully visible |
| BRD-071 | Shadow & background | Check second row | 2 items per row, fully visible |
| BRD-072 | Dropdown values visible | Check all dropdowns | Full text visible (not truncated) |
| BRD-073 | Mobile responsive | Check on mobile viewport | Stacks to 1 column properly |

### 10.8 Translation Check - Branding
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BRD-T01 | Branding - English | Check all labels | No translation keys |
| BRD-T02 | Branding - German | Switch to German | All text translated |

---

## 11. Backup & Restore Tests

### 11.1 Backup Dashboard
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BAK-001 | Backup page | Navigate to `/admin/backup` | Dashboard shown |
| BAK-002 | Backup health | Check health indicator | Status displayed |
| BAK-003 | Stats cards | Check total/size/duration | Values displayed |
| BAK-004 | Backup coverage | Check coverage section | DB/Photos/Archives status |
| BAK-005 | Storage destination | Check destination info | Path and retention shown |
| BAK-006 | Run backup now | Click run backup | Backup process starts |

### 11.2 Backup Configuration
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BAK-010 | Configuration tab | Click Configuration | Settings form shown |
| BAK-011 | Enable backups | Toggle enable | Setting saved |
| BAK-012 | Backup schedule | Set schedule | Schedule saved |
| BAK-013 | Include database | Toggle database | Setting saved |
| BAK-014 | Include photos | Toggle photos | Setting saved |
| BAK-015 | Retention period | Set retention days | Setting saved |
| BAK-016 | Storage path | Set backup path | Path saved |
| BAK-017 | S3 configuration | Configure S3 | Settings saved |

### 11.3 Backup History
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BAK-020 | History tab | Click Backup History | History list shown |
| BAK-021 | Backup list | Check backup entries | Date, size, status shown |
| BAK-022 | Download backup | Click download | Backup file downloads |
| BAK-023 | Delete backup | Click delete | Confirmation, backup removed |

### 11.4 Restore
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BAK-030 | Restore tab | Click Restore | Restore options shown |
| BAK-031 | Select backup | Choose backup to restore | Backup selected |
| BAK-032 | Upload backup | Upload backup file | File accepted |
| BAK-033 | Restore backup | Click restore | Confirmation, restore starts |

### 11.5 Translation Check - Backup
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BAK-T01 | All tabs - English | Check all tabs | No translation keys |
| BAK-T02 | All tabs - German | Switch to German | All text translated |

---

## 12. CMS Pages Tests

### 12.1 Public Landing Page
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| CMS-001 | CMS page | Navigate to `/admin/cms` | Page displayed |
| CMS-002 | Landing toggle | Toggle public landing | Setting saved |
| CMS-003 | Landing HTML | Edit HTML content | Content saved |
| CMS-004 | Landing CSS | Edit CSS content | CSS saved |
| CMS-005 | Save public site | Click save | Content published |
| CMS-006 | Reset to default | Click reset | Default content restored |
| CMS-007 | Live preview | Check preview (when enabled) | Preview shows content |

### 12.2 Legal Pages
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| CMS-010 | Privacy Policy | Select Privacy Policy | Editor loads content |
| CMS-011 | Legal Notice | Select Legal Notice | Editor loads content |
| CMS-012 | Edit title | Change page title | Title updated |
| CMS-013 | Edit content | Use markdown editor | Content updated |
| CMS-014 | English version | Click English tab | English content loaded |
| CMS-015 | German version | Click German tab | German content loaded |
| CMS-016 | Save page | Click save | Content saved |
| CMS-017 | Preview links | Click preview link | Page opens in new tab |

### 12.3 Rich Text Editor
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| CMS-020 | Heading buttons | Click H1-H6 buttons | Headings applied |
| CMS-021 | Bold text | Click bold | Text bolded |
| CMS-022 | Italic text | Click italic | Text italicized |
| CMS-023 | Code formatting | Click code | Code formatted |
| CMS-024 | Lists | Click bullet/number list | Lists created |
| CMS-025 | Blockquote | Click quote | Quote formatted |
| CMS-026 | Link | Click link button | Link added |
| CMS-027 | Alignment | Click align buttons | Text aligned |
| CMS-028 | Undo/Redo | Click undo/redo | Changes undone/redone |
| CMS-029 | Fullscreen | Click fullscreen | Editor expands |

### 12.4 Translation Check - CMS
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| CMS-T01 | CMS page - English | Check all labels | No translation keys |
| CMS-T02 | CMS page - German | Switch to German | All text translated |

---

## 13. Cross-Cutting Tests

### 13.1 Translation Button (All Pages)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| TRANS-001 | Language button visibility | Check header on all pages | Language button always visible |
| TRANS-002 | Language dropdown | Click language button | Dropdown shows EN/DE options |
| TRANS-003 | Switch to German | Select German | UI switches to German |
| TRANS-004 | Switch to English | Select English | UI switches to English |
| TRANS-005 | Language persistence | Change language, refresh | Language persists |

### 13.2 Translation Completeness Check
**Execute on every page:**

| Page | Test Steps | Check Points |
|------|------------|--------------|
| Login | Load page in EN and DE | All labels, buttons, errors translated |
| Dashboard | Load page in EN and DE | All cards, labels, activity items |
| Events List | Load page in EN and DE | Headers, filters, table columns, actions |
| Event Details | All tabs in EN and DE | All sections, buttons, labels |
| Event Create/Edit | Form in EN and DE | All field labels, placeholders, errors |
| Gallery (Public) | Load in EN and DE | All buttons, filters, messages |
| Archives | Load in EN and DE | Table, filters, messages |
| Settings (all tabs) | Each tab in EN and DE | All form labels, descriptions, buttons |
| Analytics | Load in EN and DE | All cards, sections, labels |
| Email Settings | Both tabs in EN and DE | All form fields, template names |
| Branding | Load in EN and DE | All sections, options, labels |
| Backup | All tabs in EN and DE | All cards, buttons, status messages |
| CMS | Load in EN and DE | All editor labels, page names |

### 13.3 Responsive Design
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RESP-001 | Desktop view | Set viewport 1920x1080 | Full layout displayed |
| RESP-002 | Tablet view | Set viewport 768x1024 | Responsive layout |
| RESP-003 | Mobile view | Set viewport 375x667 | Mobile layout, hamburger menu |
| RESP-004 | Sidebar collapse | Resize window | Sidebar collapses appropriately |
| RESP-005 | Table responsiveness | Check tables on mobile | Tables scroll or stack |

### 13.4 Error Handling
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ERR-001 | Network error | Disable network, perform action | Error message shown |
| ERR-002 | 404 page | Navigate to invalid route | 404 page displayed |
| ERR-003 | API error | Trigger API error | User-friendly error message |
| ERR-004 | Form validation | Submit invalid forms | Field-level errors shown |
| ERR-005 | Session expired | Let session expire | Redirect to login |

---

## 14. Console Error Monitoring

### 14.1 Error Check Procedure
Execute after each major test section:

```javascript
// Using Playwright MCP
browser_console_messages({ level: "error" })

// Using Chrome DevTools MCP
list_console_messages({ types: ["error"] })
```

### 14.2 Acceptable vs Critical Errors

**Acceptable (informational):**
- React DevTools suggestions
- React Router future flag warnings
- Third-party library deprecation warnings

**Critical (must fix):**
- Uncaught exceptions
- Network request failures (4xx, 5xx)
- React rendering errors
- TypeScript/JavaScript runtime errors
- Failed to fetch errors
- CORS errors

### 14.3 Error Documentation Template
```
| Page | Error Message | Severity | Status |
|------|---------------|----------|--------|
| [page] | [error text] | Critical/Warning | Open/Fixed |
```

---

## 15. Network Request Monitoring

### 15.1 API Health Check
```javascript
// Using Chrome DevTools MCP
list_network_requests({ resourceTypes: ["fetch", "xhr"] })
```

### 15.2 Expected API Endpoints

| Endpoint Pattern | Method | Expected Status |
|------------------|--------|-----------------|
| `/api/admin/auth/*` | POST | 200/401 |
| `/api/admin/events` | GET | 200 |
| `/api/admin/events/*` | GET/PUT/DELETE | 200/404 |
| `/api/admin/settings` | GET/PUT | 200 |
| `/api/admin/photos/*` | GET/POST/DELETE | 200 |
| `/api/gallery/*` | GET | 200/401 |
| `/api/admin/backup/*` | GET/POST | 200 |

### 15.3 Failed Request Documentation
```
| Endpoint | Method | Status | Error | Impact |
|----------|--------|--------|-------|--------|
| [url] | [method] | [status] | [error] | [impact] |
```

---

## 16. Backend Service Log Monitoring

### 16.1 Log Check Command
```bash
# Check backend logs for errors
docker logs picpeak-backend 2>&1 | grep -i error

# Or if running locally
tail -f backend/logs/error.log
```

### 16.2 Log Patterns to Watch

| Pattern | Severity | Action |
|---------|----------|--------|
| `ERROR` | High | Investigate immediately |
| `WARN` | Medium | Document and monitor |
| `UnhandledPromiseRejection` | Critical | Fix immediately |
| `ECONNREFUSED` | High | Check service connectivity |
| `JWT` errors | High | Check authentication |
| `Database` errors | Critical | Check DB connection |

### 16.3 Service Health Checks
```bash
# Check all services
curl http://localhost:3001/api/health

# Expected response
{ "status": "healthy", "services": { "database": "up", "redis": "up" } }
```

---

## 17. State-Based Testing

### 17.1 Event States
| State | Conditions | Expected Behavior |
|-------|------------|-------------------|
| Active | Created, not expired | Full access, all features |
| Expiring | Within 7 days of expiry | Warning indicators shown |
| Expired | Past expiry date | Limited access, archive prompt |
| Archived | Manually archived | ZIP available, no gallery access |

### 17.2 Settings State Combinations

#### Required Fields Matrix
| Customer Email | Customer Name | Admin Email | Welcome Msg | Test Scenario |
|----------------|---------------|-------------|-------------|---------------|
| Required | Required | Required | Required | All fields mandatory |
| Required | Optional | Optional | Optional | Only email required |
| Optional | Required | Optional | Optional | Only name required |
| Optional | Optional | Optional | Optional | All fields optional |

**Test each combination:**
1. Configure settings
2. Attempt to create event with missing field
3. Verify validation works correctly

### 17.3 Theme State Testing
| Theme Setting | Layout | Test Points |
|---------------|--------|-------------|
| Classic Grid | grid | Uniform photo sizes |
| Elegant Wedding | hero | Hero image prominent |
| Modern Masonry | masonry | Varied photo heights |
| Birthday | carousel | Slideshow works |
| Corporate | timeline | Date grouping |
| Artistic | mosaic | Mixed sizes |

---

## 18. Test Execution Checklist

### Pre-Test Setup
- [ ] Start frontend dev server
- [ ] Start backend server
- [ ] Verify database connection
- [ ] Clear browser cache/cookies
- [ ] Set up MCP browser connection

### Test Execution Order
1. [ ] Authentication Tests (Section 1)
2. [ ] Dashboard Tests (Section 2)
3. [ ] Events Management Tests (Section 3)
4. [ ] Event Details Tests (Section 4)
5. [ ] Gallery Tests (Section 5)
6. [ ] Archives Tests (Section 6)
7. [ ] Settings Tests (Section 7)
8. [ ] Analytics Tests (Section 8)
9. [ ] Email Settings Tests (Section 9)
10. [ ] Branding Tests (Section 10)
11. [ ] Backup Tests (Section 11)
12. [ ] CMS Tests (Section 12)
13. [ ] Cross-Cutting Tests (Section 13)
14. [ ] Console Error Review (Section 14)
15. [ ] Network Request Review (Section 15)
16. [ ] Backend Log Review (Section 16)
17. [ ] State-Based Tests (Section 17)

### Post-Test Actions
- [ ] Document all failures
- [ ] Capture screenshots of issues
- [ ] Log console errors
- [ ] Note network failures
- [ ] Update test status

---

## 19. Test Result Summary Template

```markdown
## Test Results - [Date]

### Environment
- Frontend Version: x.x.x
- Backend Version: x.x.x
- Browser: Chrome/Firefox/Safari
- Tester: [Name]

### Summary
| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| Auth | X | X | X | X |
| Dashboard | X | X | X | X |
| ... | ... | ... | ... | ... |

### Critical Issues
1. [Issue description]
2. [Issue description]

### Translation Gaps
| Page | Missing Translation | Language |
|------|---------------------|----------|
| ... | ... | ... |

### Console Errors
| Page | Error | Severity |
|------|-------|----------|
| ... | ... | ... |

### Recommendations
1. [Recommendation]
2. [Recommendation]
```

---

## Appendix A: MCP Tool Reference

### Navigation
```javascript
mcp__playwright__browser_navigate({ url: "http://localhost:5173/admin/dashboard" })
```

### Take Snapshot
```javascript
mcp__playwright__browser_snapshot()
```

### Click Element
```javascript
mcp__playwright__browser_click({ element: "Description", ref: "e123" })
```

### Fill Form
```javascript
mcp__playwright__browser_type({ element: "Input field", ref: "e456", text: "value" })
```

### Check Console
```javascript
mcp__playwright__browser_console_messages({ level: "error" })
```

### Check Network
```javascript
mcp__chrome-devtools__list_network_requests({ resourceTypes: ["fetch", "xhr"] })
```

---

## Appendix B: Common Test Data

### Admin Credentials
- Username: `admin`
- Password: `admin` (or configured password)

### Test Event Data
```json
{
  "name": "Test Event",
  "date": "2026-01-15",
  "type": "wedding",
  "password": "test123",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "expiryDate": "2026-02-15"
}
```

### Test Gallery Password
- Default: `test123` or as configured per event

---

*Last Updated: January 2026*
*Version: 1.0*
