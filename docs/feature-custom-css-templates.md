# Feature: Custom CSS Gallery Templates

## Overview

This feature allows administrators to create and manage up to 3 custom CSS templates for gallery styling. Each template can be edited via a tabbed interface in the admin panel and selected when creating or editing events. The first template slot includes a working example template.

**GitHub Issue:** Gallery Templates - Additional gallery layouts and themes

---

## Problem Statement

Currently, gallery styling is limited to the built-in theme system with predefined color schemes. Photographers and administrators need:
- Full CSS customization capabilities for unique branding
- Ability to create multiple reusable style templates
- Easy switching between templates for different event types
- Professional-grade CSS editing experience

---

## User Story

As an administrator, I want to create custom CSS templates for my galleries so that I can offer unique visual experiences for different clients and event types while maintaining my brand identity.

---

## Feature Requirements

### 1. Custom CSS Template System

#### 1.1 Template Slots
- **3 custom CSS template slots** available system-wide
- Each slot has:
  - Name/label (editable, max 50 characters)
  - CSS content (unlimited, stored as TEXT)
  - Active/enabled toggle
  - Last modified timestamp

#### 1.2 Default Template (Slot 1)
- Pre-populated with a working example template
- Demonstrates available CSS custom properties
- Can be modified but shows "Reset to Default" option

### 2. Admin UI - Template Editor

#### 2.1 Location
**Path:** Admin Panel → Settings → Styling → Custom CSS Templates (new tab)

#### 2.2 Tabbed Interface
```
┌─────────────────────────────────────────────────────────────────┐
│ Settings > Styling                                               │
├─────────────────────────────────────────────────────────────────┤
│ [Theme] [Colors] [Custom CSS Templates]  ← NEW TAB              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┬──────────────┬──────────────┐                │
│  │ Template 1   │ Template 2   │ Template 3   │                │
│  │ (Elegant)    │ (Untitled)   │ (Untitled)   │                │
│  └──────────────┴──────────────┴──────────────┘                │
│                                                                  │
│  Template Name: [Elegant Dark_______________]                   │
│                                                                  │
│  [✓] Enable this template                                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ /* Elegant Dark Theme */                                 │   │
│  │ :root {                                                  │   │
│  │   --gallery-bg: #1a1a2e;                                │   │
│  │   --gallery-text: #eaeaea;                              │   │
│  │   --gallery-accent: #e94560;                            │   │
│  │ }                                                        │   │
│  │                                                          │   │
│  │ .gallery-container {                                     │   │
│  │   background: var(--gallery-bg);                        │   │
│  │ }                                                        │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  CSS Editor (CodeMirror)                                        │
│  Line: 1  Col: 1  |  Valid CSS ✓                               │
│                                                                  │
│  [Preview] [Reset to Default*] [Save Template]                  │
│                                                                  │
│  * Only shown for Template 1                                    │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3 CSS Editor Features
- **CodeMirror integration** with CSS mode
- Syntax highlighting
- Auto-completion for CSS properties
- Line numbers
- Real-time CSS validation
- Error highlighting
- Find/replace functionality
- Bracket matching

### 3. Event Integration

#### 3.1 Event Creation/Edit Form
Add template selector dropdown:

```
┌─────────────────────────────────────────────────────────────────┐
│ Event Details                                                    │
├─────────────────────────────────────────────────────────────────┤
│ ...                                                              │
│                                                                  │
│ Gallery Styling                                                  │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Custom CSS Template                                      │    │
│ │ ┌───────────────────────────────────────────────────┐   │    │
│ │ │ None (Use default theme)                      ▼   │   │    │
│ │ │ ─────────────────────────────────────────────────│   │    │
│ │ │ ○ None (Use default theme)                       │   │    │
│ │ │ ○ Elegant Dark                                   │   │    │
│ │ │ ○ Template 2 (disabled)                          │   │    │
│ │ │ ○ Minimalist White                               │   │    │
│ │ └───────────────────────────────────────────────────┘   │    │
│ │                                                          │    │
│ │ [Preview Template]                                       │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ...                                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Template Selection Rules
- Only enabled templates appear in dropdown
- "None" option always available (uses default theme)
- Disabled templates show "(disabled)" and cannot be selected
- Selected template ID stored in events table

### 4. Gallery Frontend Application

#### 4.1 CSS Loading
When gallery loads:
1. Check if event has `css_template_id` set
2. If set, fetch template CSS from API
3. Inject CSS into `<style id="custom-gallery-css">` tag
4. Apply after base styles (cascading override)

#### 4.2 CSS Scoping
All custom CSS is scoped to gallery pages only:
- Prepend `.gallery-page` selector to all rules (server-side)
- Or use CSS nesting with `.gallery-page { ... }`

---

## Technical Specification

### 5. Database Changes

#### 5.1 New Table: `css_templates`

```sql
CREATE TABLE css_templates (
  id SERIAL PRIMARY KEY,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
  name VARCHAR(50) NOT NULL DEFAULT 'Untitled',
  css_content TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(slot_number)
);

-- Insert default templates
INSERT INTO css_templates (slot_number, name, css_content, is_enabled, is_default) VALUES
(1, 'Elegant Dark', '/* See default template below */', true, true),
(2, 'Untitled', '', false, false),
(3, 'Untitled', '', false, false);
```

#### 5.2 Events Table Update

```sql
ALTER TABLE events ADD COLUMN css_template_id INTEGER REFERENCES css_templates(id) ON DELETE SET NULL;
```

#### 5.3 Migration File

**File:** `/backend/migrations/core/YYYYMMDDHHMMSS_add_css_templates.js`

```javascript
exports.up = function(knex) {
  return knex.schema
    .createTable('css_templates', (table) => {
      table.increments('id').primary();
      table.integer('slot_number').notNullable().checkBetween([1, 3]);
      table.string('name', 50).notNullable().defaultTo('Untitled');
      table.text('css_content').notNullable().defaultTo('');
      table.boolean('is_enabled').notNullable().defaultTo(false);
      table.boolean('is_default').notNullable().defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique('slot_number');
    })
    .then(() => {
      // Insert default templates
      return knex('css_templates').insert([
        {
          slot_number: 1,
          name: 'Elegant Dark',
          css_content: DEFAULT_CSS_TEMPLATE, // Constant defined below
          is_enabled: true,
          is_default: true
        },
        { slot_number: 2, name: 'Untitled', css_content: '', is_enabled: false, is_default: false },
        { slot_number: 3, name: 'Untitled', css_content: '', is_enabled: false, is_default: false }
      ]);
    })
    .then(() => {
      return knex.schema.alterTable('events', (table) => {
        table.integer('css_template_id').references('id').inTable('css_templates').onDelete('SET NULL');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('events', (table) => {
      table.dropColumn('css_template_id');
    })
    .then(() => {
      return knex.schema.dropTable('css_templates');
    });
};
```

---

### 6. Security Implementation

#### 6.1 CSS Sanitization (Critical)

**Security Risks:**
- CSS injection attacks
- JavaScript execution via `url()`, `expression()`, `behavior`
- Data exfiltration via `background-image: url()`
- UI redress attacks

**Sanitization Rules:**

```javascript
// /backend/src/utils/cssSanitizer.js

const FORBIDDEN_PATTERNS = [
  // JavaScript execution
  /expression\s*\(/gi,
  /javascript:/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,

  // External resources (potential data exfiltration)
  /url\s*\(\s*["']?(?!data:image)/gi, // Allow only data: URIs for images
  /@import/gi,

  // Dangerous at-rules
  /@charset/gi,
  /@namespace/gi,

  // IE-specific exploits
  /\\0/g,  // Null byte
  /\\9/g,  // IE CSS hack
];

const ALLOWED_PROPERTIES = new Set([
  // Layout
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'float', 'clear', 'z-index', 'overflow', 'overflow-x', 'overflow-y',

  // Box model
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-width', 'border-style', 'border-color', 'border-radius',

  // Flexbox
  'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
  'align-content', 'gap', 'row-gap', 'column-gap',

  // Grid
  'grid', 'grid-template-columns', 'grid-template-rows', 'grid-gap',

  // Typography
  'font', 'font-family', 'font-size', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'text-align', 'text-decoration',
  'text-transform', 'color',

  // Visual
  'background', 'background-color', 'background-image', 'background-size',
  'background-position', 'background-repeat',
  'opacity', 'visibility', 'box-shadow', 'filter',

  // Transforms & Animations
  'transform', 'transition', 'animation',

  // Custom properties
  '--gallery-bg', '--gallery-text', '--gallery-accent', '--gallery-border',
  '--gallery-shadow', '--gallery-radius', '--gallery-spacing',
]);

function sanitizeCSS(cssContent) {
  let sanitized = cssContent;

  // Remove forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, '/* BLOCKED */');
  }

  // Validate and filter properties (using css-tree or postcss)
  // ... additional parsing and validation

  return sanitized;
}

module.exports = { sanitizeCSS, ALLOWED_PROPERTIES };
```

#### 6.2 Content Security Policy

Add CSP header for gallery pages:

```javascript
// Gallery CSP (allows inline styles for custom CSS)
app.use('/gallery', (req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +  // Allow custom CSS
    "img-src 'self' data: blob:; " +
    "script-src 'self'; " +
    "font-src 'self' data:;"
  );
  next();
});
```

#### 6.3 CSS Size Limits

- Maximum CSS content: **100KB per template**
- Maximum total CSS: **300KB (all templates)**
- Rate limiting on save: **10 saves per minute**

---

### 7. API Endpoints

#### 7.1 Get All Templates (Admin)

```
GET /api/admin/css-templates
```

**Response:**
```json
{
  "templates": [
    {
      "id": 1,
      "slot_number": 1,
      "name": "Elegant Dark",
      "css_content": "/* CSS content */",
      "is_enabled": true,
      "is_default": true,
      "updated_at": "2026-01-02T10:00:00Z"
    },
    // ... templates 2 and 3
  ]
}
```

#### 7.2 Update Template (Admin)

```
PUT /api/admin/css-templates/:slotNumber
```

**Request:**
```json
{
  "name": "Elegant Dark",
  "css_content": "/* CSS content */",
  "is_enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "template": { /* updated template */ },
  "sanitization_warnings": [] // Any patterns that were blocked
}
```

#### 7.3 Reset Template to Default (Admin)

```
POST /api/admin/css-templates/:slotNumber/reset
```

**Response:**
```json
{
  "success": true,
  "template": { /* template with default CSS */ }
}
```

#### 7.4 Get Enabled Templates (For Event Form)

```
GET /api/admin/css-templates/enabled
```

**Response:**
```json
{
  "templates": [
    { "id": 1, "name": "Elegant Dark" },
    { "id": 3, "name": "Minimalist White" }
  ]
}
```

#### 7.5 Get Template CSS (Public - For Gallery)

```
GET /api/gallery/:slug/css-template
```

**Response:**
```css
/* Sanitized CSS content */
.gallery-page {
  --gallery-bg: #1a1a2e;
  ...
}
```

---

### 8. Backend Implementation

#### 8.1 Route File

**File:** `/backend/src/routes/adminCssTemplates.js`

```javascript
const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const db = require('../database/db');
const { sanitizeCSS } = require('../utils/cssSanitizer');

const MAX_CSS_SIZE = 100 * 1024; // 100KB

// Get all templates
router.get('/', adminAuth, async (req, res) => {
  try {
    const templates = await db('css_templates')
      .orderBy('slot_number');
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get enabled templates (for event form dropdown)
router.get('/enabled', adminAuth, async (req, res) => {
  try {
    const templates = await db('css_templates')
      .where({ is_enabled: true })
      .select('id', 'name')
      .orderBy('slot_number');
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Update template
router.put('/:slotNumber', adminAuth, async (req, res) => {
  try {
    const { slotNumber } = req.params;
    const { name, css_content, is_enabled } = req.body;

    // Validate slot number
    if (slotNumber < 1 || slotNumber > 3) {
      return res.status(400).json({ error: 'Invalid slot number' });
    }

    // Validate CSS size
    if (css_content && css_content.length > MAX_CSS_SIZE) {
      return res.status(400).json({
        error: `CSS content exceeds maximum size of ${MAX_CSS_SIZE / 1024}KB`
      });
    }

    // Sanitize CSS
    const { sanitized, warnings } = sanitizeCSS(css_content || '');

    const updated = await db('css_templates')
      .where({ slot_number: slotNumber })
      .update({
        name: name?.substring(0, 50) || 'Untitled',
        css_content: sanitized,
        is_enabled: Boolean(is_enabled),
        updated_at: db.fn.now()
      })
      .returning('*');

    res.json({
      success: true,
      template: updated[0],
      sanitization_warnings: warnings
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Reset to default
router.post('/:slotNumber/reset', adminAuth, async (req, res) => {
  try {
    const { slotNumber } = req.params;

    if (slotNumber !== '1') {
      return res.status(400).json({
        error: 'Only template 1 can be reset to default'
      });
    }

    const updated = await db('css_templates')
      .where({ slot_number: 1 })
      .update({
        name: 'Elegant Dark',
        css_content: DEFAULT_CSS_TEMPLATE,
        is_enabled: true,
        updated_at: db.fn.now()
      })
      .returning('*');

    res.json({ success: true, template: updated[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset template' });
  }
});

module.exports = router;
```

#### 8.2 Gallery Route Update

**File:** `/backend/src/routes/gallery.js` (update)

```javascript
// Add endpoint for fetching event's CSS template
router.get('/:slug/css-template', async (req, res) => {
  try {
    const { slug } = req.params;

    const event = await db('events')
      .where({ slug })
      .select('css_template_id')
      .first();

    if (!event || !event.css_template_id) {
      return res.status(204).send(); // No custom CSS
    }

    const template = await db('css_templates')
      .where({ id: event.css_template_id, is_enabled: true })
      .select('css_content')
      .first();

    if (!template) {
      return res.status(204).send();
    }

    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.send(template.css_content);
  } catch (error) {
    res.status(500).send('/* Error loading template */');
  }
});
```

---

### 9. Frontend Implementation

#### 9.1 New Components

**File:** `/frontend/src/components/admin/CssTemplateEditor.tsx`

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css } from '@codemirror/lang-css';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

interface CssTemplate {
  id: number;
  slot_number: number;
  name: string;
  css_content: string;
  is_enabled: boolean;
  is_default: boolean;
  updated_at: string;
}

const CssTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<CssTemplate[]>([]);
  const [activeSlot, setActiveSlot] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const activeTemplate = templates.find(t => t.slot_number === activeSlot);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const response = await fetch('/api/admin/css-templates');
    const data = await response.json();
    setTemplates(data.templates);
  };

  const handleSave = async () => {
    if (!activeTemplate) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/css-templates/${activeSlot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeTemplate.name,
          css_content: activeTemplate.css_content,
          is_enabled: activeTemplate.is_enabled
        })
      });

      const data = await response.json();
      if (data.sanitization_warnings?.length > 0) {
        // Show warnings to user
      }

      await fetchTemplates();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (activeSlot !== 1) return;

    const confirmed = window.confirm(
      'Reset this template to the default? Your changes will be lost.'
    );
    if (!confirmed) return;

    await fetch(`/api/admin/css-templates/1/reset`, { method: 'POST' });
    await fetchTemplates();
  };

  const updateTemplate = (updates: Partial<CssTemplate>) => {
    setTemplates(prev => prev.map(t =>
      t.slot_number === activeSlot ? { ...t, ...updates } : t
    ));
  };

  return (
    <div className="css-template-editor">
      {/* Tab Navigation */}
      <div className="template-tabs">
        {[1, 2, 3].map(slot => {
          const template = templates.find(t => t.slot_number === slot);
          return (
            <button
              key={slot}
              className={`template-tab ${activeSlot === slot ? 'active' : ''}`}
              onClick={() => setActiveSlot(slot)}
            >
              Template {slot}
              {template && (
                <span className="template-name">({template.name})</span>
              )}
            </button>
          );
        })}
      </div>

      {activeTemplate && (
        <div className="template-content">
          {/* Template Name */}
          <div className="form-group">
            <label>Template Name</label>
            <input
              type="text"
              value={activeTemplate.name}
              onChange={(e) => updateTemplate({ name: e.target.value })}
              maxLength={50}
            />
          </div>

          {/* Enable Toggle */}
          <div className="form-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={activeTemplate.is_enabled}
                onChange={(e) => updateTemplate({ is_enabled: e.target.checked })}
              />
              Enable this template
            </label>
          </div>

          {/* CSS Editor */}
          <div className="css-editor-container">
            <CodeMirror
              value={activeTemplate.css_content}
              height="400px"
              theme={vscodeDark}
              extensions={[css()]}
              onChange={(value) => updateTemplate({ css_content: value })}
            />
          </div>

          {/* Validation Status */}
          {validationError && (
            <div className="validation-error">{validationError}</div>
          )}

          {/* Action Buttons */}
          <div className="template-actions">
            <button
              className="btn btn-secondary"
              onClick={() => window.open(`/gallery/preview?template=${activeSlot}`, '_blank')}
            >
              Preview
            </button>

            {activeSlot === 1 && activeTemplate.is_default && (
              <button
                className="btn btn-warning"
                onClick={handleReset}
              >
                Reset to Default
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CssTemplateEditor;
```

#### 9.2 Event Form Integration

**File:** `/frontend/src/components/admin/EventForm.tsx` (update)

```tsx
// Add to existing EventForm component

interface CssTemplateOption {
  id: number;
  name: string;
}

// In component:
const [cssTemplates, setCssTemplates] = useState<CssTemplateOption[]>([]);

useEffect(() => {
  fetchCssTemplates();
}, []);

const fetchCssTemplates = async () => {
  const response = await fetch('/api/admin/css-templates/enabled');
  const data = await response.json();
  setCssTemplates(data.templates);
};

// In form JSX:
<FormField label="Custom CSS Template">
  <select
    value={formData.css_template_id || ''}
    onChange={(e) => setFormData({
      ...formData,
      css_template_id: e.target.value ? Number(e.target.value) : null
    })}
  >
    <option value="">None (Use default theme)</option>
    {cssTemplates.map(template => (
      <option key={template.id} value={template.id}>
        {template.name}
      </option>
    ))}
  </select>
</FormField>
```

#### 9.3 Gallery CSS Loading

**File:** `/frontend/src/hooks/useGalleryCustomCss.ts`

```tsx
import { useEffect, useState } from 'react';

export function useGalleryCustomCss(slug: string) {
  const [customCss, setCustomCss] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const loadCustomCss = async () => {
      try {
        const response = await fetch(`/api/gallery/${slug}/css-template`);
        if (response.status === 204) {
          setCustomCss(null);
          return;
        }
        if (response.ok) {
          const css = await response.text();
          setCustomCss(css);
        }
      } catch (error) {
        console.error('Failed to load custom CSS:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCustomCss();
  }, [slug]);

  // Inject CSS into document
  useEffect(() => {
    if (!customCss) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'gallery-custom-css';
    styleElement.textContent = customCss;
    document.head.appendChild(styleElement);

    return () => {
      const existing = document.getElementById('gallery-custom-css');
      if (existing) {
        existing.remove();
      }
    };
  }, [customCss]);

  return { customCss, loading };
}
```

#### 9.4 Gallery Page Update

**File:** `/frontend/src/pages/GalleryPage.tsx` (update)

```tsx
import { useGalleryCustomCss } from '../hooks/useGalleryCustomCss';

const GalleryPage: React.FC = () => {
  const { slug } = useParams();

  // Load custom CSS for this gallery
  useGalleryCustomCss(slug || '');

  // ... rest of component
};
```

---

### 10. Default CSS Template (Slot 1)

**Working Example - "Elegant Dark"**

```css
/*
 * PicPeak Custom CSS Template: Elegant Dark
 *
 * Available CSS Custom Properties:
 * --gallery-bg: Background color
 * --gallery-text: Primary text color
 * --gallery-accent: Accent/highlight color
 * --gallery-border: Border color
 * --gallery-shadow: Box shadow value
 * --gallery-radius: Border radius value
 * --gallery-spacing: Base spacing unit
 */

/* ===== Base Theme Variables ===== */
.gallery-page {
  --gallery-bg: #1a1a2e;
  --gallery-bg-secondary: #16213e;
  --gallery-text: #eaeaea;
  --gallery-text-muted: #8b8b9a;
  --gallery-accent: #e94560;
  --gallery-accent-hover: #ff6b6b;
  --gallery-border: #2d2d44;
  --gallery-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  --gallery-radius: 12px;
  --gallery-spacing: 16px;
}

/* ===== Page Background ===== */
.gallery-page {
  background: linear-gradient(135deg, var(--gallery-bg) 0%, var(--gallery-bg-secondary) 100%);
  min-height: 100vh;
  color: var(--gallery-text);
}

/* ===== Gallery Header ===== */
.gallery-header {
  background: rgba(22, 33, 62, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--gallery-border);
  padding: calc(var(--gallery-spacing) * 2);
}

.gallery-title {
  color: var(--gallery-text);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.gallery-subtitle {
  color: var(--gallery-text-muted);
  margin-top: calc(var(--gallery-spacing) / 2);
}

/* ===== Photo Grid ===== */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--gallery-spacing);
  padding: calc(var(--gallery-spacing) * 2);
}

/* ===== Photo Cards ===== */
.photo-card {
  background: var(--gallery-bg-secondary);
  border-radius: var(--gallery-radius);
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid var(--gallery-border);
}

.photo-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--gallery-shadow);
}

.photo-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.photo-card:hover img {
  transform: scale(1.05);
}

.photo-card-overlay {
  background: linear-gradient(to top, rgba(26, 26, 46, 0.9), transparent);
  padding: var(--gallery-spacing);
}

/* ===== Buttons ===== */
.gallery-btn {
  background: var(--gallery-accent);
  color: white;
  border: none;
  border-radius: calc(var(--gallery-radius) / 2);
  padding: calc(var(--gallery-spacing) / 2) var(--gallery-spacing);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.gallery-btn:hover {
  background: var(--gallery-accent-hover);
  transform: translateY(-2px);
}

.gallery-btn-secondary {
  background: transparent;
  border: 1px solid var(--gallery-border);
  color: var(--gallery-text);
}

.gallery-btn-secondary:hover {
  background: var(--gallery-bg-secondary);
  border-color: var(--gallery-accent);
}

/* ===== Lightbox ===== */
.lightbox-overlay {
  background: rgba(10, 10, 20, 0.95);
  backdrop-filter: blur(20px);
}

.lightbox-content {
  max-width: 90vw;
  max-height: 90vh;
}

.lightbox-navigation {
  color: var(--gallery-text);
}

.lightbox-navigation:hover {
  color: var(--gallery-accent);
}

/* ===== Photo Details ===== */
.photo-details {
  background: var(--gallery-bg-secondary);
  border-radius: var(--gallery-radius);
  padding: calc(var(--gallery-spacing) * 1.5);
  border: 1px solid var(--gallery-border);
}

.photo-meta {
  color: var(--gallery-text-muted);
  font-size: 0.875rem;
}

/* ===== Rating Stars ===== */
.rating-star {
  color: var(--gallery-text-muted);
  transition: color 0.2s ease, transform 0.2s ease;
}

.rating-star.active,
.rating-star:hover {
  color: var(--gallery-accent);
  transform: scale(1.1);
}

/* ===== Selection Checkbox ===== */
.photo-select-checkbox {
  accent-color: var(--gallery-accent);
}

/* ===== Loading States ===== */
.skeleton-loader {
  background: linear-gradient(
    90deg,
    var(--gallery-bg-secondary) 25%,
    var(--gallery-border) 50%,
    var(--gallery-bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--gallery-radius);
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ===== Scrollbar Styling ===== */
.gallery-page ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gallery-page ::-webkit-scrollbar-track {
  background: var(--gallery-bg);
}

.gallery-page ::-webkit-scrollbar-thumb {
  background: var(--gallery-border);
  border-radius: 4px;
}

.gallery-page ::-webkit-scrollbar-thumb:hover {
  background: var(--gallery-accent);
}

/* ===== Responsive Adjustments ===== */
@media (max-width: 768px) {
  .gallery-page {
    --gallery-spacing: 12px;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .gallery-title {
    font-size: 1.5rem;
  }
}
```

---

## Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Create database migration for `css_templates` table
- [ ] Add `css_template_id` column to events table
- [ ] Run migrations
- [ ] Create `/backend/src/utils/cssSanitizer.js`
- [ ] Create `/backend/src/routes/adminCssTemplates.js`
- [ ] Register new routes in `server.js`
- [ ] Add gallery CSS endpoint to `gallery.js`
- [ ] Write unit tests for CSS sanitization

### Phase 2: Admin UI - Template Editor
- [ ] Install CodeMirror: `npm install @uiw/react-codemirror @codemirror/lang-css`
- [ ] Create `CssTemplateEditor.tsx` component
- [ ] Add "Custom CSS Templates" tab to Styling page
- [ ] Implement tabbed interface for 3 slots
- [ ] Add template name editing
- [ ] Add enable/disable toggle
- [ ] Add CSS editor with syntax highlighting
- [ ] Add save functionality
- [ ] Add reset to default functionality (slot 1 only)
- [ ] Add preview button functionality

### Phase 3: Event Integration
- [ ] Add CSS template dropdown to EventForm
- [ ] Fetch enabled templates for dropdown
- [ ] Save `css_template_id` with event
- [ ] Update event edit to show current template
- [ ] Add template preview in event form

### Phase 4: Gallery Frontend
- [ ] Create `useGalleryCustomCss` hook
- [ ] Update GalleryPage to load custom CSS
- [ ] Add `.gallery-page` class to gallery container
- [ ] Test CSS injection and cleanup
- [ ] Verify CSS scoping works correctly

### Phase 5: Testing & Security
- [ ] Test CSS sanitization with malicious inputs
- [ ] Test all forbidden patterns are blocked
- [ ] Test size limits (100KB)
- [ ] Test CSP headers on gallery pages
- [ ] E2E test: create template → assign to event → view gallery
- [ ] Test template enable/disable
- [ ] Test template reset
- [ ] Cross-browser testing

---

## Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Load template editor | Shows 3 tabs, first tab active, default CSS loaded |
| 2 | Edit template name | Name updates, reflected in tab |
| 3 | Edit CSS content | CodeMirror highlights syntax, changes tracked |
| 4 | Save template | API called, success message, timestamp updated |
| 5 | CSS with `javascript:` | Pattern removed, warning shown |
| 6 | CSS with `@import` | Pattern removed, warning shown |
| 7 | CSS > 100KB | Save rejected with size error |
| 8 | Enable template | Template appears in event form dropdown |
| 9 | Disable template | Template removed from event form dropdown |
| 10 | Assign template to event | Event saves with `css_template_id` |
| 11 | View gallery with template | Custom CSS applied, styling visible |
| 12 | Reset template 1 | Confirmation prompt, default CSS restored |
| 13 | Try reset on template 2 | Button not shown / action rejected |
| 14 | Gallery without template | No custom CSS loaded, default theme used |

---

## Security Checklist

- [ ] CSS sanitization removes all forbidden patterns
- [ ] No JavaScript execution possible via CSS
- [ ] No external resource loading (`@import`, external `url()`)
- [ ] Size limits enforced (100KB per template)
- [ ] Admin authentication required for template management
- [ ] CSP headers configured for gallery pages
- [ ] Rate limiting on template saves
- [ ] Input validation on template names

---

## Acceptance Criteria

1. Admin can access "Custom CSS Templates" tab in Styling settings
2. 3 template slots displayed with tabbed interface
3. Template 1 pre-populated with working "Elegant Dark" example
4. CodeMirror editor with CSS syntax highlighting
5. Templates can be named, enabled/disabled, and saved
6. Template 1 has "Reset to Default" option
7. Enabled templates appear in event creation/edit dropdown
8. Event stores selected template reference
9. Gallery loads and applies custom CSS from assigned template
10. CSS sanitization blocks malicious patterns
11. Size limits enforced (100KB)
12. All CSS scoped to gallery pages only

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CSS injection attack | Medium | High | Comprehensive sanitization, CSP headers |
| Performance (large CSS) | Low | Medium | Size limits, caching |
| Template breaks gallery | Medium | Medium | Preview functionality, reset option |
| Browser compatibility | Low | Low | Standard CSS properties only |
| Lost changes | Medium | Low | Auto-save, confirmation on leave |

---

## Related Files

### Backend
- `/backend/src/routes/adminCssTemplates.js` - New route file
- `/backend/src/routes/gallery.js` - CSS template endpoint
- `/backend/src/utils/cssSanitizer.js` - New sanitization utility
- `/backend/migrations/core/` - Migration files

### Frontend
- `/frontend/src/components/admin/CssTemplateEditor.tsx` - New component
- `/frontend/src/components/admin/EventForm.tsx` - Update for dropdown
- `/frontend/src/hooks/useGalleryCustomCss.ts` - New hook
- `/frontend/src/pages/GalleryPage.tsx` - CSS loading integration
- `/frontend/src/pages/admin/BrandingPage.tsx` - Add templates tab

---

## Future Enhancements

1. **Template marketplace**: Share/download community templates
2. **Template versioning**: History of changes per template
3. **CSS variables UI**: Visual editor for CSS custom properties
4. **Template categories**: Organize by event type (wedding, corporate, etc.)
5. **Live preview editor**: Side-by-side CSS editing with live preview
6. **Template cloning**: Duplicate existing template to new slot
7. **More slots**: Configurable number of template slots
8. **Template import/export**: JSON file format for backup/sharing
