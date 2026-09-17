# VELYXORA production runbook

This repository is prepared for a Vercel frontend and a Docker-based Railway API. Nothing in this document performs a deployment or DNS mutation.

## Data boundary

PostgreSQL is the system of record for users, sessions, plans, credits, payment orders, payments, processing usage/history, complaints, suggestions, audit logs, denied identities, and short links. Upload bytes, conversion outputs, in-memory jobs, and queue state are deliberately ephemeral during beta. A restart can invalidate an active job or download, but must not remove business records.

The beta file flow is `upload -> processing -> result -> download -> TTL cleanup`. `TEMP_DIR` and `STORAGE_DIR` must point to disposable container paths. Object storage, Redis, BullMQ, separate workers, Kubernetes, and complex autoscaling are postponed until post-beta.

## Railway

1. Create the API service from this repository using `Dockerfile`; add Railway PostgreSQL and expose its `DATABASE_URL` to the API.
2. Configure the production variables from `.env.example`. Railway supplies `PORT`; during the cross-site beta set `NODE_ENV=production`, `CORS_ORIGIN=https://velyxora.vercel.app`, `SESSION_COOKIE_SAME_SITE=none`, `TRUST_PROXY=true`, and a stable random `AUTH_PASSWORD_PEPPER`. After moving the frontend and API to `velyxora.com` subdomains, change the origin to `https://velyxora.com` and `SESSION_COOKIE_SAME_SITE=lax`.
3. Keep the pre-deploy command `npx prisma migrate deploy`, start command `node backend/dist/server.mjs`, and health path `/api/health` from `railway.json`.
4. Run `npm run db:seed` manually once if plans/admin are required. The seed is idempotent and does not rotate an existing admin password. Remove `INITIAL_ADMIN_PASSWORD` afterward.
5. Attach `api.velyxora.com` only after verification. Do not configure a persistent volume for temporary files.

## Vercel

1. Import the repository using its root, build command `npm run build:frontend`, and output directory `dist` (also encoded in `vercel.json`).
2. During beta set `VITE_API_URL=https://velyxora-production.up.railway.app/api` before building. After the custom-domain migration use `https://api.velyxora.com/api`. The SPA rewrite is provided by `vercel.json`.
3. Attach `velyxora.com`. Recommended canonical policy: redirect `www.velyxora.com` permanently to the apex. If `www` serves the SPA, add it to `CORS_ORIGIN`.

## Cloudflare DNS (manual, after services exist)

- Apex `velyxora.com`: use the exact Vercel DNS target shown for the project.
- `www`: configure the exact Vercel target and redirect permanently to the apex (recommended).
- `api`: CNAME to the exact Railway custom-domain target.
- Use Full (strict) TLS after both platforms issue certificates. Do not cache `/api/*` and do not redirect `api.velyxora.com`.

Provider targets can change, so copy the values displayed by Vercel and Railway rather than hardcoding example records.

## yt-dlp maintenance

The Docker image installs the official `yt-dlp` release pinned by `YT_DLP_VERSION` and `YT_DLP_SHA256` build arguments. The build verifies both checksum and reported version; runtime self-updates (`yt-dlp -U`) are intentionally disabled. When an extractor update is required, update the version and checksum together from the official release assets, rebuild the image, verify `/api/health` reports the expected `diagnostics.ytDlpVersion`, and test each affected allowlisted provider independently.

## Release checks

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:frontend`, `npm run build:backend`, `npx prisma validate`, `npx prisma generate`, `npx prisma migrate status`, and `git diff --check`. When Docker is available, build the image and test `/api/health` plus PostgreSQL, FFmpeg, FFprobe, LibreOffice, yt-dlp, media conversion, and Office conversion inside the container.
