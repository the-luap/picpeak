# PicPeak Bug Report & Feature Requests

> **Generated:** January 2, 2026
> **Version:** Frontend v1.1.15 / Backend v1.1.15
> **Priority Levels:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)

---

## Table of Contents

1. [BUG-001: Logo Customization Section Formatting Issues](#bug-001-logo-customization-section-formatting-issues)
2. [BUG-002: Favicon Upload Section Missing Preview](#bug-002-favicon-upload-section-missing-preview)
3. [FEATURE-003: Custom CSS Instructions Panel](#feature-003-custom-css-instructions-panel)
4. [FEATURE-004: Custom CSS Integration with Theme Presets & Gallery Layouts](#feature-004-custom-css-integration-with-theme-presets--gallery-layouts)
5. [BUG-005: Custom Layouts Not Showing in Event Creation](#bug-005-custom-layouts-not-showing-in-event-creation)
6. [FEATURE-006: Apple Liquid Glass Design Custom CSS Templates](#feature-006-apple-liquid-glass-design-custom-css-templates)
7. [BUG-007: Typography & Style Section Row Formatting](#bug-007-typography--style-section-row-formatting)

---

## BUG-001: Logo Customization Section Formatting Issues

### Priority: P1 (High)

### Location
- **Page:** `/admin/branding`
- **Section:** Company Information → Logo Customization

### Current Behavior
1. The "Upload Logo" button appears as a plain text link instead of a proper button
2. No preview thumbnail is displayed when a logo has been uploaded
3. The layout doesn't show the currently uploaded logo image
4. Button styling is inconsistent with other upload buttons (e.g., Favicon)

### Expected Behavior
1. "Upload Logo" should be a styled button matching the "Upload Favicon" button style
2. When a logo is uploaded, a preview thumbnail should be displayed (similar to how other image uploads work)
3. A "Remove Logo" or "Change Logo" option should appear when a logo exists
4. The section should show:
   - Current logo preview (if uploaded)
   - Upload/Change button
   - Remove button (if logo exists)
   - File size/dimension info

### Technical Analysis

**Affected Component:** `frontend/src/pages/admin/BrandingPage.tsx` or similar

**Proposed Solution:**
```tsx
// Logo preview section structure
<div className="logo-upload-section">
  {currentLogo ? (
    <div className="logo-preview">
      <img src={currentLogo} alt="Current Logo" className="max-h-16 object-contain" />
      <div className="flex gap-2 mt-2">
        <Button variant="outline" onClick={handleChangeLogo}>
          <Upload className="w-4 h-4 mr-2" />
          Change Logo
        </Button>
        <Button variant="destructive" onClick={handleRemoveLogo}>
          <Trash className="w-4 h-4 mr-2" />
          Remove
        </Button>
      </div>
    </div>
  ) : (
    <Button variant="outline" onClick={handleUploadLogo}>
      <Upload className="w-4 h-4 mr-2" />
      Upload Logo
    </Button>
  )}
  <p className="text-sm text-muted">Recommended size: 200x60px, PNG or JPEG</p>
</div>
```

### Screenshots
- See: `.playwright-mcp/branding-logo-section.png`

---

## BUG-002: Favicon Upload Section Missing Preview

### Priority: P2 (Medium)

### Location
- **Page:** `/admin/branding`
- **Section:** Company Information → Favicon

### Current Behavior
1. Only shows "Upload Favicon" button
2. No preview of currently uploaded favicon
3. No way to see or remove existing favicon

### Expected Behavior
1. Display current favicon preview (32x32px thumbnail)
2. Show "Change Favicon" when one exists
3. Provide "Remove Favicon" option
4. Display file info (name, size) when uploaded

### Technical Analysis

**Proposed Solution:**
```tsx
<div className="favicon-upload-section">
  <label className="text-sm font-medium">Favicon</label>
  <div className="flex items-center gap-4 mt-2">
    {currentFavicon ? (
      <>
        <img
          src={currentFavicon}
          alt="Current Favicon"
          className="w-8 h-8 border rounded"
        />
        <Button variant="outline" size="sm" onClick={handleChangeFavicon}>
          Change Favicon
        </Button>
        <Button variant="ghost" size="sm" onClick={handleRemoveFavicon}>
          Remove
        </Button>
      </>
    ) : (
      <Button variant="outline" onClick={handleUploadFavicon}>
        <Upload className="w-4 h-4 mr-2" />
        Upload Favicon
      </Button>
    )}
  </div>
  <p className="text-xs text-muted mt-1">PNG or ICO format, recommended size: 32x32px</p>
</div>
```

---

## FEATURE-003: Custom CSS Instructions Panel

### Priority: P2 (Medium)

### Location
- **Page:** `/admin/settings` → Custom CSS tab

### Current Behavior
- Simple textarea with minimal guidance
- Only shows: "Advanced: Add custom CSS to further customize the appearance"
- CSS variables are documented in comments within the template

### Required Enhancement
Add a collapsible instruction panel with comprehensive documentation:

### Proposed Implementation

```tsx
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
    <HelpCircle className="w-4 h-4" />
    CSS Documentation & Guide
    <ChevronDown className="w-4 h-4" />
  </CollapsibleTrigger>
  <CollapsibleContent className="mt-4 p-4 bg-slate-50 rounded-lg">
    {/* Documentation content */}
  </CollapsibleContent>
</Collapsible>
```

### Documentation Content Structure

#### 1. Available CSS Custom Properties
```css
/* Color Variables */
--gallery-bg: #ffffff;           /* Main background color */
--gallery-bg-secondary: #f5f5f5; /* Secondary/card background */
--gallery-text: #171717;         /* Primary text color */
--gallery-text-muted: #737373;   /* Muted/secondary text */
--gallery-accent: #22c55e;       /* Accent/highlight color */
--gallery-accent-hover: #16a34a; /* Accent hover state */
--gallery-border: #e5e5e5;       /* Border color */

/* Spacing & Layout */
--gallery-spacing: 16px;         /* Base spacing unit */
--gallery-radius: 8px;           /* Border radius */
--gallery-shadow: 0 1px 3px rgba(0,0,0,0.1); /* Box shadow */

/* Typography */
--gallery-font-body: 'Inter', sans-serif;
--gallery-font-heading: 'Inter', sans-serif;
--gallery-font-size-base: 16px;
```

#### 2. Targetable CSS Classes
```css
/* Page Structure */
.gallery-page { }           /* Root gallery container */
.gallery-header { }         /* Header section */
.gallery-content { }        /* Main content area */
.gallery-footer { }         /* Footer section */

/* Photo Grid */
.photo-grid { }             /* Grid container */
.photo-card { }             /* Individual photo card */
.photo-card img { }         /* Photo image */
.photo-card-overlay { }     /* Hover overlay */
.photo-card-info { }        /* Photo metadata */

/* Lightbox */
.lightbox-overlay { }       /* Lightbox background */
.lightbox-content { }       /* Lightbox container */
.lightbox-image { }         /* Lightbox image */
.lightbox-controls { }      /* Navigation controls */

/* Buttons & Interactions */
.gallery-btn { }            /* Primary buttons */
.gallery-btn-secondary { }  /* Secondary buttons */
.gallery-link { }           /* Links */

/* Categories */
.category-filter { }        /* Category filter bar */
.category-pill { }          /* Category pill/tag */

/* Masonry Layout */
.masonry-grid { }           /* Masonry container */
.masonry-item { }           /* Masonry item */

/* Carousel Layout */
.carousel-container { }     /* Carousel wrapper */
.carousel-slide { }         /* Individual slide */
.carousel-nav { }           /* Navigation arrows */
.carousel-dots { }          /* Pagination dots */

/* Timeline Layout */
.timeline-container { }     /* Timeline wrapper */
.timeline-item { }          /* Timeline entry */
.timeline-date { }          /* Date marker */

/* Hero Layout */
.hero-section { }           /* Hero image area */
.hero-image { }             /* Featured image */
.hero-content { }           /* Hero text content */
```

#### 3. Layout-Specific Customization
```css
/* Grid Layout Customization */
.gallery-page[data-layout="grid"] .photo-grid {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--gallery-spacing);
}

/* Masonry Layout Customization */
.gallery-page[data-layout="masonry"] .masonry-grid {
  column-count: 4;
  column-gap: var(--gallery-spacing);
}

/* Carousel Layout Customization */
.gallery-page[data-layout="carousel"] .carousel-container {
  height: 80vh;
}

/* Timeline Layout Customization */
.gallery-page[data-layout="timeline"] .timeline-container {
  max-width: 1200px;
  margin: 0 auto;
}
```

#### 4. Responsive Breakpoints
```css
/* Mobile: < 640px */
@media (max-width: 639px) { }

/* Tablet: 640px - 1023px */
@media (min-width: 640px) and (max-width: 1023px) { }

/* Desktop: >= 1024px */
@media (min-width: 1024px) { }
```

#### 5. Animation Classes
```css
/* Available animations */
.animate-fade { }      /* Fade in */
.animate-scale { }     /* Scale up */
.animate-slide { }     /* Slide in */
.animate-none { }      /* No animation */
```

---

## FEATURE-004: Custom CSS Integration with Theme Presets & Gallery Layouts

### Priority: P0 (Critical)

### Location
- **Page:** `/admin/settings` → Custom CSS tab
- **Page:** `/admin/branding` → Gallery Theme section
- **Page:** `/admin/events/new` → Theme & Style section

### Current Behavior
- Custom CSS templates exist but are isolated
- Theme presets don't integrate with custom CSS
- Users cannot define custom theme presets
- Users cannot define custom gallery layouts
- No way to use CSS variables from theme presets

### Required Features

#### 4.1 Custom Theme Preset Creation

Users should be able to create custom theme presets that appear alongside built-in presets:

```typescript
interface CustomThemePreset {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  // Inherits from base preset or standalone
  basePreset?: 'classic-grid' | 'elegant-wedding' | 'modern-masonry' | null;
  // CSS template reference
  cssTemplateId: 1 | 2 | 3;
  // Override variables
  variables: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    fontBody: string;
    fontHeading: string;
    borderRadius: string;
    spacing: string;
  };
  // Layout settings
  layout: 'grid' | 'masonry' | 'carousel' | 'timeline' | 'hero' | 'mosaic' | 'custom';
  layoutSettings: {
    columns: { mobile: number; tablet: number; desktop: number };
    spacing: 'tight' | 'normal' | 'relaxed';
    animation: 'none' | 'fade' | 'scale' | 'slide';
  };
}
```

#### 4.2 Custom Gallery Layout Definition

Allow users to define custom layouts via CSS:

```css
/* Custom Layout 1: Magazine Style */
.gallery-page[data-layout="custom-1"] .photo-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: auto;
  gap: 8px;
}

.gallery-page[data-layout="custom-1"] .photo-card:first-child {
  grid-row: span 2;
}

/* Custom Layout 2: Polaroid Style */
.gallery-page[data-layout="custom-2"] .photo-card {
  background: white;
  padding: 12px 12px 40px 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transform: rotate(var(--rotation, 0deg));
}

/* Custom Layout 3: Filmstrip */
.gallery-page[data-layout="custom-3"] .photo-grid {
  display: flex;
  overflow-x: auto;
  gap: 4px;
  padding: 20px;
  background: #1a1a1a;
}
```

#### 4.3 Variable Inheritance System

Custom CSS should be able to reference theme preset variables:

```css
/* Access theme preset variables */
.gallery-page {
  /* These come from the selected theme preset */
  background: var(--theme-bg, var(--gallery-bg));
  color: var(--theme-text, var(--gallery-text));

  /* Override specific elements */
  --gallery-accent: var(--theme-accent);
}

/* Conditional styling based on preset */
.gallery-page[data-preset="elegant-wedding"] {
  /* Wedding-specific overrides */
}

.gallery-page[data-preset="custom"] {
  /* Full custom styling */
}
```

### Database Schema Addition

```sql
-- Custom theme presets table
CREATE TABLE custom_theme_presets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  base_preset VARCHAR(50),
  css_template_id INTEGER REFERENCES css_templates(id),
  variables JSONB NOT NULL DEFAULT '{}',
  layout VARCHAR(50) NOT NULL DEFAULT 'grid',
  layout_settings JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link events to custom presets
ALTER TABLE events ADD COLUMN custom_preset_id INTEGER REFERENCES custom_theme_presets(id);
```

### UI Components Required

1. **Theme Preset Builder** - Visual editor for creating custom presets
2. **Layout Designer** - CSS grid/flexbox visual editor for custom layouts
3. **Variable Picker** - Color/font/spacing picker that outputs CSS variables
4. **Preview Synchronization** - Real-time preview of custom themes

---

## BUG-005: Custom Layouts Not Showing in Event Creation

### Priority: P1 (High)

### Location
- **Page:** `/admin/events/new` → Theme & Style → Gallery Layout

### Current Behavior
- Only shows 6 default layouts: grid, masonry, carousel, timeline, hero, mosaic
- Custom CSS templates with enabled custom layouts don't appear
- No "Custom 1", "Custom 2", "Custom 3" options visible

### Expected Behavior
When Custom CSS templates are enabled in Settings:
1. Additional layout options should appear: "Custom 1", "Custom 2", "Custom 3"
2. Only show custom layouts that have content (non-empty CSS)
3. Display the template name as the layout name
4. Show a preview thumbnail if available

### Technical Analysis

**Current Gallery Layout Options:**
```typescript
const GALLERY_LAYOUTS = [
  { value: 'grid', label: 'Grid', description: 'Classic grid layout...' },
  { value: 'masonry', label: 'Masonry', description: 'Pinterest-style...' },
  { value: 'carousel', label: 'Carousel', description: 'Full-screen slideshow...' },
  { value: 'timeline', label: 'Timeline', description: 'Photos organized by date' },
  { value: 'hero', label: 'Hero', description: 'Featured image with grid...' },
  { value: 'mosaic', label: 'Mosaic', description: 'Artistic layout...' },
];
```

**Required Addition:**
```typescript
// Fetch enabled custom templates
const { data: customTemplates } = useQuery({
  queryKey: ['customCssTemplates'],
  queryFn: () => settingsService.getCustomCssTemplates(),
});

// Filter to only enabled templates with content
const enabledCustomLayouts = customTemplates
  ?.filter(t => t.enabled && t.content?.trim())
  .map((t, index) => ({
    value: `custom-${index + 1}`,
    label: t.name || `Custom ${index + 1}`,
    description: 'Custom CSS layout template',
    isCustom: true,
  }));

const allLayouts = [...GALLERY_LAYOUTS, ...(enabledCustomLayouts || [])];
```

### API Endpoint Required

```typescript
// GET /api/admin/settings/custom-css-templates
interface CustomCssTemplate {
  id: number;
  name: string;
  enabled: boolean;
  content: string;
  hasLayoutDefinition: boolean; // true if contains custom layout CSS
}
```

---

## FEATURE-006: Apple Liquid Glass Design Custom CSS Templates

### Priority: P2 (Medium)

### Overview
Create 2 premium custom CSS templates implementing Apple's "Liquid Glass" design language introduced at WWDC 2025. This design features translucent surfaces, dynamic light refraction effects, and sophisticated blur treatments.

### References
- [Apple's Liquid Glass UI design + CSS guide](https://dev.to/gruszdev/apples-liquid-glass-revolution-how-glassmorphism-is-shaping-ui-design-in-2025-with-css-code-1221)
- [Recreating Apple's Liquid Glass Effect with Pure CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)
- [CSS-Tricks: Getting Clarity on Apple's Liquid Glass](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/)
- [Liquid Glass CSS Generator](https://liquidglassgen.com/)

### Template 1: "Liquid Glass Light"

A light-themed glassmorphism design with subtle transparency and soft shadows.

```css
/*
 * PicPeak Custom CSS Template: Liquid Glass Light
 * Inspired by Apple's iOS 26 Liquid Glass Design Language
 *
 * Features:
 * - Translucent frosted glass surfaces
 * - Dynamic light refraction effects
 * - Subtle specular highlights
 * - Soft depth shadows
 */

/* ===== Base Theme Variables ===== */
.gallery-page {
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-bg-elevated: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(255, 255, 255, 0.5);
  --glass-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
  --glass-blur: 20px;
  --glass-saturation: 180%;

  --gallery-bg: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  --gallery-text: #1a1a2e;
  --gallery-text-muted: rgba(26, 26, 46, 0.7);
  --gallery-accent: #667eea;
  --gallery-accent-hover: #764ba2;
  --gallery-radius: 24px;
  --gallery-spacing: 20px;
}

/* ===== Page Background ===== */
.gallery-page {
  background: var(--gallery-bg);
  min-height: 100vh;
  position: relative;
}

/* Animated gradient background */
.gallery-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.2) 0%, transparent 40%);
  pointer-events: none;
  z-index: 0;
}

/* ===== Glass Card Base ===== */
.glass-surface {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 1px rgba(255, 255, 255, 0.8),
    inset 0 -1px 1px rgba(0, 0, 0, 0.05);
}

/* Liquid shine effect */
.glass-surface::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  border-radius: var(--gallery-radius) var(--gallery-radius) 0 0;
  pointer-events: none;
}

/* ===== Gallery Header ===== */
.gallery-header {
  background: var(--glass-bg-elevated);
  backdrop-filter: blur(30px) saturate(200%);
  -webkit-backdrop-filter: blur(30px) saturate(200%);
  border-bottom: 1px solid var(--glass-border);
  padding: calc(var(--gallery-spacing) * 1.5);
  position: sticky;
  top: 0;
  z-index: 100;
}

.gallery-title {
  color: var(--gallery-text);
  font-weight: 700;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
}

/* ===== Photo Grid ===== */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--gallery-spacing);
  padding: calc(var(--gallery-spacing) * 2);
  position: relative;
  z-index: 1;
}

/* ===== Photo Cards - Glass Style ===== */
.photo-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px rgba(255, 255, 255, 0.6);
}

.photo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.3) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
  border-radius: var(--gallery-radius) var(--gallery-radius) 0 0;
}

.photo-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow:
    0 20px 40px rgba(102, 126, 234, 0.3),
    0 8px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px rgba(255, 255, 255, 0.8);
}

.photo-card img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.photo-card:hover img {
  transform: scale(1.05);
}

.photo-card-info {
  padding: var(--gallery-spacing);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.3) 100%
  );
}

/* ===== Buttons - Glass Style ===== */
.gallery-btn {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: calc(var(--gallery-radius) / 2);
  padding: 12px 24px;
  color: var(--gallery-text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.gallery-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.4) 0%,
    transparent 100%
  );
}

.gallery-btn:hover {
  background: var(--glass-bg-elevated);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.gallery-btn-primary {
  background: linear-gradient(135deg, var(--gallery-accent) 0%, var(--gallery-accent-hover) 100%);
  color: white;
  border: none;
}

/* ===== Lightbox - Glass Style ===== */
.lightbox-overlay {
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
}

.lightbox-content {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}

/* ===== Category Pills ===== */
.category-pill {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: 9999px;
  padding: 8px 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gallery-text);
  transition: all 0.3s ease;
}

.category-pill:hover,
.category-pill.active {
  background: var(--gallery-accent);
  color: white;
  border-color: var(--gallery-accent);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .gallery-page {
    --gallery-radius: 16px;
    --gallery-spacing: 12px;
    --glass-blur: 16px;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .photo-card img {
    height: 180px;
  }
}

/* ===== Accessibility: Reduce Motion ===== */
@media (prefers-reduced-motion: reduce) {
  .photo-card,
  .gallery-btn {
    transition: none;
  }

  .photo-card:hover {
    transform: none;
  }
}

/* ===== Accessibility: Reduce Transparency ===== */
@media (prefers-reduced-transparency: reduce) {
  .glass-surface,
  .photo-card,
  .gallery-btn {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(255, 255, 255, 0.95);
  }
}
```

### Template 2: "Liquid Glass Dark"

A dark-themed glassmorphism design with deep translucency and neon accents.

```css
/*
 * PicPeak Custom CSS Template: Liquid Glass Dark
 * Inspired by Apple's iOS 26 Liquid Glass Design Language
 *
 * Features:
 * - Deep translucent dark surfaces
 * - Neon accent highlights
 * - Dramatic glass reflections
 * - Subtle animated gradients
 */

/* ===== Base Theme Variables ===== */
.gallery-page {
  --glass-bg: rgba(15, 15, 35, 0.7);
  --glass-bg-elevated: rgba(25, 25, 55, 0.85);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-border-highlight: rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --glass-blur: 24px;
  --glass-saturation: 150%;

  --gallery-bg: #0a0a1a;
  --gallery-text: #f0f0f5;
  --gallery-text-muted: rgba(240, 240, 245, 0.6);
  --gallery-accent: #00d4ff;
  --gallery-accent-secondary: #ff00e5;
  --gallery-accent-hover: #00ffea;
  --gallery-radius: 20px;
  --gallery-spacing: 20px;

  /* Neon glow variables */
  --neon-glow: 0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(0, 212, 255, 0.2);
  --neon-glow-secondary: 0 0 20px rgba(255, 0, 229, 0.5), 0 0 40px rgba(255, 0, 229, 0.2);
}

/* ===== Page Background ===== */
.gallery-page {
  background: var(--gallery-bg);
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Animated mesh gradient background */
.gallery-page::before {
  content: '';
  position: fixed;
  top: -50%;
  left: -50%;
  right: -50%;
  bottom: -50%;
  background:
    radial-gradient(circle at 30% 20%, rgba(0, 212, 255, 0.15) 0%, transparent 40%),
    radial-gradient(circle at 70% 80%, rgba(255, 0, 229, 0.1) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(100, 100, 255, 0.05) 0%, transparent 60%);
  animation: gradientShift 20s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes gradientShift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(2%, 2%) rotate(1deg); }
  50% { transform: translate(-1%, 3%) rotate(-1deg); }
  75% { transform: translate(3%, -2%) rotate(2deg); }
}

/* ===== Gallery Header ===== */
.gallery-header {
  background: var(--glass-bg-elevated);
  backdrop-filter: blur(30px) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(30px) saturate(var(--glass-saturation));
  border-bottom: 1px solid var(--glass-border-highlight);
  padding: calc(var(--gallery-spacing) * 1.5);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.gallery-title {
  color: var(--gallery-text);
  font-weight: 700;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--gallery-text) 0%, var(--gallery-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ===== Photo Grid ===== */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--gallery-spacing);
  padding: calc(var(--gallery-spacing) * 2);
  position: relative;
  z-index: 1;
}

/* ===== Photo Cards - Dark Glass Style ===== */
.photo-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Top highlight reflection */
.photo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  z-index: 2;
}

/* Inner glow effect */
.photo-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--gallery-radius);
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(0, 212, 255, 0) 0%,
    rgba(0, 212, 255, 0) 40%,
    rgba(0, 212, 255, 0.1) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.photo-card:hover {
  transform: translateY(-8px) scale(1.02);
  border-color: var(--glass-border-highlight);
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 212, 255, 0.2),
    var(--neon-glow);
}

.photo-card:hover::after {
  opacity: 1;
}

.photo-card img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  transition: transform 0.4s ease, filter 0.4s ease;
  filter: brightness(0.9);
}

.photo-card:hover img {
  transform: scale(1.05);
  filter: brightness(1);
}

.photo-card-info {
  padding: var(--gallery-spacing);
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.2) 0%,
    rgba(0, 0, 0, 0.4) 100%
  );
  color: var(--gallery-text);
}

.photo-card-info p {
  color: var(--gallery-text-muted);
  font-size: 0.875rem;
}

/* ===== Buttons - Neon Glass Style ===== */
.gallery-btn {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: calc(var(--gallery-radius) / 2);
  padding: 12px 24px;
  color: var(--gallery-text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.gallery-btn:hover {
  border-color: var(--gallery-accent);
  box-shadow: var(--neon-glow);
  color: var(--gallery-accent);
}

.gallery-btn-primary {
  background: linear-gradient(135deg, var(--gallery-accent) 0%, var(--gallery-accent-secondary) 100%);
  color: white;
  border: none;
  box-shadow: var(--neon-glow);
}

.gallery-btn-primary:hover {
  box-shadow:
    0 0 30px rgba(0, 212, 255, 0.6),
    0 0 60px rgba(0, 212, 255, 0.3),
    0 0 90px rgba(255, 0, 229, 0.2);
  transform: translateY(-2px);
}

/* ===== Lightbox - Dark Glass ===== */
.lightbox-overlay {
  background: rgba(5, 5, 15, 0.9);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
}

.lightbox-content {
  background: var(--glass-bg-elevated);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border-highlight);
  border-radius: var(--gallery-radius);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.5),
    var(--neon-glow);
}

/* ===== Category Pills ===== */
.category-pill {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: 9999px;
  padding: 8px 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gallery-text-muted);
  transition: all 0.3s ease;
}

.category-pill:hover {
  border-color: var(--gallery-accent);
  color: var(--gallery-accent);
  box-shadow: var(--neon-glow);
}

.category-pill.active {
  background: linear-gradient(135deg, var(--gallery-accent) 0%, var(--gallery-accent-secondary) 100%);
  color: white;
  border-color: transparent;
  box-shadow: var(--neon-glow);
}

/* ===== Scrollbar Styling ===== */
.gallery-page ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gallery-page ::-webkit-scrollbar-track {
  background: var(--glass-bg);
  border-radius: 4px;
}

.gallery-page ::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--gallery-accent) 0%, var(--gallery-accent-secondary) 100%);
  border-radius: 4px;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .gallery-page {
    --gallery-radius: 16px;
    --gallery-spacing: 12px;
    --glass-blur: 16px;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .photo-card img {
    height: 180px;
  }

  /* Reduce animation complexity on mobile */
  .gallery-page::before {
    animation: none;
  }
}

/* ===== Accessibility: Reduce Motion ===== */
@media (prefers-reduced-motion: reduce) {
  .gallery-page::before {
    animation: none;
  }

  .photo-card,
  .gallery-btn {
    transition: none;
  }

  .photo-card:hover {
    transform: none;
  }
}

/* ===== Accessibility: Reduce Transparency ===== */
@media (prefers-reduced-transparency: reduce) {
  .photo-card,
  .gallery-btn,
  .gallery-header {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .gallery-page {
    --glass-bg: rgba(20, 20, 40, 0.98);
    --glass-bg-elevated: rgba(30, 30, 60, 0.98);
  }
}
```

---

## BUG-007: Typography & Style Section Row Formatting

### Priority: P2 (Medium)

### Location
- **Page:** `/admin/events/new` → Theme & Style → Typography & Style section
- **Page:** `/admin/branding` → Gallery Theme → Typography & Style section

### Current Behavior
The second row of Typography & Style section contains 4 dropdown fields crammed into one row:
- Font Size
- Border Radius
- Shadow Style
- Background

These fields are truncated and show abbreviated text (e.g., "Nor", "Lar", "Sub") because they don't have enough horizontal space.

### Expected Behavior
Split the 4 fields into 2 rows of 2 fields each:
- **Row 1:** Font Size, Border Radius
- **Row 2:** Shadow Style, Background

### Screenshots
- See: `.playwright-mcp/typography-style-visible.png`

### Technical Analysis

**Current Code Structure (likely):**
```tsx
<div className="grid grid-cols-4 gap-4">
  <FormField label="Font Size" ... />
  <FormField label="Border Radius" ... />
  <FormField label="Shadow Style" ... />
  <FormField label="Background" ... />
</div>
```

**Proposed Fix:**
```tsx
{/* Row 1: Font Size & Border Radius */}
<div className="grid grid-cols-2 gap-4">
  <FormField label="Font Size">
    <Select value={fontSize} onValueChange={setFontSize}>
      <SelectItem value="small">Small</SelectItem>
      <SelectItem value="normal">Normal</SelectItem>
      <SelectItem value="large">Large</SelectItem>
    </Select>
  </FormField>
  <FormField label="Border Radius">
    <Select value={borderRadius} onValueChange={setBorderRadius}>
      <SelectItem value="none">None</SelectItem>
      <SelectItem value="small">Small</SelectItem>
      <SelectItem value="medium">Medium</SelectItem>
      <SelectItem value="large">Large</SelectItem>
    </Select>
  </FormField>
</div>

{/* Row 2: Shadow Style & Background */}
<div className="grid grid-cols-2 gap-4 mt-4">
  <FormField label="Shadow Style">
    <Select value={shadowStyle} onValueChange={setShadowStyle}>
      <SelectItem value="none">None</SelectItem>
      <SelectItem value="subtle">Subtle</SelectItem>
      <SelectItem value="normal">Normal</SelectItem>
      <SelectItem value="dramatic">Dramatic</SelectItem>
    </Select>
  </FormField>
  <FormField label="Background">
    <Select value={background} onValueChange={setBackground}>
      <SelectItem value="none">None</SelectItem>
      <SelectItem value="dots">Dots</SelectItem>
      <SelectItem value="grid">Grid</SelectItem>
      <SelectItem value="waves">Waves</SelectItem>
    </Select>
  </FormField>
</div>
```

### Files to Modify
1. `frontend/src/pages/admin/EventCreatePage.tsx` (or similar)
2. `frontend/src/pages/admin/BrandingPage.tsx`
3. `frontend/src/components/admin/ThemeCustomizer.tsx` (if shared component)

---

## Implementation Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | FEATURE-004: Custom CSS + Theme Integration | High | Critical for customization |
| P1 | BUG-001: Logo Upload Formatting | Medium | User experience |
| P1 | BUG-005: Custom Layouts in Events | Medium | Feature completeness |
| P2 | BUG-002: Favicon Preview | Low | User experience |
| P2 | BUG-007: Typography Row Layout | Low | UI polish |
| P2 | FEATURE-003: CSS Instructions | Medium | User guidance |
| P2 | FEATURE-006: Liquid Glass Templates | Medium | Premium feature |

---

## Testing Checklist

### BUG-001 & BUG-002
- [ ] Logo upload displays preview after upload
- [ ] Logo can be changed/removed
- [ ] Favicon upload displays preview
- [ ] Favicon can be changed/removed
- [ ] Button styling matches design system

### FEATURE-003
- [ ] Collapsible instructions panel works
- [ ] All CSS variables documented
- [ ] All CSS classes documented
- [ ] Code examples copy correctly

### FEATURE-004
- [ ] Custom theme presets can be created
- [ ] Custom presets appear in event creation
- [ ] CSS variables from presets work in custom CSS
- [ ] Custom layouts render correctly

### BUG-005
- [ ] Enabled custom templates show in layout selector
- [ ] Only templates with content appear
- [ ] Custom layouts apply correctly to galleries

### FEATURE-006
- [ ] Liquid Glass Light template renders correctly
- [ ] Liquid Glass Dark template renders correctly
- [ ] Animations respect prefers-reduced-motion
- [ ] Transparency respects prefers-reduced-transparency
- [ ] Mobile responsiveness works

### BUG-007
- [ ] Typography section shows 2 items per row
- [ ] Dropdown labels fully visible
- [ ] Responsive behavior maintained

---

*Document generated for PicPeak development team*
