# VELYXORA — Tool Implementation Status Matrix

## Fase Auth + PostgreSQL + Credits + Admin Beta

| Área | Estado | Nota |
|---|---|---|
| Schema/migración PostgreSQL | `PARTIAL` | Prisma valida; no aplicada por falta de DATABASE_URL |
| Auth/sesión/roles/CSRF | `PARTIAL` | implementado; E2E DB pendiente |
| Créditos/ledger/jobs | `PARTIAL` | lifecycle transaccional; E2E DB pendiente |
| Admin/UI de cuenta | `PARTIAL` | rutas/vistas; prueba visual pendiente |
| Yape manual | `BETA_MANUAL` | sin verificación automática |
| PaymentProvider | `REQUIRES_EXTERNAL_PROVIDER` | contrato futuro, sin simulación |
| Privacy/Terms | `LEGAL_REVIEW_REQUIRED` | borradores actualizados |

## Fase LibreOffice + UX funcional (2026-09-13)

| Área | Estado | Evidencia/limitación |
| :-- | :-- | :-- |
| DOCX → PDF | `COMPLETE` | LibreOffice 26.8.0.3, prueba real y validación PDF |
| XLSX/PPTX → PDF | `COMPLETE` | upload, job, LibreOffice, validación y descarga PDF probados realmente |
| ODT/ODS/ODP → PDF | `PARTIAL` | herramientas públicas y motor disponibles; formatos no ejecutados E2E |
| Cancelación/timeout/cleanup | `COMPLETE` | AbortSignal, límite configurable, perfil aislado por job y limpieza final |
| Historial local | `COMPLETE` | repositorio versionado, ciclo terminal central, filtros y borrado |
| Preferencias locales | `COMPLETE` | validación, update/reset, saveHistory, confirmación y movimiento reducido |
| Persistencia en cuenta/DB | `NOT_IMPLEMENTED` | fuera de alcance hasta autenticación |

El catálogo contiene 65 definiciones y publica 55 herramientas utilizables. Diez definiciones internas se excluyen explícitamente con `public: false` hasta contar con runner real: `image-cropper`, `audio-channel-converter`, `audio-format-converter`, `base64-text-converter`, `url-encoder-decoder`, `regex-tester`, `line-cleaner-sorter`, `slug-generator`, `media-url-analyzer` (la vista dedicada sigue disponible en navegación) y `merge-pdf`.

La clasificación conservadora herramienta por herramienta de este cierre está en `FINAL_PRE_AUTH_AUDIT.md`; sustituye las afirmaciones históricas no respaldadas por una ejecución actual que aparecen más abajo en este documento.


## FFmpeg closure status

This section supersedes older FFmpeg rows below. Every `COMPLETE` row is visible in the registry and has a real HTTP integration path covering upload, job, FFmpeg, FFprobe, completed output, attachment download and cleanup.

| Tool | UI | API/engine | FFprobe/download test | Status |
| :-- | :--: | :--: | :--: | :-- |
| Video → MP3 | Yes | Yes | Yes | `COMPLETE` |
| Video → WAV | Yes | Yes | Yes | `COMPLETE` |
| Video → GIF | Yes | Yes | Yes | `COMPLETE` |
| Recortar video | Yes | Yes | Yes | `COMPLETE` |
| Silenciar video | Yes | Yes | Yes | `COMPLETE` |
| Cambiar velocidad de video | Yes | Yes | Yes | `COMPLETE` |
| Comprimir video | Yes | Yes | Yes | `COMPLETE` |
| Cambiar resolución de video | Yes | Yes | Yes | `COMPLETE` |
| MP4 → WebM | Yes | Yes | Yes | `COMPLETE` |
| WebM → MP4 | Yes | Yes | Yes | `COMPLETE` |
| WAV → MP3 | Yes | Yes | Yes | `COMPLETE` |
| MP3 → WAV | Yes | Yes | Yes | `COMPLETE` |
| Cambiar bitrate de audio | Yes | Yes | Yes | `COMPLETE` |
| Normalizar volumen | Yes | Yes | Yes | `COMPLETE` |
| Unir audios | No | No multi-input DTO | No | `NOT_IMPLEMENTED` |

Audio merge remains unimplemented because the current job contract owns one uploaded input. A correct implementation requires ordered multi-upload ownership, normalization/concat and atomic cleanup; byte concatenation is explicitly not acceptable.

### Human UI checklist

No manual UI pass is claimed until a human or controllable browser completes this checklist.

| Tool | Upload | Processing | Result | Download | File opens | Final state |
| :-- | :--: | :--: | :--: | :--: | :--: | :--: |
| Video → MP3 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Video → WAV | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Video → GIF | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Recortar video | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Silenciar video | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Cambiar velocidad | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Comprimir video | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| WAV → MP3 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| MP3 → WAV | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Cambiar bitrate | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Normalizar volumen | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

This document tracks the implementation status of the tools represented by the current registry. Statuses are based on checked-in code, not on former AI Studio claims. FFmpeg 9.0.1 integration is now exercised with generated media fixtures and FFprobe validation. Capabilities mentioned below that are not present in `frontend/src/registry/tools.ts` are engine capabilities, not visible tools.

Phase 2B fixed the shared result-delivery defect: client jobs now download their real Blob through `downloadService`, while backend jobs return `output.fileId` and download through `GET /api/download/:fileId`. Tools still requiring unavailable host binaries remain `BACKEND_READY`/`REQUIRES_EXTERNAL_ENGINE`, not complete.

### Status Definitions

- `COMPLETE`: Fully implemented and verified working without simulated stubs or fake data.
- `PARTIAL`: Core features operational; advanced parameters or edge cases pending expansion.
- `BACKEND_READY`: Backend controller, schema, validation and engine integration exist; host-engine end-to-end verification is still pending.
- `REQUIRES_EXTERNAL_ENGINE`: Backend architecture, integration contract, and CLI commands fully prepared, but requires an external host package (such as LibreOffice or yt-dlp) to execute.
- `NOT_IMPLEMENTED`: Architectural placeholder; implementation scheduled for subsequent phase.

---

| Tool                             | Category         | Processing Mode | Engine                  | Status                     | Frontend         | Backend          | Tested         | Notes                                                                                           |
| :------------------------------- | :--------------- | :-------------- | :---------------------- | :------------------------- | :--------------- | :--------------- | :------------- | :---------------------------------------------------------------------------------------------- |
| **PNG to WebP**                  | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Native Canvas Blob encoding with quality control                                                |
| **JPG to PNG**                   | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Lossless 2D canvas extraction                                                                   |
| **Image Compressor**             | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Stepwise JPEG/WebP compression with size diffing                                                |
| **Image Resizer**                | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Pixel & percentage scaling with aspect ratio lock                                               |
| **Crop Image**                   | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | 1:1, 4:3, 16:9, and custom rectangular crop                                                     |
| **Image Watermark**              | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | 5-quadrant placement, opacity, and custom text                                                  |
| **Image Filters**                | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Real-time CSS canvas brightness, contrast, sepia                                                |
| **Color Palette Extractor**      | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Pixel color clustering with HEX/RGB copying                                                     |
| **Image to Base64**              | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Generates data URI, HTML `<img>`, and CSS background                                            |
| **SVG to PNG**                   | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | High-DPI rasterization (1x, 2x, 4x, 8x)                                                         |
| **SVG to JPG**                   | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Solid background rendering with JPEG compression                                                |
| **Favicon Generator**            | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Exports 16x16, 32x32, 48x48, and 180x180 ZIP package                                            |
| **EXIF Data Viewer**             | image            | CLIENT_SIDE     | browser-canvas          | `PARTIAL`                  | Yes              | N/A              | Yes            | Reads file header metadata; advanced EXIF tags in queue                                         |
| **EXIF Remover**                 | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Strips metadata via raw canvas repainting                                                       |
| **Social Media Image Resizer**   | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Presets for Instagram, Twitter, YouTube, LinkedIn                                               |
| **Rotate & Flip Image**          | image            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | 90°/180° rotation and horizontal/vertical mirroring                                             |
| **Images to PDF**                | pdf              | CLIENT_SIDE     | pdf-lib/browser-canvas  | `COMPLETE`                 | Yes              | N/A              | Yes            | Real PDF Blob, JPG/PNG/WebP path, page size, orientation, margins and aspect-ratio preservation |
| **Text to PDF**                  | pdf              | CLIENT_SIDE     | pdf-lib                 | `COMPLETE`                 | Yes              | N/A              | Yes            | Real PDF Blob with wrapping, line breaks and automatic pagination                               |
| **Merge PDF**                    | pdf              | SERVER_SIDE     | server-libreoffice      | `NOT_IMPLEMENTED`          | Registry only    | No verified flow | No             | No complete runner/engine flow in the current frontend                                          |
| **Split PDF**                    | pdf              | SERVER_SIDE     | server-libreoffice      | `NOT_IMPLEMENTED`          | No verified flow | No verified flow | No             | No complete runner/engine flow in the current frontend                                          |
| **PDF to Images**                | pdf              | SERVER_SIDE     | server-ffmpeg           | `REQUIRES_EXTERNAL_ENGINE` | No verified flow | Engine only      | No             | Requires a real PDF rasterization pipeline and host validation                                  |
| **Video to MP3**                 | video            | SERVER_SIDE     | server-ffmpeg           | `COMPLETE`                 | Yes              | Yes              | Real E2E       | MP4 upload → job → libmp3lame → FFprobe MP3 validation → HTTP attachment download               |
| **Video to WAV**                 | video            | CLIENT_SIDE     | browser-webaudio        | `COMPLETE`                 | Yes              | Yes              | Yes            | Client Web Audio API PCM decoder + backend fallback                                             |
| **Video Trimmer**                | video            | HYBRID          | server-ffmpeg           | `BACKEND_READY`            | Yes              | Yes              | Yes            | Backend `-ss` and `-t` sub-second trimming                                                      |
| **Video Compressor**             | video            | SERVER_SIDE     | server-ffmpeg           | `PARTIAL`                  | Yes              | Yes              | Engine fixture | H.264/AAC and quality-to-CRF verified; dedicated successful HTTP download test remains pending   |
| **Video to GIF**                 | engine only      | SERVER_SIDE     | server-ffmpeg           | `PARTIAL`                  | Not registered   | Yes              | Real fixture   | Palettegen/paletteuse output validated as GIF at 320×240; no visible registered tool             |
| **Remove Audio from Video**      | engine only      | SERVER_SIDE     | server-ffmpeg           | `PARTIAL`                  | Not registered   | Yes              | Real fixture   | `-an` output verified by FFprobe to contain no audio stream                                      |
| **Video Speed Changer**          | engine only      | SERVER_SIDE     | server-ffmpeg           | `PARTIAL`                  | Not registered   | Yes              | Real fixture   | `setpts` + chained `atempo`; 2× fixture duration verified, no visible registered tool            |
| **Video Metadata Inspector**     | video            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Extracts duration, resolution, aspect ratio, bitrate                                            |
| **Extract Frames from Video**    | video            | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Canvas snapshot capture with PNG export                                                         |
| **Audio Trimmer**                | audio            | CLIENT_SIDE     | browser-webaudio        | `COMPLETE`                 | Yes              | Yes              | Yes            | Web Audio PCM slice and WAV re-encoder                                                          |
| **Audio Joiner / Merger**        | audio            | —               | —                       | `NOT_IMPLEMENTED`          | Not registered   | No               | No             | No multi-input DTO or concat pipeline exists                                                    |
| **Volume Booster / Normalizer**  | audio            | CLIENT_SIDE     | browser-webaudio        | `COMPLETE`                 | Yes              | N/A              | Yes            | Web Audio GainNode dynamic range scaling                                                        |
| **Reverse Audio**                | audio            | CLIENT_SIDE     | browser-webaudio        | `COMPLETE`                 | Yes              | N/A              | Yes            | AudioBuffer channel reversing in browser memory                                                 |
| **Audio Bitrate Converter**      | engine capability| SERVER_SIDE     | server-ffmpeg           | `PARTIAL`                  | Shared runner    | Yes              | Real fixture   | 128/192 kbps arguments exercised; standalone registered tool absent                             |
| **WAV to MP3**                   | audio            | SERVER_SIDE     | server-ffmpeg           | `PARTIAL`                  | Shared runner    | Yes              | Real fixture   | libmp3lame and FFprobe validation pass; per-direction HTTP download test pending                 |
| **MP3 to WAV**                   | audio            | SERVER_SIDE     | server-ffmpeg           | `PARTIAL`                  | Shared runner    | Yes              | Real fixture   | PCM s16le and FFprobe validation pass; per-direction HTTP download test pending                 |
| **DOCX to PDF**                  | documents        | SERVER_SIDE     | server-libreoffice      | `REQUIRES_EXTERNAL_ENGINE` | Yes              | Yes              | No             | Backend CLI prepared; requires headless LibreOffice                                             |
| **PPTX to PDF**                  | documents        | SERVER_SIDE     | server-libreoffice      | `REQUIRES_EXTERNAL_ENGINE` | Yes              | Yes              | No             | Backend CLI prepared; requires headless LibreOffice                                             |
| **XLSX to PDF**                  | documents        | SERVER_SIDE     | server-libreoffice      | `REQUIRES_EXTERNAL_ENGINE` | Yes              | Yes              | No             | Backend CLI prepared; requires headless LibreOffice                                             |
| **CSV to JSON**                  | data             | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | RFC 4180 parser with type auto-detection                                                        |
| **JSON to CSV**                  | data             | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Flattens JSON arrays with delimiter escape                                                      |
| **Markdown to HTML**             | data             | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Real-time live renderer with syntax output                                                      |
| **Diff Checker**                 | data             | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Word and line-level colored differential viewer                                                 |
| **JSON Formatter & Validator**   | developer        | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Syntax validation, indent adjustment, and minifying                                             |
| **JWT Decoder**                  | developer        | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Base64URL parsing with expiration & claims inspection                                           |
| **Hash Generator**               | developer        | CLIENT_SIDE     | browser-crypto          | `COMPLETE`                 | Yes              | N/A              | Yes            | Web Crypto API SHA-256, SHA-384, SHA-512, SHA-1                                                 |
| **UUID Generator**               | developer        | CLIENT_SIDE     | browser-crypto          | `COMPLETE`                 | Yes              | N/A              | Yes            | RFC 4122 v4 UUID generator via crypto.randomUUID()                                              |
| **Password Generator**           | developer        | CLIENT_SIDE     | browser-crypto          | `COMPLETE`                 | Yes              | N/A              | Yes            | Cryptographically secure CSPRNG password builder                                                |
| **QR Code Generator**            | qr-barcode       | CLIENT_SIDE     | browser-qrcode          | `COMPLETE`                 | Yes              | N/A              | Yes            | Text, URL, WiFi, Email with custom color palette                                                |
| **Barcode Generator**            | qr-barcode       | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Code 128 barcode Canvas generator with PNG export                                               |
| **Aspect Ratio Calculator**      | utilities        | CLIENT_SIDE     | browser-canvas          | `COMPLETE`                 | Yes              | N/A              | Yes            | Proportional dimension calculation with visual preview                                          |
| **Epoch Timestamp Converter**    | utilities        | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Unix epoch to ISO 8601 & human local date                                                       |
| **Digital Storage Converter**    | utilities        | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Dual calculation: binary (1024) vs metric (1000)                                                |
| **Color Model Converter**        | utilities        | CLIENT_SIDE     | browser-text            | `COMPLETE`                 | Yes              | N/A              | Yes            | Converts between HEX, RGB, HSL, and CMYK models                                                 |
| **Media Downloader (YouTube)**   | media-downloader | HYBRID          | backend provider/oEmbed | `PARTIAL`                  | Yes              | Yes              | API error path | Real backend metadata path; direct stream requires yt-dlp                                       |
| **Media Downloader (Vimeo)**     | media-downloader | HYBRID          | server-ytdlp            | `PARTIAL`                  | Yes              | Yes              | Yes            | Real oEmbed metadata & official iframe player                                                   |
| **Media Downloader (TikTok)**    | media-downloader | HYBRID          | server-ytdlp            | `PARTIAL`                  | Yes              | Yes              | Yes            | Real oEmbed metadata extraction                                                                 |
| **Media Downloader (Reddit)**    | media-downloader | HYBRID          | server-ytdlp            | `PARTIAL`                  | Yes              | Yes              | Yes            | Post metadata & embed extraction                                                                |
| **Media Downloader (Twitter/X)** | media-downloader | HYBRID          | server-ytdlp            | `PARTIAL`                  | Yes              | Yes              | Yes            | Tweet oEmbed metadata extraction                                                                |
# Fase yt-dlp

- `COMPLETE`: registry desacoplado, nueve providers de primer nivel y GenericProvider; DTO normalizado; validación SSRF; jobs, cancelación, timeout, cleanup, FFmpeg/FFprobe y descarga por ID opaco; UI y términos.
- `EXTERNAL_DEPENDENCY`: análisis y descarga requieren que `YT_DLP_PATH` resuelva un binario yt-dlp operativo.
- `PARTIAL`: compatibilidad externa por proveedor; depende de cambios de cada plataforma y debe validarse periódicamente con contenido público autorizado.
