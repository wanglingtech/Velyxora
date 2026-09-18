# VELYXORA production runbook

This repository is prepared for a Vercel frontend and a Docker-based Railway API. Nothing in this document performs a deployment or DNS mutation.

## Data boundary

PostgreSQL is the system of record for users, sessions, plans, credits, payment orders, payments, processing usage/history, complaints, suggestions, audit logs, denied identities, and short links. Upload bytes, conversion outputs, in-memory jobs, and queue state are deliberately ephemeral during beta. A restart can invalidate an active job or download, but must not remove business records.

The beta file flow is `upload -> processing -> result -> download -> TTL cleanup`. `TEMP_DIR` and `STORAGE_DIR` must point to disposable container paths. Object storage, Redis, BullMQ, separate workers, Kubernetes, and complex autoscaling are postponed until post-beta.

## Railway

1. Create the API service from this repository using `Dockerfile`; add Railway PostgreSQL and expose its `DATABASE_URL` to the API.
2. Configure the production variables from `.env.example`. Railway supplies `PORT`; during the cross-site beta set `NODE_ENV=production`, `CORS_ORIGIN=https://velyxora.vercel.app`, `SESSION_COOKIE_SAME_SITE=none`, `TRUST_PROXY=true`, and a stable random `AUTH_PASSWORD_PEPPER`. After moving the frontend and API to `velyxora.com` subdomains, change the origin to `https://velyxora.com` and `SESSION_COOKIE_SAME_SITE=lax`.
   For payment contact, set optional `WHATSAPP_ADMIN_PHONE_E164` to the public destination in strict E.164 form (leading `+`, country code and 8–15 total digits, for example `+51968555200`). It is separate from `YAPE_PHONE`; invalid non-empty configuration stops startup instead of producing a broken link.
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

## Share Layer checks

Share no necesita variables de entorno, permisos backend ni cambios de despliegue. Debe validarse en HTTPS y en los navegadores/SO objetivo porque Web Share y el soporte de tipos de archivo varían. La revisión manual debe cubrir: share sheet disponible, `canShare` negativo, navegador sin Web Share, cancelación, fallback de descarga/copia y portapapeles bloqueado. VELYXORA no controla ni registra el destino elegido por el usuario y no publica directamente en redes sociales.

## WhatsApp payment contact checks

Con una cuenta de prueba, cree una orden y compruebe sin enviar mensajes que `PENDING_PAYMENT` muestra “Consultar por WhatsApp”, que después de registrar los nueve dígitos `PENDING_REVIEW` muestra “Contactar por WhatsApp” y que estados terminales no muestran la acción. Inspeccione la URL `wa.me`: debe contener el número sin `+`, espacios ni separadores y un parámetro `text` codificado. El mensaje solo debe contener plan, monto/moneda, email, ID y, cuando corresponda, reference. El usuario controla el envío; WhatsApp/Meta procesa los datos cuando decide continuar. Esta fase no usa Cloud API ni sustituye la revisión administrativa.

## Sticker Maker manual checks

- Desktop Chrome/Edge: cargar PNG, JPEG y WebP; probar imagen vertical, horizontal y cuadrada; arrastrar, cambiar zoom, restablecer, generar y descargar.
- Transparencia: verificar un PNG con alpha sobre el tablero del editor y en el WebP descargado.
- Compresión: confirmar 512×512, MIME WebP, tamaño mostrado y señalización honesta cuando supera 100 KB.
- Móvil: probar viewport estrecho, Pointer Events táctiles, scroll fuera del canvas, preview y Compartir cuando Web Share admite archivos.
- Share: probar `navigator.canShare` positivo y negativo; el negativo debe descargar. No es necesario enviar ni instalar el archivo en WhatsApp.

No requiere variables, backend ni despliegue especial. Los límites cliente son 15 MiB, 8192 px por lado y 40 MP. La compatibilidad WebP/Share depende del navegador objetivo; background removal, borde de silueta, animación y packs quedan fuera del MVP.
