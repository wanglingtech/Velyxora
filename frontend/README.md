# VELYXORA — Frontend Architecture

VELYXORA Frontend is a high-speed, accessible (WCAG 2.2 AA), client-first universal conversion and media manipulation workstation built with React 19, Vite, Tailwind CSS v4, and Lucide icons.

## Key Capabilities

- **Implemented client processing**:
  - Browser image, text/data, QR/barcode and Web Audio paths exposed by the current tool runners.
  - Real PDF generation in `src/services/pdfEngine.ts` for JPG, PNG, WebP (browser decode), text wrapping and pagination.
  - Local favorites, history and settings storage.
- **Hybrid integration**:
  - `apiClient.ts` centralizes timeout, JSON, HTTP and unavailable-backend errors.
  - Media analysis calls `POST /api/media/analyze`; direct stream extraction is not implemented in this phase.
  - Server-dependent tools show an explicit backend/engine requirement.
- **Performance & Mobile Ergonomics**:
  - Zero heavy unrequested bundles loaded on home.
  - Respects `prefers-reduced-motion`.
  - Responsive layouts audited for 320px up to 4K displays.
  - Strict touch target compliance (>= 44px).
  - Automatic `URL.revokeObjectURL` cleanup to eliminate memory leaks.

## Local Development (VS Code)

```bash
npm install
npm run dev
```

From the root, Vite uses `vite.config.ts` and serves the `frontend/` directory. Standalone frontend commands remain available from this directory, but the unified development command is `npm run dev` at the root.
