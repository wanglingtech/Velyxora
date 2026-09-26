# Contributing to VELYXORA

Thanks for your interest in improving VELYXORA. This document describes how to
set up the project, the commands we expect you to run, and how to propose
changes.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Requirements

- **Node.js 22.x** (the version used by the Docker image and the intended
  runtime).
- **npm** — the package manager used by this documentation and by CI.
- **PostgreSQL** — required for authentication, persistence and server jobs.
- Optional native binaries for server-side tools:
  - **FFmpeg / FFprobe**
  - **LibreOffice** (headless `soffice`)
  - **yt-dlp**

## Installation

```bash
git clone https://github.com/wanglingtech/Velyxora.git
cd Velyxora
npm install
```

## Environment variables

Copy the example files and fill them in locally. Never commit real secrets.

- `.env.example` → `.env`
- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

Important variables include `DATABASE_URL`, `AUTH_PASSWORD_PEPPER`,
`MAX_UPLOAD_SIZE_MB`, `STORAGE_DIR`, `TEMP_DIR`, `FFMPEG_PATH`,
`FFPROBE_PATH`, `LIBREOFFICE_PATH`, `YT_DLP_PATH`, `CORS_ORIGIN` and
`SESSION_COOKIE_SAME_SITE`. The `.env.example` files list the authoritative set.

`AUTH_PASSWORD_PEPPER` must be a stable random value of at least 32 characters;
changing it invalidates existing password hashes.

## PostgreSQL local

Start a local PostgreSQL instance and create a database, for example:

```bash
createdb velyxora
```

Then set `DATABASE_URL` in `.env`:

```text
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/velyxora?schema=public
```

## Prisma

```bash
npm run db:generate   # generate Prisma Client (prisma generate)
npm run db:migrate    # apply tracked migrations (prisma migrate deploy)
npm run db:seed       # optional: seed initial/admin data
```

For schema changes during development, create a migration with the Prisma CLI
(`npx prisma migrate dev`) and commit the generated SQL under
`prisma/migrations/`. Migrations are tracked in version control and must not be
removed.

`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` are only used for the first
seed. Remove the password from your environment afterwards.

## Development

```bash
npm run dev            # unified frontend + backend on http://localhost:3000
npm run build:frontend # Vite build -> dist/
npm run build:backend  # prisma generate + esbuild backend bundle
npm run build          # full production build
npm start              # run the production build
```

## Typecheck, lint, tests and build

Run these before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

- `npm run typecheck` runs `tsc --noEmit`.
- `npm run lint` runs ESLint over `frontend/src`, `backend/src` and `server.ts`.
- `npm test` runs the backend and frontend test suites with Node's test runner.
  Some tests require PostgreSQL via `DATABASE_URL`; integration tests that need
  FFmpeg or LibreOffice skip themselves when the binary is missing.
- `npm run build` verifies the frontend and server bundles.

Do not disable or weaken tests to make a change pass.

## How to add a tool

Tools are defined in `frontend/src/registry/tools.ts`. The registry is the
single source of truth for the catalog.

1. **Add a definition** with a unique `id` and `slug`, a `category`, the
   `inputTypes`/`outputTypes`, and a `processingMode`:
   - `CLIENT_SIDE` — runs entirely in the browser.
   - `SERVER_SIDE` — requires backend execution and native binaries.
   - `HYBRID` — client-first with server processing where needed.
   - `EXTERNAL_PROVIDER` — resolves public data through an external provider.
2. **Reuse an existing runner.** `getToolRunnerKind(tool)` maps definitions to
   existing runners (`standard-file`, `pdf`, `qr`, `text`, etc.). Prefer
   extending an existing runner over creating a new one.
3. **Client-side tools** implement their engine under
   `frontend/src/services/` using browser APIs or existing dependencies.
4. **Server-side tools** must use the existing API contract:
   - upload: `POST /api/uploads`
   - start job: `POST /api/conversions`
   - poll: `GET /api/jobs/:id`
   - download: `GET /api/download/:fileId`

   Use `frontend/src/services/apiClient.ts` rather than ad-hoc `fetch` calls.

Do **not** invent endpoints, DTOs or provider behavior. If a genuinely new API
is required, describe it clearly in the pull request, implement it in the
existing controller/service/engine structure, and add tests.

A tool without a real runner must not be exposed: keep `public: false` in the
registry until the implementation exists.

## Pull requests

1. Create a focused branch from the default branch.
2. Keep the change small and scoped to one purpose.
3. Add or update tests for the behavior you change.
4. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and
   `git diff --check`.
5. Write a clear description: what changed, why, and how it was verified.
6. Include screenshots or a short recording when the change affects the UI.
7. Ensure the change contains **no secrets** and does not reintroduce retired
   commercial features (credits, plans, payment orders, payment gating).

All pull requests are subject to review and acceptance by the maintainer.
Opening a pull request does not guarantee it will be merged.

There is currently no required CLA. Do not add one unless a real need is
identified.
