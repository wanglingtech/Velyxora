# Webpage capture (`/webpage-capture`)

Status: `COMPLETE` for public pages that render without authentication.

The tool turns a public URL into a real, fully rendered page image and lets the
user export PNG/JPG/WebP screens or a PDF. Rendering happens on the server with
a headless Chrome instance controlled over the DevTools Protocol (CDP), so
JavaScript-driven pages are captured as a browser would show them.

## Flow

1. The user enters a URL and clicks **Cargar página**.
2. `POST /api/webpage/snapshot` fetches and sanitizes the HTML. This is used for
   metadata and as a fallback; it is not the preview.
3. `POST /api/webpage/capture` renders the page in headless Chrome and returns
   one full-page PNG.
4. The frontend shows that PNG as the preview. The user can drag a rectangle to
   keep only the area they need.
5. **Generar capturas** slices the PNG into vertical segments
   (`CAPTURE_SEGMENT_HEIGHT = 1400` px, `MAX_CAPTURE_SEGMENTS = 24`). If a crop
   is active, the crop is applied first and each segment is offset by the
   crop's `y` so the exported images match the selection.
6. The user selects which segments to download as individual images or a ZIP,
   or exports the selection as a PDF.

The preview blob is reused for the capture when the preview width and scale
match the requested capture settings, avoiding a second Chrome launch.

## Backend

- `backend/src/services/browserCaptureService.ts`
  - Launches Chrome/Edge with an isolated temporary profile and a fixed
    viewport width.
  - Attaches `Network.*` listeners **before** `Page.navigate`.
  - Waits for network idle (`idleMs: 900`, `minWaitMs: 2500`, timeout 20 s)
    instead of the `load` event: ad-heavy pages fire `load` late and pages with
    async data still show skeletons at that point. A second short idle pass
    (`idleMs: 500`, timeout 4 s) settles lazy content before the screenshot.
  - `waitForStableLayout` waits for two identical layout measurements.
  - Validates every request the page attempts against the SSRF guard.
  - Geometry is clamped to 320–2400 CSS px wide and 16 000 px tall, and to
    4000 × 16 000 device pixels.
  - Browser shutdown is synchronous; the temporary profile is deleted in the
    background on `process.exit` so the HTTP response is not blocked on
    Windows.
- `backend/src/services/webpageSnapshotService.ts`
  - `sanitizeSnapshotHtml` removes `<script>` and `<noscript>` elements as
    defense in depth. The preview no longer renders sanitized HTML in an
    iframe, which also removed the `about:srcdoc` console/CORS errors.
- `backend/src/controllers/webpageController.ts` and
  `backend/src/routes/webpage.routes.ts`
  - `GET /api/webpage/capabilities`
  - `POST /api/webpage/snapshot`
  - `POST /api/webpage/capture`
- `backend/src/security/routeLimits.ts` applies `webpageCaptureLimit`.

## Frontend

- `frontend/src/components/views/WebpageCaptureView.tsx` owns the preview,
  drag-to-crop state (`crop`, `draftCrop`), capture settings and exports.
- `frontend/src/services/webpageCaptureService.ts`
  - `resolveCaptureRegion(pageWidth, pageHeight, crop)` is a pure function that
    clamps the selection to the page and returns the effective region.
  - `sliceCapturedImage` applies the crop before slicing.
  - `computeCaptureSegments`, `isMostlyBlankPixels` and `captureFilename`
    handle segmentation, blank-page skipping and file naming.
- The crop is stored in page CSS pixels; the overlay is positioned with
  percentages. Selections smaller than 8 px are ignored.

## Verification

```bash
npm run typecheck
npm run lint
npm test
```

Relevant tests:

- `frontend/test/webpageCapture.test.ts`: region resolution, segmentation,
  blank detection and file names.
- `backend/test/webpageSnapshot.test.ts`: snapshot sanitization.

Manual check: open `/webpage-capture` while logged in, load a public page,
confirm the preview shows real content, drag a crop, generate screens, and
verify each segment reports the cropped `width × height` and downloads as an
image or PDF.
