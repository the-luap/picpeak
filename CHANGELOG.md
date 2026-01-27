# Changelog

All notable changes to PicPeak will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.6.0-beta.0](https://github.com/the-luap/picpeak/compare/v3.5.0-beta.0...v3.6.0-beta.0) (2026-01-27)


### Features

* add justified/rows layout mode to masonry gallery ([#146](https://github.com/the-luap/picpeak/issues/146)) ([e081b56](https://github.com/the-luap/picpeak/commit/e081b56a44bf9fdaa3dd225d5dd4dde35bfe83d3))
* add justified/rows layout mode to masonry gallery ([#146](https://github.com/the-luap/picpeak/issues/146)) + security fixes ([cd1d504](https://github.com/the-luap/picpeak/commit/cd1d50474f673b759c2f9401fdbe209a84773e39))


### Bug Fixes

* update packages to fix security vulnerabilities ([8097a0c](https://github.com/the-luap/picpeak/commit/8097a0cb530bd8003597cde81606231efadb0bf5))

## [3.5.0-beta.0](https://github.com/the-luap/picpeak/compare/v3.4.0-beta.0...v3.5.0-beta.0) (2026-01-25)


### Features

* add per-event custom logo upload with bug fixes ([85170b8](https://github.com/the-luap/picpeak/commit/85170b883f504d83f1d862abb3f4e46741074826))
* per-event custom logos, customizable event types, and multiple bug fixes ([4c08160](https://github.com/the-luap/picpeak/commit/4c081601e02888d7ad289acb7847aee9d6f5703f))

## [3.4.0-beta.0](https://github.com/the-luap/picpeak/compare/v3.3.0-beta.0...v3.4.0-beta.0) (2026-01-22)


### Features

* add customizable event types with admin management ([f8881d5](https://github.com/the-luap/picpeak/commit/f8881d5bd62d449fb40917ec8c20f0eb16c1fdad))
* add per-event hero logo customization options ([0790a1d](https://github.com/the-luap/picpeak/commit/0790a1ddad774af89827a0a392e9fae0a945bff2))
* new features and bug fixes for beta release ([151e1bf](https://github.com/the-luap/picpeak/commit/151e1bf50f206ae0571fa044c75b8bc9f0f40120))


### Bug Fixes

* event-specific custom CSS settings not being saved ([dadef81](https://github.com/the-luap/picpeak/commit/dadef81158972d28aa32812203500f77ed08a999)), closes [#136](https://github.com/the-luap/picpeak/issues/136)
* handle null dates in dashboard and gallery pages ([c5a8ffc](https://github.com/the-luap/picpeak/commit/c5a8ffc08cd4c53c37fe4fb9cde8519a68f1f343))
* remove non-functional watermark toggle from Feature Toggles ([d4a15db](https://github.com/the-luap/picpeak/commit/d4a15dbe74d0d70bbe6ff03362dc7337fb8f4c5c))
* resend gallery email fails for events without password ([6b3ead7](https://github.com/the-luap/picpeak/commit/6b3ead747b1395d8ea2b3d135a5ac24db05e2eb8)), closes [#137](https://github.com/the-luap/picpeak/issues/137)

## [3.3.0-beta.0](https://github.com/the-luap/picpeak/compare/v3.2.5-beta.0...v3.3.0-beta.0) (2026-01-21)


### Features

* add original filename preservation and Lightroom export support ([a59f414](https://github.com/the-luap/picpeak/commit/a59f41463f960a3a74ce3933dc7db84ee3a2018d))
* add original filename preservation and Lightroom export support ([9872ad3](https://github.com/the-luap/picpeak/commit/9872ad3aef6488b359c5499a6dc3d8bfbfa48fde))

## [3.2.5-beta.0](https://github.com/the-luap/picpeak/compare/v3.2.4-beta.0...v3.2.5-beta.0) (2026-01-18)


### Bug Fixes

* add STORAGE_PATH to production docker-compose ([cdda709](https://github.com/the-luap/picpeak/commit/cdda70988664a177b351abc6a259ec39664d17ff))
* correct invitation activation validation and add missing translations ([991aa98](https://github.com/the-luap/picpeak/commit/991aa98f98cffd1d7785c272726615325e2c0208)), closes [#129](https://github.com/the-luap/picpeak/issues/129)
* correct invitation email link URL path ([86fa104](https://github.com/the-luap/picpeak/commit/86fa1046d5439cb451feb164175c919c49ca219a)), closes [#129](https://github.com/the-luap/picpeak/issues/129)
* resolve admin invitation flow issues and improve STORAGE_PATH documentation ([41bf6ff](https://github.com/the-luap/picpeak/commit/41bf6ff884d5ef3181f95f3aa4a528434c23947a))


### Documentation

* emphasize importance of STORAGE_PATH in env example ([3397807](https://github.com/the-luap/picpeak/commit/3397807670784e02cbe34a7a60db43c95d64f19c))

## [3.2.4-beta.0](https://github.com/the-luap/picpeak/compare/v3.2.3-beta.0...v3.2.4-beta.0) (2026-01-17)


### Bug Fixes

* correct storage path resolution in multiple files ([#96](https://github.com/the-luap/picpeak/issues/96)) ([0e3674b](https://github.com/the-luap/picpeak/commit/0e3674b2b0325bbcee5aa2c9ff7781da92f612d1))
* correct storage path resolution in multiple files ([#96](https://github.com/the-luap/picpeak/issues/96)) ([3ccb815](https://github.com/the-luap/picpeak/commit/3ccb8154eb40a432aa467fb06b3f216fd0d2c6b4))

## [3.2.3-beta.0](https://github.com/the-luap/picpeak/compare/v3.2.2-beta.0...v3.2.3-beta.0) (2026-01-16)


### Bug Fixes

* add allow_user_uploads to gallery API responses ([691e3ab](https://github.com/the-luap/picpeak/commit/691e3aba09f2148afe902a0bb0139d062634e669))
* mobile upload button not visible in gallery ([#113](https://github.com/the-luap/picpeak/issues/113)) ([cacaffa](https://github.com/the-luap/picpeak/commit/cacaffa5c39f67105c4cfb092ea62157121fb72e))

## [3.2.2-beta.0](https://github.com/the-luap/picpeak/compare/v3.2.1-beta.0...v3.2.2-beta.0) (2026-01-16)


### Bug Fixes

* mobile upload button visibility in gallery ([2a2c23d](https://github.com/the-luap/picpeak/commit/2a2c23d11610e6c81684163eb4ea934a6d6104fb)), closes [#113](https://github.com/the-luap/picpeak/issues/113)
* mobile upload button visibility in gallery ([#113](https://github.com/the-luap/picpeak/issues/113)) ([05a5307](https://github.com/the-luap/picpeak/commit/05a5307e22dc45be4b75b2996ff9fac65dec399d))

## [3.2.1-beta.0](https://github.com/the-luap/picpeak/compare/v3.2.0-beta.0...v3.2.1-beta.0) (2026-01-16)


### Bug Fixes

* mobile upload button visibility in gallery ([df7dbff](https://github.com/the-luap/picpeak/commit/df7dbffbffb180e62af0d2b58326f9de0f515439)), closes [#113](https://github.com/the-luap/picpeak/issues/113)
* mobile upload button visibility in gallery ([#113](https://github.com/the-luap/picpeak/issues/113)) ([6cb4342](https://github.com/the-luap/picpeak/commit/6cb43428d1e703267edeacda9ede050a8c4f8e0c))

## [3.2.0-beta.0](https://github.com/the-luap/picpeak/compare/v3.1.0-beta.0...v3.2.0-beta.0) (2026-01-16)


### Features

* add optional event date and expiration settings ([3079eaa](https://github.com/the-luap/picpeak/commit/3079eaa2e5d1728c2c0f315626cc253e4b08edc2))
* add optional event date and expiration settings ([2151147](https://github.com/the-luap/picpeak/commit/2151147f2d3134448ff32130da44678e2942d73c)), closes [#118](https://github.com/the-luap/picpeak/issues/118)


### Bug Fixes

* checkbox and toggle settings not persisting after page refresh ([808ed1d](https://github.com/the-luap/picpeak/commit/808ed1d2f1164d9fd1114586c68a1f925bf73ddf)), closes [#117](https://github.com/the-luap/picpeak/issues/117)


### Documentation

* add API_URL environment variable to .env.example files ([3e69579](https://github.com/the-luap/picpeak/commit/3e69579f5a171b31a253b2a42bb033bf1b97387d))

## [3.1.0-beta.0](https://github.com/the-luap/picpeak/compare/v3.0.1-beta.0...v3.1.0-beta.0) (2026-01-15)


### Features

* dynamic website title from branding settings ([d29aab7](https://github.com/the-luap/picpeak/commit/d29aab7c70c5777451666fb7d5c7a9729dab684a))
* pre-generate watermarks for instant lightbox loading ([1be974a](https://github.com/the-luap/picpeak/commit/1be974afbb0b7a1bdbdd140327771907a5d3c2ae)), closes [#112](https://github.com/the-luap/picpeak/issues/112)
* pre-generated watermarks and mobile upload button improvements ([c6fdd38](https://github.com/the-luap/picpeak/commit/c6fdd38e842e1a8c0aa9cbab9fc791e6669e402d))


### Bug Fixes

* add lightbox loading spinner and watermark cache invalidation ([050ed37](https://github.com/the-luap/picpeak/commit/050ed378199eb3b15c7c7f243792f68f858803f5))
* lightbox watermark loading, white label translations, and dynamic footer year ([ce8587b](https://github.com/the-luap/picpeak/commit/ce8587b24df3f53a11a74348eff8b5c5b96c5488))
* prevent database migration restart failures ([83a4344](https://github.com/the-luap/picpeak/commit/83a4344a01de4f65c5024fdf2d177a04457ccd2f)), closes [#107](https://github.com/the-luap/picpeak/issues/107)
* show upload button in mobile topbar instead of sidebar ([ae181cf](https://github.com/the-luap/picpeak/commit/ae181cf92fc9c1e85cad7a7b843a4d83cec636ac)), closes [#113](https://github.com/the-luap/picpeak/issues/113)
* watermark thumbnails, custom logo display, and German translations ([ea20446](https://github.com/the-luap/picpeak/commit/ea20446a797a00cf45dbe7bf6f06574a79c4d8a6))

## [3.0.1-beta.0](https://github.com/the-luap/picpeak/compare/v3.0.0-beta.0...v3.0.1-beta.0) (2026-01-15)


### Bug Fixes

* CI workflow fixes for protected branches ([cb01218](https://github.com/the-luap/picpeak/commit/cb012186d93403a1ac4e2d2f5283319603b290d6))
* use Release Please extra-files instead of sync-versions job ([fe7d45d](https://github.com/the-luap/picpeak/commit/fe7d45dd122b2dca1b2a21ba5c86d32b9a193074))

## [3.0.0-beta.0](https://github.com/the-luap/picpeak/compare/v2.3.0-beta.0...v3.0.0-beta.0) (2026-01-15)


### ⚠ BREAKING CHANGES

* Deployment now requires external reverse proxy for SSL/HTTPS

### Features

* add Apple Liquid Glass templates, image security settings, and automated releases ([6033461](https://github.com/the-luap/picpeak/commit/6033461be118ce78277ec568e1ef1ceeff7311c8))
* add complete translation support for backup admin page ([e9f92e6](https://github.com/the-luap/picpeak/commit/e9f92e66d08ac7001c31a3ee8f43ee8306bc79a9))
* Add CSS template system with custom gallery styling support ([0da45e6](https://github.com/the-luap/picpeak/commit/0da45e699ad998031aa56a92f2da5ee61a04e285))
* add event management, gallery customization, and release automationFeature/event rename ([40ee671](https://github.com/the-luap/picpeak/commit/40ee67171d41522037bf9d4e7675b62ec564346d))
* add feedback management enhancements ([0064122](https://github.com/the-luap/picpeak/commit/0064122eff12029300ab7f95078b5710c3c2d08c))
* add GitHub Actions workflow for Docker image builds ([4029559](https://github.com/the-luap/picpeak/commit/40295599547b86af7fea3359c7486918d2cd0236))
* add multi-administrator support with RBAC and fix backup/restore for S3 ([892e47d](https://github.com/the-luap/picpeak/commit/892e47d017064d7922536f8e138bbb290a45cdc9))
* **admin:** external media import modal + thumbnail fixes for reference events\n\n- Photos tab: replace inline external folder picker with a modal opened via "Import from External Folder" button next to "Upload Photos"; add info that all pictures in the selected folder will be imported.\n- Admin thumbnails: align list endpoint to /api/admin/photos/:eventId/photos and always return thumbnail_url to trigger on-demand generation; normalize external paths to avoid duplicated folder segments (e.g., individual/individual) that broke resolver; improve thumbnail logging.\n- Use authenticated image fetching on admin feedback pages to prevent 401s in automation.\n- i18n: add backup.external.warning strings; complete German backup/restore coverage; add common keys (notSet, of, up, select, selected).\n- Docs: add Local (npm) setup for EXTERNAL_MEDIA_ROOT in deployment guide.\n\nRefs [#17](https://github.com/the-luap/picpeak/issues/17) – gallery feature request: https://github.com/the-luap/picpeak/issues/17 ([49c7778](https://github.com/the-luap/picpeak/commit/49c77785e7a776890f15c0c541dcd18b74a86c6e))
* **admin:** refine header layout and logo placement ([d64e7d0](https://github.com/the-luap/picpeak/commit/d64e7d08deae7ad1b6f744f447fe546115427942))
* allow admin email updates in UI ([#36](https://github.com/the-luap/picpeak/issues/36)) ([3c2a79a](https://github.com/the-luap/picpeak/commit/3c2a79a31a0f1a44c8ec4f9a87f6fbcea9be651c))
* beta/stable release channels with update notifications and bug fixes ([3c7dc20](https://github.com/the-luap/picpeak/commit/3c7dc2013fc3b57712ddf16db85f495b3cc7bfd7))
* beta/stable release channels with update notifications and bug fixes ([#98](https://github.com/the-luap/picpeak/issues/98)) ([3c7dc20](https://github.com/the-luap/picpeak/commit/3c7dc2013fc3b57712ddf16db85f495b3cc7bfd7))
* completely rewrite GitHub mirror to create new history from target commit ([febacb7](https://github.com/the-luap/picpeak/commit/febacb79ad86d35a222ec86a1e7da65747bbe19a))
* consolidate setup scripts and guides into unified solution ([29a8ff9](https://github.com/the-luap/picpeak/commit/29a8ff914cf838918ab827280e4415afbce5ca8d))
* **docker:** add PUID/PGID and user mapping to avoid bind mount permission issues; feat(setup): prompt for admin email interactively; docs: PUID/PGID in .env.example ([410a33f](https://github.com/the-luap/picpeak/commit/410a33fecf1693cc75816c53ac460ec20089e2a1))
* enhance mirror-to-github workflow with commit-based history filtering ([b4b09c1](https://github.com/the-luap/picpeak/commit/b4b09c16504ca64ce265c7bd0bf0c901dbbd0638))
* **events:** add CSS template selector to event edit page ([6a6c2cd](https://github.com/the-luap/picpeak/commit/6a6c2cd34db26a53b5fb96415650e8136a74e47f))
* exclude Claude contributor from GitHub mirror workflow ([abbcdb1](https://github.com/the-luap/picpeak/commit/abbcdb11136afd8cf4eb21c2103e81d22b9c886f))
* fix analytics dashboard and implement complete Umami integration ([45ce988](https://github.com/the-luap/picpeak/commit/45ce98806d4c87ddce8c400d07cc667bde435d75))
* **gallery/filters:** add Rated and Commented filters (UI + backend).\n\n- UI: add star (Rated) and message (Commented) buttons to feedback filter bars (desktop + mobile)\n- Backend: support filter=rated, commented, and combinations via aggregate counts/queries ([b03760a](https://github.com/the-luap/picpeak/commit/b03760ab01e21feb3578f90d065945d437d03452))
* **gallery:** add quick Like/Favorite actions on thumbnails across layouts ([6368f10](https://github.com/the-luap/picpeak/commit/6368f1027f96107ba64964eb126911bfe185f54a))
* **gallery:** always-visible feedback indicators on grid tiles; fallback image rendering in lightbox/hero; auto-auth from shared-link token; fix external photo resolver\n\n- GridGallery: bottom-left icons for like/rated/comment on every tile\n- Hero layout grid: added same indicators (non-intrusive icons)\n- Lightbox/Hero: add fallbackSrc to display thumbnail if original fails\n- GalleryAuth: auto-store token from /gallery/:slug/:token and hydrate event\n- Backend gallery photo route: use resolvePhotoFilePath for external-media\n\nfix(admin): move photo feedback badges to bottom-right on admin grid tiles\n\nfix(dashboard): add missing i18n keys for activity types + fallback to formatter\n\nfix(admin/feedback): correct thumbnail URL base + robust date parsing\n\nRefs: [#19](https://github.com/the-luap/picpeak/issues/19) ([6948aaa](https://github.com/the-luap/picpeak/commit/6948aaa92afc29609f85cf7fd631095f3e32ad3f))
* **gallery:** compact vertical icon-only feedback filter in PhotoFilterBar; remove wide buttons to prevent overflow\n\n- Desktop: vertical icon stack (All/Grid, Likes, Favorites) outside scroll area\n- Mobile: vertical icon stack below categories\n- Keeps existing category bar layout and count\n\nRefs: [#19](https://github.com/the-luap/picpeak/issues/19) ([465f997](https://github.com/the-luap/picpeak/commit/465f997752fc930ac0a3ae530e9e57a378877d53))
* **i18n:** add translations for settings tabs ([c030e87](https://github.com/the-luap/picpeak/commit/c030e872135b39701ef1f4bbb2f28bcaf4ce7fae))
* implement 4 new features with bug fixes and refactoring plan ([77a4bfd](https://github.com/the-luap/picpeak/commit/77a4bfd49975551bf509354097f280cab3e48c7a))
* implement beta/stable release channels with update notifications ([617e778](https://github.com/the-luap/picpeak/commit/617e778a48e0f0c24fcb8441d00ed2a816f19c03))
* implement comprehensive backup and restore system with S3 support ([f6a79c8](https://github.com/the-luap/picpeak/commit/f6a79c815e3085a56cbe7bac2964dd135f5e88bb))
* implement feedback filter for liked/favorited photos (Issue [#17](https://github.com/the-luap/picpeak/issues/17)) ([41857ec](https://github.com/the-luap/picpeak/commit/41857ec499e2aab4347173cb031db246b9a032f6))
* implement gallery feedback system with version tracking for backups ([dc1419c](https://github.com/the-luap/picpeak/commit/dc1419c051dae44532bfc2b2c2bc00942577dc22))
* implement gallery logo customization (Issue [#17](https://github.com/the-luap/picpeak/issues/17)) ([909e760](https://github.com/the-luap/picpeak/commit/909e760447c76bb35dbffa553a4665edc5ebccd9))
* **lightbox:** keep feedback usable while navigating ([6368f10](https://github.com/the-luap/picpeak/commit/6368f1027f96107ba64964eb126911bfe185f54a)), closes [#19](https://github.com/the-luap/picpeak/issues/19)
* Multi-administrator RBAC, CSS templates & security hardening ([#78](https://github.com/the-luap/picpeak/issues/78)) ([16b3ab0](https://github.com/the-luap/picpeak/commit/16b3ab039ae95f5641dc15a4811eb2b503f1791c))
* **native:** auto-serve SPA when dist exists (unless SERVE_FRONTEND=false); add clear logging; serve index.html for /admin ([fb16b7b](https://github.com/the-luap/picpeak/commit/fb16b7bbb8225192160c08050f1b164c36c8dc74))
* **native:** build frontend and serve SPA from backend (SERVE_FRONTEND); fix Cannot GET /admin on native installs ([9fe10bc](https://github.com/the-luap/picpeak/commit/9fe10bcce2871a48f2409b4936d95c00249deb51))
* **native:** serve built frontend from backend; build frontend during install/update; ensure env flags (SERVE_FRONTEND, FRONTEND_DIR) ([61ad2d6](https://github.com/the-luap/picpeak/commit/61ad2d61c137196c229817989f991e50fa389a6e))
* overhaul public landing page and backup tooling ([2a4d388](https://github.com/the-luap/picpeak/commit/2a4d38813f7ab64a6bbb3a666f3c98a29443488d))
* **select:** add per-tile checkbox selection in Admin grid and all gallery layouts; tile click opens viewer; checkbox toggles selection; auto-enable selection mode; add testids ([9fda54b](https://github.com/the-luap/picpeak/commit/9fda54bd06d37cd8f8f71056bf4f59e158cd8112))
* **setup/docker:** auto-set PUID/PGID from invoking user and chown bind-mount folders; create missing data/events dirs ([0618b78](https://github.com/the-luap/picpeak/commit/0618b78725e85f97f0a4b4e834c17811c033c8f4))
* **setup:** remove --admin-password; print admin credentials from ADMIN_CREDENTIALS.txt; fix ADMIN_URL to avoid /admin/admin; update native service commands ([84d0f63](https://github.com/the-luap/picpeak/commit/84d0f63d36c68532fea83e7087b1afeaa9b82f39))
* support per-gallery password toggle ([5d6c061](https://github.com/the-luap/picpeak/commit/5d6c061f1c4fd20581b1e74fa114c96530b5de53))
* update GitHub mirror workflow to start history from specific commit ([08da01f](https://github.com/the-luap/picpeak/commit/08da01f021788a1b81a3a3aabf120636c4e1a90a))


### Bug Fixes

* add missing route for feedback management page ([517128f](https://github.com/the-luap/picpeak/commit/517128fd99863ea203e39268ffa6c1ff093bcbd0))
* add missing translations and fix BackupHistory useTranslation error ([99e4778](https://github.com/the-luap/picpeak/commit/99e47785e4a53c7ef9f95421413a2704b15b456d))
* Add settings translations and fix manual backup process ([#82](https://github.com/the-luap/picpeak/issues/82)) ([476fcce](https://github.com/the-luap/picpeak/commit/476fcce13f30f9f2d2f98a0c87c25fba09e9eebc))
* **admin/feedback:** use correct event id when rendering photo thumbnails ([4c7b49a](https://github.com/the-luap/picpeak/commit/4c7b49a5f69a3fce4f9a0e837a082b56bb7e47d6)), closes [#19](https://github.com/the-luap/picpeak/issues/19)
* **admin:** prevent category badge overlap in grid ([d64e7d0](https://github.com/the-luap/picpeak/commit/d64e7d08deae7ad1b6f744f447fe546115427942))
* align backend port to 3000 across all configurations ([3a8d53f](https://github.com/the-luap/picpeak/commit/3a8d53f4927f577c4031c4bc3531e08191dc632a))
* Align nginx backend port for production Docker deployments (v2.2.2) ([#88](https://github.com/the-luap/picpeak/issues/88)) ([e0bd19a](https://github.com/the-luap/picpeak/commit/e0bd19a74dd81bdd45be2384820830bd96769e1c))
* auto-convert old date formats to new date-fns syntax ([e1aca6b](https://github.com/the-luap/picpeak/commit/e1aca6b00c5affb914a0db44a6264c8e54fdffd6))
* **backup:** add lastBackup alias and totalBackups for frontend compatibility ([749100c](https://github.com/the-luap/picpeak/commit/749100c92abd2bb123b137e3d3c6bb342b8f5f00))
* **backup:** allow manual backups when automated backups are disabled ([e6dd89e](https://github.com/the-luap/picpeak/commit/e6dd89e969fb7018633159155975bd2bd2fb0409))
* **ci:** add QEMU setup for multi-arch builds and skip for PRs ([0d36a27](https://github.com/the-luap/picpeak/commit/0d36a273bb58ffd0172efacd828e7171d954b41c))
* clear notifications via API ([#35](https://github.com/the-luap/picpeak/issues/35)) ([013be18](https://github.com/the-luap/picpeak/commit/013be18d982986333e2ac24c7ede907de49690bc))
* complete backup page translations and improve UI ([7387a5e](https://github.com/the-luap/picpeak/commit/7387a5e9f90965a6cfb75589b2338bf28263b840))
* complete restore page translations and fix structure ([618e269](https://github.com/the-luap/picpeak/commit/618e2695fdf844cc0ae961b50a9b6eb99bc46a03))
* configure github-release plugin to use GitHub API instead of Gitea ([2624ea6](https://github.com/the-luap/picpeak/commit/2624ea6130a38224597f0c4d3f3d0341c334472f))
* correct GitHub repository path in Drone CI release config ([247e154](https://github.com/the-luap/picpeak/commit/247e154afefd3aef285e459bb7fc39ea460e53e2))
* correct import statements for api in backup JSX files ([30f6780](https://github.com/the-luap/picpeak/commit/30f678048417aeffe6eabefc7bed5e4dc2267f25))
* correct malformed gallery URLs in admin panel View Gallery links ([3074748](https://github.com/the-luap/picpeak/commit/3074748bbc6a8cb8fc0e95d2f24d626f0d0444d0))
* correct password generator function name in reset password route ([65d796b](https://github.com/the-luap/picpeak/commit/65d796b9f09417f85bb3209c5e5fbe597a4bb2d3))
* correct script name in Gitea mirror workflow ([828d6bc](https://github.com/the-luap/picpeak/commit/828d6bc456175007b72998db7116eec993750435))
* **cors:** scope CORS to /api only and avoid throwing on disallowed origins; prevents static asset 500s on native ([90bb21e](https://github.com/the-luap/picpeak/commit/90bb21e38bf1ba97e3fb8185b8d05f1296d745ee))
* critical database connection pool exhaustion issues ([8588133](https://github.com/the-luap/picpeak/commit/8588133a4e35774e46f7c605638758e5b2a4a9e2))
* **db:** improve PostgreSQL connection check in wait-for-db.sh ([e85a68a](https://github.com/the-luap/picpeak/commit/e85a68a386c72c276b4958599b5246e60dfac716))
* display new password after admin password reset ([bd8b885](https://github.com/the-luap/picpeak/commit/bd8b885f7f060160eb852870d143f25ce628f3db))
* Docker Swarm DNS resolution and backup status display (v2.2.3) ([082d8ab](https://github.com/the-luap/picpeak/commit/082d8ab2054416b2a4f9e0438aa2bda0a8f4277e))
* Docker Swarm DNS resolution and backup status display (v2.2.3) ([082d8ab](https://github.com/the-luap/picpeak/commit/082d8ab2054416b2a4f9e0438aa2bda0a8f4277e))
* force github-release plugin to use GitHub API instead of Gitea ([558a966](https://github.com/the-luap/picpeak/commit/558a966f8509ac7b77c732f8cc5855c9f88a4bab))
* **frontend:** add missing externalMedia service and mount admin external-media routes; verify Vite build ([ab324f1](https://github.com/the-luap/picpeak/commit/ab324f192859204a3ea3c129530ccfe8f5a36968))
* gallery thumbnails not loading (404 errors) [#96](https://github.com/the-luap/picpeak/issues/96) ([e3c3c4c](https://github.com/the-luap/picpeak/commit/e3c3c4c951c52de99bd0afd95b08d119153997b4))
* **gallery/filters:** always apply global liked/favorited filters by aggregate counts (ignore guest_id); resolves mismatch between client guest_id and server identifier ([526dcd8](https://github.com/the-luap/picpeak/commit/526dcd8dfc030d86143cee799a88a1004d96b116))
* **gallery/filters:** make feedback filters work globally when no guest_id is provided; remove guest_id from client photos query\n\n- Backend /api/gallery/:slug/photos: if filter present and guest_id missing, filter by like_count/favorite_count\n- Frontend useGalleryPhotos: stop passing random guestId (does not match server guest_identifier)\n\nThis makes Liked/Favorited filters reflect photos with aggregate feedback counts as expected. ([5b2561b](https://github.com/the-luap/picpeak/commit/5b2561b6f1da2665d6092ba954f8ff26df3959a4))
* **gallery/sidebar:** compact icon-only feedback filter in sidebar (vertical, small) to avoid overflow; use GalleryFilter variant=compact ([ff89f96](https://github.com/the-luap/picpeak/commit/ff89f96e31130f75bcd7a406c5d895eac17b65de))
* **gallery:** feedback filter headline + horizontal icons in sidebar (compact variant); ensure sidebar content scrolls (flex-col container) ([3a6d061](https://github.com/the-luap/picpeak/commit/3a6d06192a280ead8bd5d1fbfe06554e63f3346e))
* handle auth errors and JSON parsing in admin panel ([b2ae5f1](https://github.com/the-luap/picpeak/commit/b2ae5f18ad4622ea9cb0b5b593dad19e5d14cf60))
* handle legacy non-JSON logo paths when replacing logo ([0d5ce48](https://github.com/the-luap/picpeak/commit/0d5ce48dccf0c61f210725ffae15dafc5e9f7cab))
* harden gallery downloads and per-gallery auth ([fc1bf53](https://github.com/the-luap/picpeak/commit/fc1bf534129092ca3638e4a4bc47274cd297fa5f))
* implement 9 production enhancements and security fixes ([c584369](https://github.com/the-luap/picpeak/commit/c584369d5d5c33fd794cf82a2aea8089bd10e514))
* improve admin credentials display and configuration ([ad495a9](https://github.com/the-luap/picpeak/commit/ad495a92c46d02849ce0d9176cff43c83c5c4b57))
* improve version bump workflow with better conflict resolution ([c787510](https://github.com/the-luap/picpeak/commit/c7875102c5196a9ef3038c2d5e0ee313fbb2782a))
* JSON serialize favicon and logo URLs for PostgreSQL storage ([b83f427](https://github.com/the-luap/picpeak/commit/b83f4272b584f937fea1f47656182e514b12d980))
* Multi-administrator RBAC, CSS templates & security hardening ([#80](https://github.com/the-luap/picpeak/issues/80)) ([37d4e1c](https://github.com/the-luap/picpeak/commit/37d4e1cb6132346699a90aebfbaec83d84f931f4))
* multiple improvements and CI/CD updates ([bf70567](https://github.com/the-luap/picpeak/commit/bf705674d505b0cb1b82fecc74aa8d95edd50a47))
* **native/http:** disable CSP upgrade-insecure-requests and HSTS unless ENABLE_HSTS=true; prevents HTTPS upgrades on HTTP installs ([24b4a31](https://github.com/the-luap/picpeak/commit/24b4a314a9e97b6c640ca29067e95028a23a8973))
* **native:** correct setup paths to /opt/picpeak/app, update repo URL, add sqlite prod support; docs path fixes ([b992b15](https://github.com/the-luap/picpeak/commit/b992b151d3ca6ccb4a9b2434d94edcdc90ada3b0))
* **native:** remove obsolete workers service; restart only backend; add API request logging and preflight handler; keep static assets outside CORS ([f3604b4](https://github.com/the-luap/picpeak/commit/f3604b438b37e5f2bddf98e79f458bfa2367cb75))
* **nginx:** add Docker DNS resolver for Swarm/dynamic service discovery ([049837f](https://github.com/the-luap/picpeak/commit/049837f9d675ff5a4d93c02e5eb771bf65bc2616))
* **nginx:** Add Docker DNS resolver for Swarm/dynamic service discovery (v2.2.3) ([cc1ddfd](https://github.com/the-luap/picpeak/commit/cc1ddfd42cccac07d5869fe2ee19c25a9ffa50e8))
* **photos:** category changes now persist and display correctly ([#77](https://github.com/the-luap/picpeak/issues/77)) ([d9da98c](https://github.com/the-luap/picpeak/commit/d9da98c355011c247c526b28e6f07b329a632b55))
* **photos:** resolve upload category selection and improve feedback buttons ([#77](https://github.com/the-luap/picpeak/issues/77)) ([856d533](https://github.com/the-luap/picpeak/commit/856d53343c6805706e1498892a29b120938f8547))
* prefer admin token on admin routes ([#23](https://github.com/the-luap/picpeak/issues/23) [#28](https://github.com/the-luap/picpeak/issues/28)) ([d4404e3](https://github.com/the-luap/picpeak/commit/d4404e39bd7953649da02d3e300ffef46573ac97))
* prevent unnecessary image recompression and fix SQLite migration [#95](https://github.com/the-luap/picpeak/issues/95) ([3cdc0ea](https://github.com/the-luap/picpeak/commit/3cdc0ea7152e63cd72124a91394741a6e6904af3))
* remove description field from migration 035 app_settings inserts ([22cc406](https://github.com/the-luap/picpeak/commit/22cc40617f88e1f0a636fc049c78601fc1f38c33))
* remove file requirement from GitHub release in Drone CI ([8335916](https://github.com/the-luap/picpeak/commit/833591681adf29d99a1dfa7c43d5aee7a6cb98ba))
* remove formatBoolean calls from migration 032 - critical production fix ([0502ed3](https://github.com/the-luap/picpeak/commit/0502ed34c9fe76acacc2aecd02151564d109cf0b))
* remove unnecessary publish-manifest job from Docker workflow ([986b101](https://github.com/the-luap/picpeak/commit/986b101040674f2253fcdfda99a9e603535daaa0))
* remove unused formatBoolean import from migration 033 ([1238db5](https://github.com/the-luap/picpeak/commit/1238db58c25e97513c9bdcb5dcc26b1034e9f074))
* remove updated_at field from password reset query ([ed0243e](https://github.com/the-luap/picpeak/commit/ed0243ec398acca26490ef27cbe3cfe5fa9b95a6))
* remove updated_at from app_settings inserts in multiple migrations ([4c42b4c](https://github.com/the-luap/picpeak/commit/4c42b4c60157755b770bea3b78d42fe6abd60afa))
* replace github-release plugin with direct curl API call ([76a466c](https://github.com/the-luap/picpeak/commit/76a466c0776eeabe3eac6a480bd699c2ae5c60bc))
* resolve backend startup errors in development ([f8fb1c3](https://github.com/the-luap/picpeak/commit/f8fb1c3f4b2b5de53182e987a9dfe042704320b9))
* resolve branding display issues and invitation parsing errors ([1931d73](https://github.com/the-luap/picpeak/commit/1931d73b60d3419203cc8b420841abbfc9e14d2d))
* Resolve branding display issues and invitation parsing errors (v2.2.1) ([#86](https://github.com/the-luap/picpeak/issues/86)) ([d7ecf83](https://github.com/the-luap/picpeak/commit/d7ecf83d32ec6608280b96e6cdee48e9a0ad0afa))
* resolve CI/CD version bump race condition ([0bf4764](https://github.com/the-luap/picpeak/commit/0bf4764a0720f6f199442a738a885a2edaae2a4d))
* resolve database connection error for analytics settings ([95939d5](https://github.com/the-luap/picpeak/commit/95939d57e6857646d261b0f049bdda752602caeb))
* resolve date formatting error in event creation ([c51d756](https://github.com/the-luap/picpeak/commit/c51d7565035146cc3f689c0cc4b508b78d9bb5ee))
* resolve development environment issues ([61299a3](https://github.com/the-luap/picpeak/commit/61299a33c4f92730fe8b14f6035f61325d952b94))
* resolve duplicate logger declaration and syntax error in rate limit service ([0fe6d73](https://github.com/the-luap/picpeak/commit/0fe6d738b222555b27cbf8a36f455b1c15c4f4e8))
* resolve feedback validation issues from GitHub issue [#16](https://github.com/the-luap/picpeak/issues/16) ([f26beca](https://github.com/the-luap/picpeak/commit/f26becad1dfa72c62b6ecec491be025644426d67))
* resolve feedback validation issues from GitHub issue [#16](https://github.com/the-luap/picpeak/issues/16) ([67ff415](https://github.com/the-luap/picpeak/commit/67ff4158404347bc7c13dee5b4e13260eb0e743d))
* resolve GitHub issues [#4](https://github.com/the-luap/picpeak/issues/4), [#8](https://github.com/the-luap/picpeak/issues/8), [#9](https://github.com/the-luap/picpeak/issues/9), and [#10](https://github.com/the-luap/picpeak/issues/10) ([934d6dd](https://github.com/the-luap/picpeak/commit/934d6ddc5847f65db6371a4043b764f6d4cd6c8b))
* resolve GitHub mirror workflow cherry-pick failure with merge commits ([d6adde4](https://github.com/the-luap/picpeak/commit/d6adde4e093537aeecf8b190513a1171c3ecc82c))
* resolve language-specific column issues in core migrations ([62617f6](https://github.com/the-luap/picpeak/commit/62617f627f56aedd132fa20528b1d7c7e272c85c))
* resolve migration conflicts and duplicate numbering ([a401fbd](https://github.com/the-luap/picpeak/commit/a401fbdc54f30c18b5aa2440d7b6887ca12e00eb))
* resolve multiple feedback management issues ([ad75818](https://github.com/the-luap/picpeak/commit/ad758185666bf4ac52965f16d1c0e1e052887ac2))
* resolve multiple issues from GitHub issue [#14](https://github.com/the-luap/picpeak/issues/14) ([e91209f](https://github.com/the-luap/picpeak/commit/e91209f7cb38a5b840e74ed6acd8d490ef9d2294))
* resolve port configuration issues and database column mismatch ([6de64a1](https://github.com/the-luap/picpeak/commit/6de64a1df18932badd7bb1b9928d09e9477f0c3f))
* resolve PostgreSQL migration issues for development environment ([ee855a3](https://github.com/the-luap/picpeak/commit/ee855a3502ecd1a5556e378e9995de86e3548de1))
* resolve production UI and API issues ([d5790ad](https://github.com/the-luap/picpeak/commit/d5790ad635596842926a358753932e5c422590d6))
* resolve SIGPIPE error in GitHub mirror workflow file cleanup ([b7c8953](https://github.com/the-luap/picpeak/commit/b7c8953cb4d4a2541dcb38865c8a7beef0edf494))
* resolve translation interpolation issue for download button ([c1e10f1](https://github.com/the-luap/picpeak/commit/c1e10f14a30797c76169c2531de5d04976ee4888))
* **security:** upgrade Alpine base image to fix libpng and c-ares CVEs ([b706eeb](https://github.com/the-luap/picpeak/commit/b706eeb5d332e9618706193976a7241aee53d879))
* **setup/native:** correct repo URL, paths, and systemd for native install; support sqlite in production knex config ([87b8414](https://github.com/the-luap/picpeak/commit/87b8414e449802db6dc9f762453f7672616b83c9))
* **setup/native:** Debian 12 compatibility (reliable RAM detection, sudo-less run_as_user, git safe.directory); ensure SQLite data dir; use user for migrate ([dc482e6](https://github.com/the-luap/picpeak/commit/dc482e614a5fbac44c6570d812669511301a4403))
* **setup/native:** handle forced updates safely by fetch+checkout/reset instead of pull; stable on rewritten histories ([3697344](https://github.com/the-luap/picpeak/commit/3697344cd0add28b4da71c3b33e2ccc0a96f50f9))
* **setup/update:** detect native installs first (/opt/picpeak/app/backend or systemd unit); avoid false docker updates on root ([adf576f](https://github.com/the-luap/picpeak/commit/adf576fbe17f40c13c1d77dd9751f2e9dbf523a1))
* simplify Drone github-release step to avoid shell parsing issues ([94f10e1](https://github.com/the-luap/picpeak/commit/94f10e164502e6848cd720ee5a5c2822abbde46f))
* stabilize uploads and guest feedback filters ([aaaf598](https://github.com/the-luap/picpeak/commit/aaaf59817b3978635d2282c006853e183ab944d4))
* update all deployment guide links in README.md ([6389b9d](https://github.com/the-luap/picpeak/commit/6389b9df3f616c09a9bbbf1a2988764b0c3aeb77))
* update deployment guide with critical URL configuration and nginx port fixes ([1cadce1](https://github.com/the-luap/picpeak/commit/1cadce196bb04a0575d83437618454d4ca5bcdac))
* update form-data and multer to address security vulnerabilities ([7750170](https://github.com/the-luap/picpeak/commit/7750170832dddf81a33c7c2409b37b0b7bc1f290))
* update Gitea mirror workflow to selectively remove scripts ([296430e](https://github.com/the-luap/picpeak/commit/296430e4d7e01a6be031dbb89dd25f563b163a97))
* update GitHub mirror action to support fine-grained personal access tokens ([827eb48](https://github.com/the-luap/picpeak/commit/827eb4819b7da6171d48613963d176399cad80c6))
* use admin API for Umami config in analytics page ([a54a2c0](https://github.com/the-luap/picpeak/commit/a54a2c0fdaa28193d1359da73bc7fb61476e2a58))
* use plugins/gitea-release for Drone CI/CD ([0c783c6](https://github.com/the-luap/picpeak/commit/0c783c66d0dfe8cb637f0db7349ae9637d7bf787))
* use plugins/github-release for Drone CI/CD ([f926cd3](https://github.com/the-luap/picpeak/commit/f926cd3adf513858bc7b291582c7ca2efdf93ff8))
* watermark upload JSON parsing and image quality preservation ([0e3b50d](https://github.com/the-luap/picpeak/commit/0e3b50d1b6a2dc532ebdc0981f81f77722e8f23a))


### Documentation

* add minimum system requirements section to README ([4615a5d](https://github.com/the-luap/picpeak/commit/4615a5d795b415367edf4882628377936b29ab32))
* add PUID/PGID note for Docker bind mounts to avoid permission issues ([0178e71](https://github.com/the-luap/picpeak/commit/0178e71c67f198c6013ece52b0a2da0e2f1a6b2a))
* add transparency note about AI-assisted development ([35e360d](https://github.com/the-luap/picpeak/commit/35e360dcf7ac68833bec81f2e79f4a11a76a0e87))
* add warnings about $ character in Docker Compose passwords ([87d1761](https://github.com/the-luap/picpeak/commit/87d1761091bb97747821aa810a58f3978a59d08f))
* clarify VITE_API_URL usage; remove FRONTEND_API_URL; add storage vars; simplify compose mounts and external DB example (refs [#18](https://github.com/the-luap/picpeak/issues/18)) ([758c085](https://github.com/the-luap/picpeak/commit/758c085467e579e9f6b16df2298747fdddf2b205))
* **compose:** fix backend healthcheck path; remove frontend VITE_API_URL env and document /api proxy (refs [#18](https://github.com/the-luap/picpeak/issues/18)) ([ecbc488](https://github.com/the-luap/picpeak/commit/ecbc48815ded99a052ef057e69427c823cd34ece))
* fix deployment/admin routing and CORS guidance; add AGENTS.md; ignore AGENTS.md (refs [#18](https://github.com/the-luap/picpeak/issues/18)) ([dad1787](https://github.com/the-luap/picpeak/commit/dad1787aad8763637373e8eb87a47728d3d568cc))
* follow-up on PR [#15](https://github.com/the-luap/picpeak/issues/15) — clarify VITE_API_URL usage, compose mounts, and admin routing (refs [#15](https://github.com/the-luap/picpeak/issues/15)) ([e9171c7](https://github.com/the-luap/picpeak/commit/e9171c71159cb41b91a099621bd2d7a7985dd239))
* **readme:** reflect new External Media reference mode and update roadmap (gallery feedback status) ([ee13556](https://github.com/the-luap/picpeak/commit/ee13556c5cb4f24fe88e14fd00b821acf65b11cb))
* replace email addresses with GitHub issue links ([0c989ce](https://github.com/the-luap/picpeak/commit/0c989ce08699ce68b131a9cc4ba4f14e06e3d221))
* update deployment guide with GitHub Container Registry images ([2c9a56f](https://github.com/the-luap/picpeak/commit/2c9a56f217218f0700817d150b3de115e9503baa))


### Code Refactoring

* simplify deployment structure with direct port exposure ([6492cb9](https://github.com/the-luap/picpeak/commit/6492cb9ec8f8b811297aa71c153b9fe6a00e947a))

## [2.3.0](https://github.com/the-luap/picpeak/compare/v2.2.4...v2.3.0) (2026-01-15)


### Features

* beta/stable release channels with update notifications and bug fixes ([3c7dc20](https://github.com/the-luap/picpeak/commit/3c7dc2013fc3b57712ddf16db85f495b3cc7bfd7))
* beta/stable release channels with update notifications and bug fixes ([#98](https://github.com/the-luap/picpeak/issues/98)) ([3c7dc20](https://github.com/the-luap/picpeak/commit/3c7dc2013fc3b57712ddf16db85f495b3cc7bfd7))
* implement beta/stable release channels with update notifications ([617e778](https://github.com/the-luap/picpeak/commit/617e778a48e0f0c24fcb8441d00ed2a816f19c03))


### Bug Fixes

* display new password after admin password reset ([bd8b885](https://github.com/the-luap/picpeak/commit/bd8b885f7f060160eb852870d143f25ce628f3db))
* gallery thumbnails not loading (404 errors) [#96](https://github.com/the-luap/picpeak/issues/96) ([e3c3c4c](https://github.com/the-luap/picpeak/commit/e3c3c4c951c52de99bd0afd95b08d119153997b4))
* prevent unnecessary image recompression and fix SQLite migration [#95](https://github.com/the-luap/picpeak/issues/95) ([3cdc0ea](https://github.com/the-luap/picpeak/commit/3cdc0ea7152e63cd72124a91394741a6e6904af3))
* watermark upload JSON parsing and image quality preservation ([0e3b50d](https://github.com/the-luap/picpeak/commit/0e3b50d1b6a2dc532ebdc0981f81f77722e8f23a))

## [2.2.4](https://github.com/the-luap/picpeak/compare/v2.2.3...v2.2.4) (2026-01-08)


### Bug Fixes

* **backup:** add lastBackup alias and totalBackups for frontend compatibility ([749100c](https://github.com/the-luap/picpeak/commit/749100c92abd2bb123b137e3d3c6bb342b8f5f00))
* Docker Swarm DNS resolution and backup status display (v2.2.3) ([082d8ab](https://github.com/the-luap/picpeak/commit/082d8ab2054416b2a4f9e0438aa2bda0a8f4277e))
* Docker Swarm DNS resolution and backup status display (v2.2.3) ([082d8ab](https://github.com/the-luap/picpeak/commit/082d8ab2054416b2a4f9e0438aa2bda0a8f4277e))

## [2.2.3](https://github.com/the-luap/picpeak/compare/v2.2.2...v2.2.3) (2026-01-08)


### Bug Fixes

* **nginx:** add Docker DNS resolver for Swarm/dynamic service discovery ([049837f](https://github.com/the-luap/picpeak/commit/049837f9d675ff5a4d93c02e5eb771bf65bc2616))
* **nginx:** Add Docker DNS resolver for Swarm/dynamic service discovery (v2.2.3) ([cc1ddfd](https://github.com/the-luap/picpeak/commit/cc1ddfd42cccac07d5869fe2ee19c25a9ffa50e8))

## [2.2.2](https://github.com/the-luap/picpeak/compare/v2.2.1...v2.2.2) (2026-01-08)


### Bug Fixes

* align backend port to 3000 across all configurations ([3a8d53f](https://github.com/the-luap/picpeak/commit/3a8d53f4927f577c4031c4bc3531e08191dc632a))
* Align nginx backend port for production Docker deployments (v2.2.2) ([#88](https://github.com/the-luap/picpeak/issues/88)) ([e0bd19a](https://github.com/the-luap/picpeak/commit/e0bd19a74dd81bdd45be2384820830bd96769e1c))

## [2.2.1](https://github.com/the-luap/picpeak/compare/v2.2.0...v2.2.1) (2026-01-08)


### Bug Fixes

* handle legacy non-JSON logo paths when replacing logo ([0d5ce48](https://github.com/the-luap/picpeak/commit/0d5ce48dccf0c61f210725ffae15dafc5e9f7cab))
* JSON serialize favicon and logo URLs for PostgreSQL storage ([b83f427](https://github.com/the-luap/picpeak/commit/b83f4272b584f937fea1f47656182e514b12d980))
* resolve branding display issues and invitation parsing errors ([1931d73](https://github.com/the-luap/picpeak/commit/1931d73b60d3419203cc8b420841abbfc9e14d2d))
* Resolve branding display issues and invitation parsing errors (v2.2.1) ([#86](https://github.com/the-luap/picpeak/issues/86)) ([d7ecf83](https://github.com/the-luap/picpeak/commit/d7ecf83d32ec6608280b96e6cdee48e9a0ad0afa))

## [2.2.0](https://github.com/the-luap/picpeak/compare/v2.1.1...v2.2.0) (2026-01-08)


### Features

* **i18n:** add translations for settings tabs ([c030e87](https://github.com/the-luap/picpeak/commit/c030e872135b39701ef1f4bbb2f28bcaf4ce7fae))


### Bug Fixes

* Add settings translations and fix manual backup process ([#82](https://github.com/the-luap/picpeak/issues/82)) ([476fcce](https://github.com/the-luap/picpeak/commit/476fcce13f30f9f2d2f98a0c87c25fba09e9eebc))
* **backup:** allow manual backups when automated backups are disabled ([e6dd89e](https://github.com/the-luap/picpeak/commit/e6dd89e969fb7018633159155975bd2bd2fb0409))
* **db:** improve PostgreSQL connection check in wait-for-db.sh ([e85a68a](https://github.com/the-luap/picpeak/commit/e85a68a386c72c276b4958599b5246e60dfac716))

## [2.1.1](https://github.com/the-luap/picpeak/compare/v2.1.0...v2.1.1) (2026-01-07)


### Bug Fixes

* **ci:** add QEMU setup for multi-arch builds and skip for PRs ([0d36a27](https://github.com/the-luap/picpeak/commit/0d36a273bb58ffd0172efacd828e7171d954b41c))
* Multi-administrator RBAC, CSS templates & security hardening ([#80](https://github.com/the-luap/picpeak/issues/80)) ([37d4e1c](https://github.com/the-luap/picpeak/commit/37d4e1cb6132346699a90aebfbaec83d84f931f4))

## [2.1.0](https://github.com/the-luap/picpeak/compare/v2.0.0...v2.1.0) (2026-01-07)


### Features

* add multi-administrator support with RBAC and fix backup/restore for S3 ([892e47d](https://github.com/the-luap/picpeak/commit/892e47d017064d7922536f8e138bbb290a45cdc9))
* **events:** add CSS template selector to event edit page ([6a6c2cd](https://github.com/the-luap/picpeak/commit/6a6c2cd34db26a53b5fb96415650e8136a74e47f))
* Multi-administrator RBAC, CSS templates & security hardening ([#78](https://github.com/the-luap/picpeak/issues/78)) ([16b3ab0](https://github.com/the-luap/picpeak/commit/16b3ab039ae95f5641dc15a4811eb2b503f1791c))


### Bug Fixes

* **photos:** category changes now persist and display correctly ([#77](https://github.com/the-luap/picpeak/issues/77)) ([d9da98c](https://github.com/the-luap/picpeak/commit/d9da98c355011c247c526b28e6f07b329a632b55))
* **photos:** resolve upload category selection and improve feedback buttons ([#77](https://github.com/the-luap/picpeak/issues/77)) ([856d533](https://github.com/the-luap/picpeak/commit/856d53343c6805706e1498892a29b120938f8547))

## [2.0.0](https://github.com/the-luap/picpeak/compare/v1.1.15...v2.0.0) (2026-01-03)


### ⚠ BREAKING CHANGES

* Deployment now requires external reverse proxy for SSL/HTTPS

### Features

* add Apple Liquid Glass templates, image security settings, and automated releases ([6033461](https://github.com/the-luap/picpeak/commit/6033461be118ce78277ec568e1ef1ceeff7311c8))
* add complete translation support for backup admin page ([e9f92e6](https://github.com/the-luap/picpeak/commit/e9f92e66d08ac7001c31a3ee8f43ee8306bc79a9))
* Add CSS template system with custom gallery styling support ([0da45e6](https://github.com/the-luap/picpeak/commit/0da45e699ad998031aa56a92f2da5ee61a04e285))
* add event management, gallery customization, and release automationFeature/event rename ([40ee671](https://github.com/the-luap/picpeak/commit/40ee67171d41522037bf9d4e7675b62ec564346d))
* add feedback management enhancements ([0064122](https://github.com/the-luap/picpeak/commit/0064122eff12029300ab7f95078b5710c3c2d08c))
* add GitHub Actions workflow for Docker image builds ([4029559](https://github.com/the-luap/picpeak/commit/40295599547b86af7fea3359c7486918d2cd0236))
* **admin:** external media import modal + thumbnail fixes for reference events\n\n- Photos tab: replace inline external folder picker with a modal opened via "Import from External Folder" button next to "Upload Photos"; add info that all pictures in the selected folder will be imported.\n- Admin thumbnails: align list endpoint to /api/admin/photos/:eventId/photos and always return thumbnail_url to trigger on-demand generation; normalize external paths to avoid duplicated folder segments (e.g., individual/individual) that broke resolver; improve thumbnail logging.\n- Use authenticated image fetching on admin feedback pages to prevent 401s in automation.\n- i18n: add backup.external.warning strings; complete German backup/restore coverage; add common keys (notSet, of, up, select, selected).\n- Docs: add Local (npm) setup for EXTERNAL_MEDIA_ROOT in deployment guide.\n\nRefs [#17](https://github.com/the-luap/picpeak/issues/17) – gallery feature request: https://github.com/the-luap/picpeak/issues/17 ([49c7778](https://github.com/the-luap/picpeak/commit/49c77785e7a776890f15c0c541dcd18b74a86c6e))
* **admin:** refine header layout and logo placement ([d64e7d0](https://github.com/the-luap/picpeak/commit/d64e7d08deae7ad1b6f744f447fe546115427942))
* allow admin email updates in UI ([#36](https://github.com/the-luap/picpeak/issues/36)) ([3c2a79a](https://github.com/the-luap/picpeak/commit/3c2a79a31a0f1a44c8ec4f9a87f6fbcea9be651c))
* completely rewrite GitHub mirror to create new history from target commit ([febacb7](https://github.com/the-luap/picpeak/commit/febacb79ad86d35a222ec86a1e7da65747bbe19a))
* consolidate setup scripts and guides into unified solution ([29a8ff9](https://github.com/the-luap/picpeak/commit/29a8ff914cf838918ab827280e4415afbce5ca8d))
* **docker:** add PUID/PGID and user mapping to avoid bind mount permission issues; feat(setup): prompt for admin email interactively; docs: PUID/PGID in .env.example ([410a33f](https://github.com/the-luap/picpeak/commit/410a33fecf1693cc75816c53ac460ec20089e2a1))
* enhance mirror-to-github workflow with commit-based history filtering ([b4b09c1](https://github.com/the-luap/picpeak/commit/b4b09c16504ca64ce265c7bd0bf0c901dbbd0638))
* exclude Claude contributor from GitHub mirror workflow ([abbcdb1](https://github.com/the-luap/picpeak/commit/abbcdb11136afd8cf4eb21c2103e81d22b9c886f))
* fix analytics dashboard and implement complete Umami integration ([45ce988](https://github.com/the-luap/picpeak/commit/45ce98806d4c87ddce8c400d07cc667bde435d75))
* **gallery/filters:** add Rated and Commented filters (UI + backend).\n\n- UI: add star (Rated) and message (Commented) buttons to feedback filter bars (desktop + mobile)\n- Backend: support filter=rated, commented, and combinations via aggregate counts/queries ([b03760a](https://github.com/the-luap/picpeak/commit/b03760ab01e21feb3578f90d065945d437d03452))
* **gallery:** add quick Like/Favorite actions on thumbnails across layouts ([6368f10](https://github.com/the-luap/picpeak/commit/6368f1027f96107ba64964eb126911bfe185f54a))
* **gallery:** always-visible feedback indicators on grid tiles; fallback image rendering in lightbox/hero; auto-auth from shared-link token; fix external photo resolver\n\n- GridGallery: bottom-left icons for like/rated/comment on every tile\n- Hero layout grid: added same indicators (non-intrusive icons)\n- Lightbox/Hero: add fallbackSrc to display thumbnail if original fails\n- GalleryAuth: auto-store token from /gallery/:slug/:token and hydrate event\n- Backend gallery photo route: use resolvePhotoFilePath for external-media\n\nfix(admin): move photo feedback badges to bottom-right on admin grid tiles\n\nfix(dashboard): add missing i18n keys for activity types + fallback to formatter\n\nfix(admin/feedback): correct thumbnail URL base + robust date parsing\n\nRefs: [#19](https://github.com/the-luap/picpeak/issues/19) ([6948aaa](https://github.com/the-luap/picpeak/commit/6948aaa92afc29609f85cf7fd631095f3e32ad3f))
* **gallery:** compact vertical icon-only feedback filter in PhotoFilterBar; remove wide buttons to prevent overflow\n\n- Desktop: vertical icon stack (All/Grid, Likes, Favorites) outside scroll area\n- Mobile: vertical icon stack below categories\n- Keeps existing category bar layout and count\n\nRefs: [#19](https://github.com/the-luap/picpeak/issues/19) ([465f997](https://github.com/the-luap/picpeak/commit/465f997752fc930ac0a3ae530e9e57a378877d53))
* implement 4 new features with bug fixes and refactoring plan ([77a4bfd](https://github.com/the-luap/picpeak/commit/77a4bfd49975551bf509354097f280cab3e48c7a))
* implement comprehensive backup and restore system with S3 support ([f6a79c8](https://github.com/the-luap/picpeak/commit/f6a79c815e3085a56cbe7bac2964dd135f5e88bb))
* implement feedback filter for liked/favorited photos (Issue [#17](https://github.com/the-luap/picpeak/issues/17)) ([41857ec](https://github.com/the-luap/picpeak/commit/41857ec499e2aab4347173cb031db246b9a032f6))
* implement gallery feedback system with version tracking for backups ([dc1419c](https://github.com/the-luap/picpeak/commit/dc1419c051dae44532bfc2b2c2bc00942577dc22))
* implement gallery logo customization (Issue [#17](https://github.com/the-luap/picpeak/issues/17)) ([909e760](https://github.com/the-luap/picpeak/commit/909e760447c76bb35dbffa553a4665edc5ebccd9))
* **lightbox:** keep feedback usable while navigating ([6368f10](https://github.com/the-luap/picpeak/commit/6368f1027f96107ba64964eb126911bfe185f54a)), closes [#19](https://github.com/the-luap/picpeak/issues/19)
* **native:** auto-serve SPA when dist exists (unless SERVE_FRONTEND=false); add clear logging; serve index.html for /admin ([fb16b7b](https://github.com/the-luap/picpeak/commit/fb16b7bbb8225192160c08050f1b164c36c8dc74))
* **native:** build frontend and serve SPA from backend (SERVE_FRONTEND); fix Cannot GET /admin on native installs ([9fe10bc](https://github.com/the-luap/picpeak/commit/9fe10bcce2871a48f2409b4936d95c00249deb51))
* **native:** serve built frontend from backend; build frontend during install/update; ensure env flags (SERVE_FRONTEND, FRONTEND_DIR) ([61ad2d6](https://github.com/the-luap/picpeak/commit/61ad2d61c137196c229817989f991e50fa389a6e))
* overhaul public landing page and backup tooling ([2a4d388](https://github.com/the-luap/picpeak/commit/2a4d38813f7ab64a6bbb3a666f3c98a29443488d))
* **select:** add per-tile checkbox selection in Admin grid and all gallery layouts; tile click opens viewer; checkbox toggles selection; auto-enable selection mode; add testids ([9fda54b](https://github.com/the-luap/picpeak/commit/9fda54bd06d37cd8f8f71056bf4f59e158cd8112))
* **setup/docker:** auto-set PUID/PGID from invoking user and chown bind-mount folders; create missing data/events dirs ([0618b78](https://github.com/the-luap/picpeak/commit/0618b78725e85f97f0a4b4e834c17811c033c8f4))
* **setup:** remove --admin-password; print admin credentials from ADMIN_CREDENTIALS.txt; fix ADMIN_URL to avoid /admin/admin; update native service commands ([84d0f63](https://github.com/the-luap/picpeak/commit/84d0f63d36c68532fea83e7087b1afeaa9b82f39))
* support per-gallery password toggle ([5d6c061](https://github.com/the-luap/picpeak/commit/5d6c061f1c4fd20581b1e74fa114c96530b5de53))
* update GitHub mirror workflow to start history from specific commit ([08da01f](https://github.com/the-luap/picpeak/commit/08da01f021788a1b81a3a3aabf120636c4e1a90a))


### Bug Fixes

* add missing route for feedback management page ([517128f](https://github.com/the-luap/picpeak/commit/517128fd99863ea203e39268ffa6c1ff093bcbd0))
* add missing translations and fix BackupHistory useTranslation error ([99e4778](https://github.com/the-luap/picpeak/commit/99e47785e4a53c7ef9f95421413a2704b15b456d))
* **admin/feedback:** use correct event id when rendering photo thumbnails ([4c7b49a](https://github.com/the-luap/picpeak/commit/4c7b49a5f69a3fce4f9a0e837a082b56bb7e47d6)), closes [#19](https://github.com/the-luap/picpeak/issues/19)
* **admin:** prevent category badge overlap in grid ([d64e7d0](https://github.com/the-luap/picpeak/commit/d64e7d08deae7ad1b6f744f447fe546115427942))
* auto-convert old date formats to new date-fns syntax ([e1aca6b](https://github.com/the-luap/picpeak/commit/e1aca6b00c5affb914a0db44a6264c8e54fdffd6))
* clear notifications via API ([#35](https://github.com/the-luap/picpeak/issues/35)) ([013be18](https://github.com/the-luap/picpeak/commit/013be18d982986333e2ac24c7ede907de49690bc))
* complete backup page translations and improve UI ([7387a5e](https://github.com/the-luap/picpeak/commit/7387a5e9f90965a6cfb75589b2338bf28263b840))
* complete restore page translations and fix structure ([618e269](https://github.com/the-luap/picpeak/commit/618e2695fdf844cc0ae961b50a9b6eb99bc46a03))
* configure github-release plugin to use GitHub API instead of Gitea ([2624ea6](https://github.com/the-luap/picpeak/commit/2624ea6130a38224597f0c4d3f3d0341c334472f))
* correct GitHub repository path in Drone CI release config ([247e154](https://github.com/the-luap/picpeak/commit/247e154afefd3aef285e459bb7fc39ea460e53e2))
* correct import statements for api in backup JSX files ([30f6780](https://github.com/the-luap/picpeak/commit/30f678048417aeffe6eabefc7bed5e4dc2267f25))
* correct malformed gallery URLs in admin panel View Gallery links ([3074748](https://github.com/the-luap/picpeak/commit/3074748bbc6a8cb8fc0e95d2f24d626f0d0444d0))
* correct password generator function name in reset password route ([65d796b](https://github.com/the-luap/picpeak/commit/65d796b9f09417f85bb3209c5e5fbe597a4bb2d3))
* correct script name in Gitea mirror workflow ([828d6bc](https://github.com/the-luap/picpeak/commit/828d6bc456175007b72998db7116eec993750435))
* **cors:** scope CORS to /api only and avoid throwing on disallowed origins; prevents static asset 500s on native ([90bb21e](https://github.com/the-luap/picpeak/commit/90bb21e38bf1ba97e3fb8185b8d05f1296d745ee))
* critical database connection pool exhaustion issues ([8588133](https://github.com/the-luap/picpeak/commit/8588133a4e35774e46f7c605638758e5b2a4a9e2))
* force github-release plugin to use GitHub API instead of Gitea ([558a966](https://github.com/the-luap/picpeak/commit/558a966f8509ac7b77c732f8cc5855c9f88a4bab))
* **frontend:** add missing externalMedia service and mount admin external-media routes; verify Vite build ([ab324f1](https://github.com/the-luap/picpeak/commit/ab324f192859204a3ea3c129530ccfe8f5a36968))
* **gallery/filters:** always apply global liked/favorited filters by aggregate counts (ignore guest_id); resolves mismatch between client guest_id and server identifier ([526dcd8](https://github.com/the-luap/picpeak/commit/526dcd8dfc030d86143cee799a88a1004d96b116))
* **gallery/filters:** make feedback filters work globally when no guest_id is provided; remove guest_id from client photos query\n\n- Backend /api/gallery/:slug/photos: if filter present and guest_id missing, filter by like_count/favorite_count\n- Frontend useGalleryPhotos: stop passing random guestId (does not match server guest_identifier)\n\nThis makes Liked/Favorited filters reflect photos with aggregate feedback counts as expected. ([5b2561b](https://github.com/the-luap/picpeak/commit/5b2561b6f1da2665d6092ba954f8ff26df3959a4))
* **gallery/sidebar:** compact icon-only feedback filter in sidebar (vertical, small) to avoid overflow; use GalleryFilter variant=compact ([ff89f96](https://github.com/the-luap/picpeak/commit/ff89f96e31130f75bcd7a406c5d895eac17b65de))
* **gallery:** feedback filter headline + horizontal icons in sidebar (compact variant); ensure sidebar content scrolls (flex-col container) ([3a6d061](https://github.com/the-luap/picpeak/commit/3a6d06192a280ead8bd5d1fbfe06554e63f3346e))
* handle auth errors and JSON parsing in admin panel ([b2ae5f1](https://github.com/the-luap/picpeak/commit/b2ae5f18ad4622ea9cb0b5b593dad19e5d14cf60))
* harden gallery downloads and per-gallery auth ([fc1bf53](https://github.com/the-luap/picpeak/commit/fc1bf534129092ca3638e4a4bc47274cd297fa5f))
* implement 9 production enhancements and security fixes ([c584369](https://github.com/the-luap/picpeak/commit/c584369d5d5c33fd794cf82a2aea8089bd10e514))
* improve admin credentials display and configuration ([ad495a9](https://github.com/the-luap/picpeak/commit/ad495a92c46d02849ce0d9176cff43c83c5c4b57))
* improve version bump workflow with better conflict resolution ([c787510](https://github.com/the-luap/picpeak/commit/c7875102c5196a9ef3038c2d5e0ee313fbb2782a))
* multiple improvements and CI/CD updates ([bf70567](https://github.com/the-luap/picpeak/commit/bf705674d505b0cb1b82fecc74aa8d95edd50a47))
* **native/http:** disable CSP upgrade-insecure-requests and HSTS unless ENABLE_HSTS=true; prevents HTTPS upgrades on HTTP installs ([24b4a31](https://github.com/the-luap/picpeak/commit/24b4a314a9e97b6c640ca29067e95028a23a8973))
* **native:** correct setup paths to /opt/picpeak/app, update repo URL, add sqlite prod support; docs path fixes ([b992b15](https://github.com/the-luap/picpeak/commit/b992b151d3ca6ccb4a9b2434d94edcdc90ada3b0))
* **native:** remove obsolete workers service; restart only backend; add API request logging and preflight handler; keep static assets outside CORS ([f3604b4](https://github.com/the-luap/picpeak/commit/f3604b438b37e5f2bddf98e79f458bfa2367cb75))
* prefer admin token on admin routes ([#23](https://github.com/the-luap/picpeak/issues/23) [#28](https://github.com/the-luap/picpeak/issues/28)) ([d4404e3](https://github.com/the-luap/picpeak/commit/d4404e39bd7953649da02d3e300ffef46573ac97))
* remove description field from migration 035 app_settings inserts ([22cc406](https://github.com/the-luap/picpeak/commit/22cc40617f88e1f0a636fc049c78601fc1f38c33))
* remove file requirement from GitHub release in Drone CI ([8335916](https://github.com/the-luap/picpeak/commit/833591681adf29d99a1dfa7c43d5aee7a6cb98ba))
* remove formatBoolean calls from migration 032 - critical production fix ([0502ed3](https://github.com/the-luap/picpeak/commit/0502ed34c9fe76acacc2aecd02151564d109cf0b))
* remove unnecessary publish-manifest job from Docker workflow ([986b101](https://github.com/the-luap/picpeak/commit/986b101040674f2253fcdfda99a9e603535daaa0))
* remove unused formatBoolean import from migration 033 ([1238db5](https://github.com/the-luap/picpeak/commit/1238db58c25e97513c9bdcb5dcc26b1034e9f074))
* remove updated_at field from password reset query ([ed0243e](https://github.com/the-luap/picpeak/commit/ed0243ec398acca26490ef27cbe3cfe5fa9b95a6))
* remove updated_at from app_settings inserts in multiple migrations ([4c42b4c](https://github.com/the-luap/picpeak/commit/4c42b4c60157755b770bea3b78d42fe6abd60afa))
* replace github-release plugin with direct curl API call ([76a466c](https://github.com/the-luap/picpeak/commit/76a466c0776eeabe3eac6a480bd699c2ae5c60bc))
* resolve backend startup errors in development ([f8fb1c3](https://github.com/the-luap/picpeak/commit/f8fb1c3f4b2b5de53182e987a9dfe042704320b9))
* resolve CI/CD version bump race condition ([0bf4764](https://github.com/the-luap/picpeak/commit/0bf4764a0720f6f199442a738a885a2edaae2a4d))
* resolve database connection error for analytics settings ([95939d5](https://github.com/the-luap/picpeak/commit/95939d57e6857646d261b0f049bdda752602caeb))
* resolve date formatting error in event creation ([c51d756](https://github.com/the-luap/picpeak/commit/c51d7565035146cc3f689c0cc4b508b78d9bb5ee))
* resolve development environment issues ([61299a3](https://github.com/the-luap/picpeak/commit/61299a33c4f92730fe8b14f6035f61325d952b94))
* resolve duplicate logger declaration and syntax error in rate limit service ([0fe6d73](https://github.com/the-luap/picpeak/commit/0fe6d738b222555b27cbf8a36f455b1c15c4f4e8))
* resolve feedback validation issues from GitHub issue [#16](https://github.com/the-luap/picpeak/issues/16) ([f26beca](https://github.com/the-luap/picpeak/commit/f26becad1dfa72c62b6ecec491be025644426d67))
* resolve feedback validation issues from GitHub issue [#16](https://github.com/the-luap/picpeak/issues/16) ([67ff415](https://github.com/the-luap/picpeak/commit/67ff4158404347bc7c13dee5b4e13260eb0e743d))
* resolve GitHub issues [#4](https://github.com/the-luap/picpeak/issues/4), [#8](https://github.com/the-luap/picpeak/issues/8), [#9](https://github.com/the-luap/picpeak/issues/9), and [#10](https://github.com/the-luap/picpeak/issues/10) ([934d6dd](https://github.com/the-luap/picpeak/commit/934d6ddc5847f65db6371a4043b764f6d4cd6c8b))
* resolve GitHub mirror workflow cherry-pick failure with merge commits ([d6adde4](https://github.com/the-luap/picpeak/commit/d6adde4e093537aeecf8b190513a1171c3ecc82c))
* resolve language-specific column issues in core migrations ([62617f6](https://github.com/the-luap/picpeak/commit/62617f627f56aedd132fa20528b1d7c7e272c85c))
* resolve migration conflicts and duplicate numbering ([a401fbd](https://github.com/the-luap/picpeak/commit/a401fbdc54f30c18b5aa2440d7b6887ca12e00eb))
* resolve multiple feedback management issues ([ad75818](https://github.com/the-luap/picpeak/commit/ad758185666bf4ac52965f16d1c0e1e052887ac2))
* resolve multiple issues from GitHub issue [#14](https://github.com/the-luap/picpeak/issues/14) ([e91209f](https://github.com/the-luap/picpeak/commit/e91209f7cb38a5b840e74ed6acd8d490ef9d2294))
* resolve port configuration issues and database column mismatch ([6de64a1](https://github.com/the-luap/picpeak/commit/6de64a1df18932badd7bb1b9928d09e9477f0c3f))
* resolve PostgreSQL migration issues for development environment ([ee855a3](https://github.com/the-luap/picpeak/commit/ee855a3502ecd1a5556e378e9995de86e3548de1))
* resolve production UI and API issues ([d5790ad](https://github.com/the-luap/picpeak/commit/d5790ad635596842926a358753932e5c422590d6))
* resolve SIGPIPE error in GitHub mirror workflow file cleanup ([b7c8953](https://github.com/the-luap/picpeak/commit/b7c8953cb4d4a2541dcb38865c8a7beef0edf494))
* resolve translation interpolation issue for download button ([c1e10f1](https://github.com/the-luap/picpeak/commit/c1e10f14a30797c76169c2531de5d04976ee4888))
* **setup/native:** correct repo URL, paths, and systemd for native install; support sqlite in production knex config ([87b8414](https://github.com/the-luap/picpeak/commit/87b8414e449802db6dc9f762453f7672616b83c9))
* **setup/native:** Debian 12 compatibility (reliable RAM detection, sudo-less run_as_user, git safe.directory); ensure SQLite data dir; use user for migrate ([dc482e6](https://github.com/the-luap/picpeak/commit/dc482e614a5fbac44c6570d812669511301a4403))
* **setup/native:** handle forced updates safely by fetch+checkout/reset instead of pull; stable on rewritten histories ([3697344](https://github.com/the-luap/picpeak/commit/3697344cd0add28b4da71c3b33e2ccc0a96f50f9))
* **setup/update:** detect native installs first (/opt/picpeak/app/backend or systemd unit); avoid false docker updates on root ([adf576f](https://github.com/the-luap/picpeak/commit/adf576fbe17f40c13c1d77dd9751f2e9dbf523a1))
* simplify Drone github-release step to avoid shell parsing issues ([94f10e1](https://github.com/the-luap/picpeak/commit/94f10e164502e6848cd720ee5a5c2822abbde46f))
* stabilize uploads and guest feedback filters ([aaaf598](https://github.com/the-luap/picpeak/commit/aaaf59817b3978635d2282c006853e183ab944d4))
* update all deployment guide links in README.md ([6389b9d](https://github.com/the-luap/picpeak/commit/6389b9df3f616c09a9bbbf1a2988764b0c3aeb77))
* update deployment guide with critical URL configuration and nginx port fixes ([1cadce1](https://github.com/the-luap/picpeak/commit/1cadce196bb04a0575d83437618454d4ca5bcdac))
* update form-data and multer to address security vulnerabilities ([7750170](https://github.com/the-luap/picpeak/commit/7750170832dddf81a33c7c2409b37b0b7bc1f290))
* update Gitea mirror workflow to selectively remove scripts ([296430e](https://github.com/the-luap/picpeak/commit/296430e4d7e01a6be031dbb89dd25f563b163a97))
* update GitHub mirror action to support fine-grained personal access tokens ([827eb48](https://github.com/the-luap/picpeak/commit/827eb4819b7da6171d48613963d176399cad80c6))
* use admin API for Umami config in analytics page ([a54a2c0](https://github.com/the-luap/picpeak/commit/a54a2c0fdaa28193d1359da73bc7fb61476e2a58))
* use plugins/gitea-release for Drone CI/CD ([0c783c6](https://github.com/the-luap/picpeak/commit/0c783c66d0dfe8cb637f0db7349ae9637d7bf787))
* use plugins/github-release for Drone CI/CD ([f926cd3](https://github.com/the-luap/picpeak/commit/f926cd3adf513858bc7b291582c7ca2efdf93ff8))


### Documentation

* add minimum system requirements section to README ([4615a5d](https://github.com/the-luap/picpeak/commit/4615a5d795b415367edf4882628377936b29ab32))
* add PUID/PGID note for Docker bind mounts to avoid permission issues ([0178e71](https://github.com/the-luap/picpeak/commit/0178e71c67f198c6013ece52b0a2da0e2f1a6b2a))
* add transparency note about AI-assisted development ([35e360d](https://github.com/the-luap/picpeak/commit/35e360dcf7ac68833bec81f2e79f4a11a76a0e87))
* add warnings about $ character in Docker Compose passwords ([87d1761](https://github.com/the-luap/picpeak/commit/87d1761091bb97747821aa810a58f3978a59d08f))
* clarify VITE_API_URL usage; remove FRONTEND_API_URL; add storage vars; simplify compose mounts and external DB example (refs [#18](https://github.com/the-luap/picpeak/issues/18)) ([758c085](https://github.com/the-luap/picpeak/commit/758c085467e579e9f6b16df2298747fdddf2b205))
* **compose:** fix backend healthcheck path; remove frontend VITE_API_URL env and document /api proxy (refs [#18](https://github.com/the-luap/picpeak/issues/18)) ([ecbc488](https://github.com/the-luap/picpeak/commit/ecbc48815ded99a052ef057e69427c823cd34ece))
* fix deployment/admin routing and CORS guidance; add AGENTS.md; ignore AGENTS.md (refs [#18](https://github.com/the-luap/picpeak/issues/18)) ([dad1787](https://github.com/the-luap/picpeak/commit/dad1787aad8763637373e8eb87a47728d3d568cc))
* follow-up on PR [#15](https://github.com/the-luap/picpeak/issues/15) — clarify VITE_API_URL usage, compose mounts, and admin routing (refs [#15](https://github.com/the-luap/picpeak/issues/15)) ([e9171c7](https://github.com/the-luap/picpeak/commit/e9171c71159cb41b91a099621bd2d7a7985dd239))
* **readme:** reflect new External Media reference mode and update roadmap (gallery feedback status) ([ee13556](https://github.com/the-luap/picpeak/commit/ee13556c5cb4f24fe88e14fd00b821acf65b11cb))
* replace email addresses with GitHub issue links ([0c989ce](https://github.com/the-luap/picpeak/commit/0c989ce08699ce68b131a9cc4ba4f14e06e3d221))
* update deployment guide with GitHub Container Registry images ([2c9a56f](https://github.com/the-luap/picpeak/commit/2c9a56f217218f0700817d150b3de115e9503baa))


### Code Refactoring

* simplify deployment structure with direct port exposure ([6492cb9](https://github.com/the-luap/picpeak/commit/6492cb9ec8f8b811297aa71c153b9fe6a00e947a))

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
