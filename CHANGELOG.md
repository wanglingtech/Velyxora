# Changelog

All notable changes to VELYXORA are documented in this file.

This project has **not yet published a formal release**. Entries under
`[Unreleased]` describe verifiable changes on the default branch and do not
represent a tagged or published release.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **Open-source preparation**: the repository license moved from a proprietary
  "All Rights Reserved" license to the standard GNU Affero General Public
  License v3.0 (`AGPL-3.0-only`).
- Server processing is **free**: plan/credit-based runtime protection was
  replaced by technical fair-use limits in `backend/src/config/freeServiceLimits.ts`.
- Removed the legacy credits and payment runtime (plans, ledger, payment
  orders, manual review artifacts) from the application and database schema.
- Added service status controls.
- CI now installs with `npm ci` and the committed root `package-lock.json`,
  matching the documented package manager instead of the unused pnpm setup.
- The frontend imports only the icons it uses through
  `frontend/src/components/common/iconMap.ts`. The previous namespace import
  pulled every Lucide icon into the main bundle (about 850 kB); vendor chunks
  are now split in `vite.config.ts`.

### Added

- Voluntary support options configured in `frontend/src/config/supportMethods.ts`.
  Support is strictly optional and never unlocks features or credits.
- Voluntary support prompt in the application shell.
- Community health and documentation files: `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `SUPPORT.md`, GitHub issue/PR templates
  and a CI workflow.
- Webpage capture (`/webpage-capture`) renders public pages in headless Chrome,
  shows the real full-page preview, supports drag-to-select area, and exports
  PNG/JPG/WebP screens or a PDF. See `docs/markdown/WEBPAGE_CAPTURE.md`.

### Fixed

- Improved responsive shell behavior across viewport sizes.
- Modal/FAB interaction support in the shell.
- **Login race condition:** `login()` and `register()` reused the session
  restore requested at mount (deduplicated in `apiClient`), so submitting the
  form while that unauthenticated `/api/auth/me` was still in flight returned
  401 and discarded the new session. Login/register now use the user returned
  by their own response and invalidate the cached `/auth/me`; a late 401 from
  the mount-time restore can no longer overwrite a newer session.
- Rate limiting no longer applies to HTML pages and static assets, which used
  to exhaust the API budget and return 429 during normal navigation.
- Webpage capture waits for network idle before screenshotting, so
  JavaScript-driven pages render fully instead of showing skeletons. The
  sanitized snapshot no longer strips visible content needed by the preview,
  and no iframe is used, eliminating the `about:srcdoc` console/CORS errors.
- Cleared all ESLint warnings; `npm run lint` now reports zero problems.
- Removed unused imports and state that produced TypeScript/ESLint noise, and
  fixed the password generator effect and the URL paste handler dependencies.

### Notes

- No public release, tag or GitHub Release has been created.
- Historical commercial features are documented as retired; see `docs/` for
  engineering history.
