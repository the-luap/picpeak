# 🚀 Production Todo List - PicPeak Enhancements

**Priority:** HIGH - These are production fixes and enhancements
**Estimated Time:** 2-3 days
**Status:** Ready for Implementation

---

## 📋 Action Items Overview

1. [Password Complexity Settings](#1-password-complexity-settings)
2. [Gallery Login Page - Remove Event Date](#2-gallery-login-page---remove-event-date)
3. [Analytics Umami Configuration Check](#3-analytics-umami-configuration-check)
4. [Analytics Numbers Accuracy Fix](#4-analytics-numbers-accuracy-fix)
5. [Missing Translation Key Fix](#5-missing-translation-key-fix)
6. [Complete Translation Audit](#6-complete-translation-audit)
7. [CMS Page Long German Text Formatting](#7-cms-page-long-german-text-formatting)
8. [Event Creation Date Format Fix](#8-event-creation-date-format-fix)
9. [Language Selector Country Flags Chrome Fix](#9-language-selector-country-flags-chrome-fix)

---

## 1. Password Complexity Settings

**Problem:** Admin security tab only has password minimum length setting, no complexity requirements.

**Current State:** 
- File: `frontend/src/pages/admin/SettingsPage.tsx` (lines 635-669)
- Backend: `backend/src/utils/passwordValidation.js` has complexity logic but not exposed in settings

**Implementation:**

### Frontend Changes:
```typescript
// File: frontend/src/pages/admin/SettingsPage.tsx
// Add to securitySettings state (around line 61):
const [securitySettings, setSecuritySettings] = useState({
  require_password: true,
  password_min_length: 8,
  password_complexity_level: 'medium', // ADD THIS
  enable_2fa: false,
  session_timeout_minutes: 60,
  max_login_attempts: 5,
  enable_recaptcha: false,
  recaptcha_site_key: '',
  recaptcha_secret_key: ''
});

// Add complexity setting UI after password_min_length (around line 660):
<div>
  <label className="block text-sm font-medium text-neutral-700 mb-1">
    {t('settings.security.passwordComplexity')}
  </label>
  <select
    value={securitySettings.password_complexity_level}
    onChange={(e) => setSecuritySettings(prev => ({ ...prev, password_complexity_level: e.target.value }))}
    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
  >
    <option value="low">{t('settings.security.complexityLow')}</option>
    <option value="medium">{t('settings.security.complexityMedium')}</option>
    <option value="high">{t('settings.security.complexityHigh')}</option>
  </select>
  <p className="text-xs text-neutral-500 mt-1">
    {t('settings.security.complexityHelp')}
  </p>
</div>
```

### Translation Updates:
```json
// File: frontend/src/i18n/locales/en.json (add to settings.security):
"passwordComplexity": "Password Complexity Level",
"complexityLow": "Low - Length only",
"complexityMedium": "Medium - Letters and numbers",
"complexityHigh": "High - Letters, numbers, and symbols",
"complexityHelp": "Controls password requirements for new gallery passwords"

// File: frontend/src/i18n/locales/de.json (add to settings.security):
"passwordComplexity": "Passwort-Komplexitätsstufe",
"complexityLow": "Niedrig - Nur Länge",
"complexityMedium": "Mittel - Buchstaben und Zahlen",
"complexityHigh": "Hoch - Buchstaben, Zahlen und Symbole",
"complexityHelp": "Steuert Passwort-Anforderungen für neue Galerie-Passwörter"
```

### Backend Changes:
```javascript
// File: backend/src/utils/passwordValidation.js
// Update PASSWORD_CONFIG based on settings (around line 8):
const getPasswordConfigFromSettings = async () => {
  const { db } = require('../database/db');
  const settings = await db('admin_settings').select('key', 'value');
  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  
  const complexityLevel = settingsMap.security_password_complexity_level || 'medium';
  
  return {
    ...PASSWORD_CONFIG,
    minLength: parseInt(settingsMap.security_password_min_length) || 8,
    requireUppercase: complexityLevel !== 'low',
    requireLowercase: complexityLevel !== 'low', 
    requireNumbers: complexityLevel === 'high' || complexityLevel === 'medium',
    requireSpecialChars: complexityLevel === 'high',
    minStrengthScore: complexityLevel === 'high' ? 3 : (complexityLevel === 'medium' ? 2 : 1)
  };
};
```

---

## 2. Gallery Login Page - Remove Event Date

**Problem:** Gallery login shows event date which is often used as password, creating security risk.

**Current State:**
- File: `frontend/src/pages/GalleryPage.tsx` (lines 275-285)
- Shows both event name and date with calendar icon

**Implementation:**

### Frontend Changes:
```typescript
// File: frontend/src/pages/GalleryPage.tsx
// Replace the date display section (around lines 280-285):

// REMOVE THIS:
/*
<div className="flex items-center justify-center text-xs sm:text-sm" style={{ color: 'var(--color-text, #171717)', opacity: 0.7 }}>
  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
  <span className="truncate">{format(parseISO(galleryInfo!.event_date), 'PP')}</span>
</div>
*/

// REPLACE WITH:
<div className="text-center text-xs sm:text-sm" style={{ color: 'var(--color-text, #171717)', opacity: 0.7 }}>
  <span className="truncate">{galleryInfo?.event_type ? t(`events.types.${galleryInfo.event_type}`) : ''}</span>
</div>
```

### Additional Layout Improvements:
```typescript
// File: frontend/src/pages/GalleryPage.tsx
// Update the header section for better visual balance (around line 275):
<div className="text-center mb-4 sm:mb-6">
  <img 
    src={settingsData?.branding_logo_url ? 
      buildResourceUrl(settingsData.branding_logo_url) : 
      '/picpeak-logo-transparent.png'
    } 
    alt={settingsData?.branding_company_name || 'PicPeak'}
    className="h-12 sm:h-16 lg:h-20 w-auto object-contain mx-auto mb-3 sm:mb-4"
  />
  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 px-2" style={{ color: 'var(--color-text, #171717)' }}>
    {galleryInfo?.event_name}
  </h1>
  {/* Event type instead of date */}
  {galleryInfo?.event_type && (
    <div className="text-center text-sm" style={{ color: 'var(--color-text, #171717)', opacity: 0.7 }}>
      <span className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
        {t(`events.types.${galleryInfo.event_type}`)}
      </span>
    </div>
  )}
</div>
```

---

## 3. Analytics Umami Configuration Check

**Problem:** Analytics page shows "Umami Analytics Not Configured" even when configured in settings.

**Current State:**
- File: `frontend/src/pages/admin/AnalyticsPage.tsx` (lines 67-87)
- Check logic may not be working correctly

**Implementation:**

### Frontend Fix:
```typescript
// File: frontend/src/pages/admin/AnalyticsPage.tsx
// Fix the Umami configuration check (around lines 67-87):

// REPLACE the useEffect:
useEffect(() => {
  const fetchUmamiConfig = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/public/settings`);
      const settings = await response.json();
      
      // Check if Umami is properly configured
      const isConfigured = settings.analytics_umami_enabled && 
                          settings.analytics_umami_url && 
                          settings.analytics_umami_website_id;
      
      if (isConfigured) {
        setUmamiConfig({
          url: settings.analytics_umami_url,
          shareUrl: settings.analytics_umami_share_url,
          websiteId: settings.analytics_umami_website_id,
          enabled: true
        });
      } else {
        // Fall back to environment variables
        const envConfigured = import.meta.env.VITE_UMAMI_URL && 
                             import.meta.env.VITE_UMAMI_WEBSITE_ID;
        
        setUmamiConfig({
          url: import.meta.env.VITE_UMAMI_URL,
          shareUrl: import.meta.env.VITE_UMAMI_SHARE_URL,
          websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID,
          enabled: envConfigured
        });
      }
    } catch (error) {
      console.error('Failed to fetch Umami config:', error);
      setUmamiConfig({ enabled: false });
    }
  };

  fetchUmamiConfig();
}, []);

// Update the configuration notice condition (around line 441):
{!umamiConfig.enabled && (
  <Card padding="md" className="mt-6 bg-amber-50 border-amber-200">
    <div className="flex items-start gap-3">
      <Activity className="w-5 h-5 text-amber-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-900">{t('analytics.notConfigured')}</p>
        <p className="text-sm text-amber-700 mt-1">
          {t('analytics.configureInstructions')}
        </p>
      </div>
    </div>
  </Card>
)}
```

---

## 4. Analytics Numbers Accuracy Fix

**Problem:** Dashboard shows correct numbers but analytics page shows different numbers.

**Current State:**
- Dashboard: `frontend/src/services/admin.service.ts` `getDashboardStats()`
- Analytics: `frontend/src/services/admin.service.ts` `getAnalytics()`
- Backend: Different endpoints with potentially different calculation logic

**Implementation:**

### Backend Investigation and Fix:
```javascript
// File: backend/src/routes/adminDashboard.js
// Ensure consistent calculation logic in both /stats and /analytics endpoints

// Update the analytics endpoint (around line 216) to use the same calculation as stats:
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const days = sanitizeDays(req.query.days || 7);
    
    // Use same calculation logic as /stats endpoint
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);
    
    // Get total downloads - SAME logic as /stats
    const totalDownloads = await db('access_logs')
      .whereIn('action', ['download', 'download_all'])
      .where('timestamp', '>=', thirtyDaysAgo.toISOString())
      .count('id as count')
      .first();

    // Get total views - SAME logic as /stats  
    const totalViews = await db('access_logs')
      .where('action', 'view')
      .where('timestamp', '>=', thirtyDaysAgo.toISOString())
      .count('id as count')
      .first();

    // ... rest of the analytics logic

    // Add totals to response for verification
    res.json({
      chartData: dates,
      topGalleries,
      devices,
      totals: {
        totalViews: totalViews.count,
        totalDownloads: totalDownloads.count,
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});
```

### Frontend Verification:
```typescript
// File: frontend/src/pages/admin/AnalyticsPage.tsx
// Add debug information in development (around line 107):

const analytics: ComponentAnalyticsData | undefined = React.useMemo(() => {
  if (!apiData) return undefined;

  // Calculate totals from chart data
  const totalViews = apiData.chartData.reduce((sum, day) => sum + day.views, 0);
  const totalDownloads = apiData.chartData.reduce((sum, day) => sum + day.downloads, 0);

  // Debug: Compare with API totals in development
  if (process.env.NODE_ENV === 'development' && apiData.totals) {
    console.log('Analytics Debug:', {
      calculatedViews: totalViews,
      apiTotalViews: apiData.totals.totalViews,
      calculatedDownloads: totalDownloads,
      apiTotalDownloads: apiData.totals.totalDownloads,
      period: apiData.totals.period
    });
  }

  // ... rest of the calculation
}, [apiData]);
```

---

## 5. Missing Translation Key Fix

**Problem:** Missing translation key `admin.activities.analytics_settings_updated` in recent activities.

**Current State:**
- Key not found in `frontend/src/i18n/locales/en.json` or `de.json`

**Implementation:**

### Translation Updates:
```json
// File: frontend/src/i18n/locales/en.json
// Add to admin.activities section (around line 785):
"analytics_settings_updated": "Analytics settings updated"

// File: frontend/src/i18n/locales/de.json  
// Add to admin.activities section (around line 710):
"analytics_settings_updated": "Analytik-Einstellungen aktualisiert"
```

### Backend Activity Logging:
```javascript
// File: backend/src/routes/adminSettings.js (or wherever analytics settings are updated)
// Ensure activity is logged with correct key:

await logActivity(req.admin.id, 'analytics_settings_updated', {
  settingsUpdated: Object.keys(updateData).filter(key => key.startsWith('analytics_')),
  timestamp: new Date()
});
```

---

## 6. Complete Translation Audit

**Problem:** Need to check all recent activity types for missing translations.

**Current State:**
- Activity types defined in backend, translations in frontend

**Implementation:**

### Audit Script:
```bash
# Create a script to find missing translation keys
# File: scripts/audit-translations.js

const fs = require('fs');
const path = require('path');

// Read translation files
const enTranslations = JSON.parse(fs.readFileSync('frontend/src/i18n/locales/en.json', 'utf8'));
const deTranslations = JSON.parse(fs.readFileSync('frontend/src/i18n/locales/de.json', 'utf8'));

// Common activity types that should exist
const requiredActivityKeys = [
  'event_created', 'event_updated', 'event_deleted', 'event_archived',
  'photos_uploaded', 'photo_deleted', 'photos_bulk_deleted',
  'archive_downloaded', 'archive_deleted', 'archive_restored',
  'email_config_updated', 'email_template_updated',
  'branding_updated', 'theme_updated', 'analytics_settings_updated',
  'general_settings_updated', 'security_settings_updated',
  'category_created', 'category_updated', 'category_deleted',
  'cms_page_updated', 'favicon_uploaded',
  'bulk_download', 'gallery_password_entry', 'expiration_warning_viewed'
];

console.log('Missing English translations:');
requiredActivityKeys.forEach(key => {
  if (!enTranslations.admin?.activities?.[key]) {
    console.log(`- admin.activities.${key}`);
  }
});

console.log('\nMissing German translations:');
requiredActivityKeys.forEach(key => {
  if (!deTranslations.admin?.activities?.[key]) {
    console.log(`- admin.activities.${key}`);
  }
});
```

### Missing Translations to Add:
```json
// File: frontend/src/i18n/locales/en.json
// Add any missing keys to admin.activities:
"analytics_settings_updated": "Analytics settings updated",
"cms_page_updated": "CMS page updated: {{page}}",
"security_settings_updated": "Security settings updated", 
"password_reset": "Password reset for: {{eventName}}",
"admin_logout": "Admin {{actorName}} logged out",
"system_activity": "System activity: {{type}}"

// File: frontend/src/i18n/locales/de.json
// German equivalents:
"analytics_settings_updated": "Analytik-Einstellungen aktualisiert",
"cms_page_updated": "CMS-Seite aktualisiert: {{page}}",
"security_settings_updated": "Sicherheitseinstellungen aktualisiert",
"password_reset": "Passwort zurückgesetzt für: {{eventName}}",
"admin_logout": "Admin {{actorName}} abgemeldet",
"system_activity": "Systemaktivität: {{type}}"
```

---

## 7. CMS Page Long German Text Formatting

**Problem:** Long German text like "Datenschutzerklärung" pushes image to left and looks ugly.

**Current State:**
- File: `frontend/src/pages/admin/CMSPageEnhanced.tsx` (lines 130-170)
- File: `frontend/src/pages/admin/CMSPage.tsx` (lines 90-110)

**Implementation:**

### CSS Fix:
```typescript
// File: frontend/src/pages/admin/CMSPageEnhanced.tsx
// Update the page selection buttons (around line 130):

<button
  key={page.slug}
  onClick={() => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you want to save them?')) {
        handleSave();
      }
    }
    setSelectedPage(page.slug);
  }}
  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
    selectedPage === page.slug
      ? 'bg-primary-100 text-primary-700 border border-primary-300'
      : 'bg-white border border-neutral-200 hover:bg-neutral-50'
  }`}
>
  <FileText className="w-5 h-5 flex-shrink-0" />
  <div className="flex-1 min-w-0"> {/* Add min-w-0 for text overflow */}
    <p className="font-medium text-sm truncate" title={t(`legal.${page.slug}`)}>
      {t(`legal.${page.slug}`)}
    </p>
    <p className="text-xs text-neutral-500 truncate">/{page.slug}</p>
  </div>
  {selectedPage === page.slug && hasUnsavedChanges && (
    <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />
  )}
</button>
```

### Alternative - Responsive Layout:
```typescript
// File: frontend/src/pages/admin/CMSPageEnhanced.tsx
// Alternative: Use responsive text sizing

<p className="font-medium text-sm sm:text-base truncate" title={t(`legal.${page.slug}`)}>
  {/* For very long German words, show abbreviated version */}
  {t(`legal.${page.slug}`).length > 15 
    ? `${t(`legal.${page.slug}`).substring(0, 12)}...`
    : t(`legal.${page.slug}`)
  }
</p>
```

---

## 8. Event Creation Date Format Fix

**Problem:** Event creation page uses browser English format instead of saved admin settings date format.

**Current State:**
- Files: `frontend/src/pages/admin/CreateEventPageEnhanced.tsx`, `CreateEventPage.tsx`
- Uses browser locale instead of admin date format settings

**Implementation:**

### Hook Enhancement:
```typescript
// File: frontend/src/hooks/useLocalizedDate.ts
// Add admin settings integration:

import { useTranslation } from 'react-i18next';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { de, enUS, enGB } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '../services/settings.service';

export const useLocalizedDate = () => {
  const { i18n } = useTranslation();
  
  // Fetch admin date format settings
  const { data: settings } = useQuery({
    queryKey: ['admin-date-settings'],
    queryFn: () => settingsService.getAllSettings(),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
  
  const getLocale = () => {
    // Use admin settings if available, otherwise fall back to i18n language
    const savedFormat = settings?.general_date_format;
    if (savedFormat?.locale) {
      switch (savedFormat.locale) {
        case 'en-US': return enUS;
        case 'en-GB': return enGB;
        case 'de': return de;
        default: return i18n.language === 'de' ? de : enUS;
      }
    }
    return i18n.language === 'de' ? de : enUS;
  };
  
  const getDateFormat = () => {
    const savedFormat = settings?.general_date_format?.format;
    if (savedFormat) {
      // Convert admin format to date-fns format
      switch (savedFormat) {
        case 'DD/MM/YYYY': return 'dd/MM/yyyy';
        case 'MM/DD/YYYY': return 'MM/dd/yyyy';
        case 'YYYY-MM-DD': return 'yyyy-MM-dd';
        case 'DD.MM.YYYY': return 'dd.MM.yyyy';
        default: return 'dd/MM/yyyy';
      }
    }
    return i18n.language === 'de' ? 'dd.MM.yyyy' : 'MM/dd/yyyy';
  };
  
  const format = (date: Date | string, formatStr?: string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const finalFormat = formatStr || getDateFormat();
    return dateFnsFormat(dateObj, finalFormat, { locale: getLocale() });
  };
  
  // ... rest of the hook
};
```

### Event Creation Page Fix:
```typescript
// File: frontend/src/pages/admin/CreateEventPageEnhanced.tsx
// Update the expiration date display (around line 495):

{formData.event_date && (
  <p className="mt-2 text-sm text-neutral-500">
    {t('events.expiresOn')}: {format(addDays(new Date(formData.event_date), formData.expires_in_days), 'PPP')}
  </p>
)}
```

---

## 9. Language Selector Country Flags Chrome Fix

**Problem:** Country flags not showing in Chrome browser on Windows in admin language selector.

**Current State:**
- File: `frontend/src/components/common/LanguageSelector.tsx` (lines 5-8)
- Uses emoji flags: `🇬🇧`, `🇩🇪`

**Implementation:**

### SVG Icon Replacement:
```typescript
// File: frontend/src/components/common/LanguageSelector.tsx
// Replace emoji flags with SVG icons or image flags:

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

// SVG flag components for better browser compatibility
const FlagGB: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 640 480" fill="none">
    <path fill="#012169" d="M0 0h640v480H0z"/>
    <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
    <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l246-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
    <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
    <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
  </svg>
);

const FlagDE: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 640 480" fill="none">
    <path fill="#ffce00" d="M0 320h640v160H0z"/>
    <path d="M0 0h640v160H0z"/>
    <path fill="#d00" d="M0 160h640v160H0z"/>
  </svg>
);

const languages = [
  { code: 'en', name: 'English', flag: FlagGB },
  { code: 'de', name: 'Deutsch', flag: FlagDE },
];

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <Globe className="w-4 h-4" />
        <currentLanguage.flag className="w-4 h-4" />
        <span>{currentLanguage.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-3 ${
                language.code === i18n.language
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-neutral-700'
              }`}
            >
              <language.flag className="w-4 h-4" />
              <span>{language.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Alternative - Image Flags:
```typescript
// Alternative solution using flag images:
const languages = [
  { code: 'en', name: 'English', flag: '/flags/gb.svg' },
  { code: 'de', name: 'Deutsch', flag: '/flags/de.svg' },
];

// Add images to public/flags/ directory
// Use: <img src={language.flag} alt={language.name} className="w-4 h-4" />
```

---

## 🔍 Testing Instructions

### After implementing each fix:

1. **Password Complexity**: Test different complexity levels in admin settings
2. **Gallery Login**: Verify event date is hidden on gallery login pages  
3. **Analytics Check**: Verify "Not Configured" message appears/disappears correctly
4. **Analytics Numbers**: Compare dashboard vs analytics page numbers
5. **Translations**: Check recent activities display correct translations
6. **CMS Formatting**: Test with long German page names
7. **Date Format**: Test event creation with different admin date settings
8. **Language Flags**: Test language selector in Chrome on Windows

### Regression Testing:
- [ ] Gallery login still works correctly
- [ ] Analytics page displays correctly when Umami is configured
- [ ] Admin settings save and load correctly
- [ ] Event creation works with all date formats
- [ ] Language switching works in all browsers

---

## 📝 Notes

- All changes maintain backward compatibility
- No database schema changes required
- Frontend changes are non-breaking
- Can be deployed incrementally
- All text is properly internationalized

**⚠️ Important**: Test each fix in isolation before combining, especially the analytics changes as they affect production data display. 