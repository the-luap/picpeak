# Changelog

All notable changes to PicPeak will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0](https://github.com/the-luap/picpeak/compare/v1.1.15...v1.2.0) (2026-01-03)

### Features

* **Event Rename**: Safe event renaming with automatic slug updates, old URL redirects via `slug_redirects` table, and optional email notifications to clients
* **Optional Event Fields**: Make customer name, email, and admin email fields optional via admin settings with "(optional)" labels in forms
* **Photo Filtering**: Filter photos by rating, likes, favorites, and comments with a new PhotoFilterPanel component
* **Photo Export**: Export filtered photo selections as ZIP, generate Capture One/Lightroom-compatible XMP sidecar files, or export metadata lists
* **Custom CSS Templates**: 3 customizable CSS template slots with live preview, XSS-safe sanitization, and per-event template assignment
* **Apple Liquid Glass Theme**: Starter CSS template inspired by iOS 26 / macOS Tahoe Liquid Glass design with glass morphism effects, Apple SF Pro fonts, and responsive layout
* **Liquid Glass Dark Theme**: Neon-accented dark glass theme with animated gradient backgrounds
* **Image Security Settings**: Per-event download protection with configurable protection levels (basic, standard, enhanced, maximum), canvas rendering, DevTools detection, and right-click prevention
* **Automated Releases**: Release Please integration for automatic versioning, changelog generation, and GitHub releases that trigger Docker image builds

### Bug Fixes

* **Date Parsing**: Fix event date formatting in slugs (now uses YYYY-MM-DD format correctly)
* **Search Placeholder**: Fix search field placeholder visibility in glass-styled sidebar
* **Vite Proxy**: Fix Vite dev server proxy port configuration
* **Photo Export Button**: Fix export button staying disabled when photos are selected
* **Boolean Parsing**: Fix boolean parsing in publicSettings.js for optional fields
* **Translation Keys**: Add missing `common.optional` translation key in locales

### Security

* Fix critical vulnerabilities and harden application security
* Add CSS sanitizer utility blocking XSS vectors in custom templates
* Implement secure gallery CSS endpoint for template delivery

### Code Refactoring

* Add Photo and Settings service layers for better code organization
* Phase 1 code consolidation with service layer architecture
* Modular settings page with feature-based tab components
* Create photoFilterBuilder utility for query construction
* Add eventRenameService for safe event operations

### Documentation

* Add comprehensive REFACTORING_PLAN.md for codebase improvement roadmap
* Update README roadmap with implemented features (Download Protection, Gallery Templates, Filtering & Export)
* Add test specification documents for all new features

### Database Migrations

* `049_add_slug_redirects.js` - Store old slugs for URL redirects after rename
* `050_add_optional_event_fields_settings.js` - Settings for optional form fields
* `051_add_photo_filter_indexes.js` - Performance indexes for photo filtering
* `052_add_css_templates.js` - CSS template storage with 3 slots
* `053_add_liquid_glass_templates.js` - Apple Liquid Glass and Dark theme starter templates

---

## [1.1.15] - Previous Release

Initial stable release with core functionality.
