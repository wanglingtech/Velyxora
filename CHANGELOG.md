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

### Added

- Voluntary support options configured in `frontend/src/config/supportMethods.ts`.
  Support is strictly optional and never unlocks features or credits.
- Voluntary support prompt in the application shell.
- Community health and documentation files: `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `SUPPORT.md`, GitHub issue/PR templates
  and a CI workflow.

### Fixed

- Improved responsive shell behavior across viewport sizes.
- Modal/FAB interaction support in the shell.

### Notes

- No public release, tag or GitHub Release has been created.
- Historical commercial features are documented as retired; see `docs/` for
  engineering history.
