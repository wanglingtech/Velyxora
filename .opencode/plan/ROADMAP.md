# VELYXORA — ROADMAP TÉCNICO (Copiar a .opencode/plan/ROADMAP.md)

> **Versión:** 2.0
> **Fecha:** 2026-11-20
> **Estado:** FASE 0 ✅ completa — FASE 1 pendiente
> **Fuente única:** Este archivo + `.opencode/plan/ROADMAP.md` (sync manual)

---

## 🎯 VISIÓN GENERAL

VELYXORA evoluciona hacia un **toolkit 100% local-first** donde:
- **FFmpeg WASM** elimina la dependencia de Railway para video/audio/imagen
- **Historial de procesamiento REMOVIDO** (simplificación UX + privacidad)
- **Railway = opcional** solo para: yt-dlp downloads + LibreOffice (docs)
- **Vercel = static hosting** con banner mantenimiento para tools server-side
- **Expansión continua** de herramientas client-side (imágenes, PDF, datos, utils)

---

## 📋 FASE 0: FOUNDATION (Crítica — Bloqueante Local) — ✅ COMPLETA

**Objetivo:** Login funcional en `localhost:3000` + auth race condition fix

| Subfase | Tarea | Archivos | Estado |
|---------|-------|----------|--------|
| 0.1 | Redirect `127.0.0.1:3000` → `localhost:3000` en `server.ts` | `server.ts` | ✅ Hecho |
| 0.2 | Eliminar `invalidate('auth:me')` en `login/register` (race condition) | `frontend/src/services/apiClient.ts` | ✅ Hecho |
| 0.3 | Verificar cookies `SameSite=Lax` en dev, `None;Secure` en prod | `backend/src/config/env.ts` | ✅ Verificado |
| 0.4 | Test login completo: register → login → reload → sesión persiste | Manual (curl) | ✅ Verificado |

**Resultado:** Register/login/reload/logout OK. `Set-Cookie: ...; HttpOnly; SameSite=Lax` (dev). Redirect 301 de `127.0.0.1` → `localhost` (API y página).

---

## 📋 FASE 1: MAINTENANCE BANNER + VERCEL READY + HISTORY REMOVAL

**Objetivo:** Prod con UX clara de mantenimiento, Vercel deploy estático, **historial eliminado**

### 1.1 Tool Registry: `requiredServices` + Limpieza — ✅ COMPLETA (1.1.4 diferida a 1.4)

| Subfase | Tarea | Archivos | Estado |
|---------|-------|----------|--------|
| 1.1.1 | Agregar `requiredServices?: ('ffmpeg'|'libreOffice'|'ytDlp')[]` a `ToolDefinition` | `frontend/src/types.ts` | ✅ Hecho |
| 1.1.2 | Poblar `requiredServices` en todas las tools `requiresServer: true` | `frontend/src/registry/tools.ts` | ✅ Hecho (15 ffmpeg, 6 libreOffice, 1 ytDlp) |
| 1.1.3 | Eliminar `EXTERNAL_PROVIDER` de `ProcessingMode` type (no se usa) | `frontend/src/types.ts` | ✅ Hecho |
| 1.1.4 | Eliminar `HistoryItem.processingLocation` y campos legacy | `frontend/src/types.ts` | ⏭️ Diferido a 1.4 |

> **Nota 1.1.4:** los campos `processingLocation`/`outputFileId`/`completedAt` de `HistoryItem` solo se consumen en `historyService.ts`, `jobService.ts`, `HistoryView.tsx` y `StickerMakerTool.tsx` — todos eliminados/editados en FASE 1.4. Se eliminan junto con el módulo de historial para evitar doble trabajo y mantener el build verde.
> **Nota `url-shortener`:** `requiresServer: true` pero `engine: 'velyxora-links'` (no ffmpeg/libreOffice/ytDlp) → sin `requiredServices`; el gating genérico de backend en 1.3 lo cubre.

### 1.2 Maintenance Badge en UI (ToolCard, CategoryView, HomeView) — ✅ COMPLETA

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 1.2.1 | `ToolCard`: badge "Mantenimiento" + botón disabled si servicio caído | `frontend/src/components/common/ToolCard.tsx` |
| 1.2.2 | `CategoryView`: filtrado visual + tooltip explicativo | `frontend/src/components/views/CategoryView.tsx` |
| 1.2.3 | `HomeView`: popular tools con estado mantenimiento | `frontend/src/components/views/HomeView.tsx` |
| 1.2.4 | Implementar conversión de imagenes de webp a png/jpg y todos los formatos que se conviertan entre si |
| 1.2.5 | Implementar descargar por url de imagenes con previsualización y en cualquier formato al igual que se descargar un video|
| 1.2.6 | En el buscador de herramientas y formatos no salen todas las herramientas disponibles corregir y ajustar|
| 1.2.7 | Implementar un modulo aparte para descargar masiva por url de imageens al seleccionar una opcion con multiples formatos que se deseee y la previsualización de cada imagem que se va agregando para la descarga masiva de imagenes y también que se pueda seleccionar un formato individual de ser pertinente o uno predeterminado para la descargar de imagenes masiva o eliminar, tener presenta la previsualización de cada una de ellas para mejorar el modulo.|
| 1.2.8 | Quiero agregar la opcion de poder crear en base el formato de html osea ponemos una url y en el navegador se muestra un html, entoncs todo referente a ello se puede obtener ya sea todo el html en imagenes en varias y su formato puede ser diferentes como webp, png, jpg y etc y a la ves también que se pueda de html a pdf y manejar bien la orientación, eliminación de imagen o pantalla si no se desea o son innecesaria porque estan en blanco o ajustar lo demás para tener algo de buena calidad.|
| 1.2.9 | Corregir el scroll cuando esta abierto el modal de "Buscar herramientas o formatos o enlaces" ya que permite hacer scroll completo a la pagina mientras tenemos la vista del modal aperturada|

> **Estado 1.2 (2026-11-24):** 1.2.1–1.2.9 implementadas y verificadas.
> - **1.2.4:** `resolveCanvasConversionTarget` en `conversionEngine.ts`; fallo explícito `UNSUPPORTED_OUTPUT_FORMAT`; `webp-to-gif` retirado; `gif-to-webp` documentado como primer fotograma; lote usa el destino de la tool.
> - **1.2.5:** formatos sintéticos PNG/JPG/WebP con `convertTo`; se descarga el original y se convierte en el navegador; vista previa real de imagen.
> - **1.2.6:** `normalizeSearchText` + sinónimos ES + stopwords + ranking; búsqueda global en `CategoryView`; sin tope en `CommandPalette`.
> - **1.2.7:** `/image-downloader` (`bulkImageService.ts`, `BulkImageDownloaderView.tsx`): vista previa, formato por ítem/predeterminado, eliminar, ZIP.
> - **1.2.8:** `/webpage-capture`: snapshot HTML SSRF-safe + proxy de imágenes, captura por pantallas PNG/JPG/WebP, detección de blancos, ZIP y PDF con orientación. Límites: canvas/video/iframes/tipografías externas simplificados.
> - **1.2.9:** `CommandPalette` bloquea el scroll del documento mientras está abierto.
> - Tests: `imageTools`, `coreTools`, `toolRegistry`, `shellResponsive`, `bulkImage`, `webpageCapture`, `backend/test/webpageSnapshot`.

### 1.3 ToolRunner: Guard Execution + Modal Mantenimiento

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 1.3.1 | `handleExecute`: check `health.services[requiredService]` antes de llamar backend | `frontend/src/components/tools/ToolRunner.tsx` |
| 1.3.2 | Modal/Toast: "Servicio en mantenimiento: Railway temporalmente no disponible. Las herramientas locales funcionan normalmente." | `frontend/src/components/tools/ToolRunner.tsx` |
| 1.3.3 | No llamar `uploadAndStartConversion` si servicio no disponible | `frontend/src/components/tools/ToolRunner.tsx` |

### 1.4 **ELIMINACIÓN COMPLETA MÓDULO HISTORIAL** (Prioridad Alta)

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 1.4.1 | **Backend:** Eliminar `history.routes.ts` + import en `api.router.ts` | `backend/src/routes/history.routes.ts` (DELETE), `api.router.ts` |
| 1.4.2 | **Backend:** Eliminar `ProcessingHistory` de `prisma/schema.prisma` + migración | `prisma/schema.prisma`, `prisma/migrations/` |
| 1.4.3 | **Backend:** Eliminar referencia en `account.routes.ts` (línea 13) | `backend/src/routes/account.routes.ts` |
| 1.4.4 | **Frontend:** Eliminar `historyService.ts` completo | `frontend/src/services/historyService.ts` (DELETE) |
| 1.4.5 | **Frontend:** Eliminar `HistoryView.tsx` + import en `App.tsx` | `frontend/src/components/views/HistoryView.tsx` (DELETE), `App.tsx` |
| 1.4.6 | **Frontend:** Eliminar botón "Historial" de `Sidebar`, `MobileNav`, `Header`, `AccountViews` | `Sidebar.tsx`, `MobileNav.tsx`, `Header.tsx`, `AccountViews.tsx` |
| 1.4.7 | **Frontend:** Eliminar `historyService` imports + llamadas `addItem` en `ToolRunner`, `StickerMakerTool`, `PdfToolRunner` | `ToolRunner.tsx`, `StickerMakerTool.tsx`, `PdfToolRunner.tsx` |
| 1.4.8 | **Frontend:** Eliminar setting "Guardar historial local" + "Confirmar antes de limpiar" en `SettingsView` | `SettingsView.tsx` |
| 1.4.9 | **Frontend:** Eliminar `HistoryItem` type + campos `processingLocation` | `frontend/src/types.ts` |
| 1.4.10 | **Frontend:** Limpiar `useEffect` `historyService.setAuthenticated` en `App.tsx` | `App.tsx` |

### 1.5 Vercel Static Deploy + Client-Only Mode

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 1.5.1 | Crear `vercel.json` con rewrites `/api/*` → 404 + headers | `vercel.json` (NEW) |
| 1.5.2 | Ajustar `vite.config.ts` para build estático puro (`outDir: dist`) | `vite.config.ts` |
| 1.5.3 | Detectar modo client-only: `import.meta.env.VITE_CLIENT_ONLY` | `frontend/src/services/apiClient.ts` |
| 1.5.4 | En client-only: `/api/health` y `/api/status` → mock response maintenance | `frontend/src/services/apiClient.ts` |

### 1.6 Health Polling Optimizado (Shared Context)

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 1.6.1 | Crear `ServiceStatusContext` (polling 30s, shared state) | `frontend/src/context/ServiceStatusContext.tsx` (NEW) |
| 1.6.2 | `Header` consume context en lugar de `checkHealth` propio | `frontend/src/components/layout/Header.tsx` |
| 1.6.3 | `ToolRunner` consume context para guard execution | `frontend/src/components/tools/ToolRunner.tsx` |

**Tokens estimados FASE 1:** ~18k | **Sesiones:** 2-3

---

## 📋 FASE 2: FFMPEG WASM INTEGRATION (High Impact)

**Objetivo:** Migrar **TODAS** las tools `engine: 'server-ffmpeg'` → `engine: 'browser-ffmpeg-wasm'`

### 2.1 Setup & Infrastructure

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 2.1.1 | Instalar `@ffmpeg/ffmpeg` + `@ffmpeg/util` + tipos | `package.json` |
| 2.1.2 | Configurar Service Worker para cache WASM (~25 MB) | `public/sw.js` (NEW), `vite.config.ts` |
| 2.1.3 | Crear hook `useFFmpeg` con lazy load + progress | `frontend/src/hooks/useFFmpeg.ts` (NEW) |

### 2.2 FFmpegWasmEngine (API Compatible)

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 2.2.1 | Crear `FFmpegWasmEngine` clase con misma interfaz que `ServerFFmpegEngine` | `frontend/src/engines/FFmpegWasmEngine.ts` (NEW) |
| 2.2.2 | Implementar `convert(input, output, options, onProgress, signal)` | `FFmpegWasmEngine.ts` |
| 2.2.3 | Memory management: `FFmpeg.FS('unlink', ...)` cleanup | `FFmpegWasmEngine.ts` |
| 2.2.4 | Progress parsing desde FFmpeg stdout/stderr | `FFmpegWasmEngine.ts` |

### 2.3 Registry Migration

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 2.3.1 | Cambiar `processingMode: 'HYBRID_WASM'`, `engine: 'browser-ffmpeg-wasm'` | `frontend/src/registry/tools.ts` |
| 2.3.2 | Agregar `requiredServices: ['ffmpeg']` (para fallback detection) | `tools.ts` |
| 2.3.3 | Tools a migrar: `video-to-mp3`, `video-compressor`, `video-to-wav`, `video-to-gif`, `video-trimmer`, `video-mute`, `video-speed`, `video-resize`, `mp4-to-webm`, `webm-to-mp4`, `wav-to-mp3`, `mp3-to-wav`, `audio-bitrate`, `audio-normalize`, `audio-format-converter` | `tools.ts` |

### 2.4 ToolRunner Integration

| Subfase | Tarea | Archivos |
|---------|-------|----------|
| 2.4.1 | Detectar `engine === 'browser-ffmpeg-wasm'` → usar `FFmpegWasmEngine` local | `ToolRunner.tsx` |
| 2.4.2 | Progress UI: conectar `onProgress` de WASM engine a `JobProgressView` | `ToolRunner.tsx` |
| 2.4.3 | Blob output → `jobService.completeJob` con `blob`, `filename`, `mimeType` | `ToolRunner.tsx` |
| 2.4.4 | Error handling: OOM, codec not supported, timeout | `ToolRunner.tsx`, `FFmpegWasmEngine.ts` |

### 2.5 Testing & Optimización

| Subfase | Tarea |
|---------|-------|
| 2.5.1 | Test manual: video-compressor, video-to-mp3, video-trimmer, video-to-gif |
| 2.5.2 | Verificar memory leaks: múltiples conversiones seguidas |
| 2.5.3 | Optimizar WASM load: solo cargar cuando user abre tool FFmpeg |
| 2.5.4 | Fallback: si WASM falla → mostrar opción "Procesar en servidor" (si Railway vivo) |

**Tokens estimados FASE 2:** ~20k | **Sesiones:** 3-4

---

## 📋 FASE 3: CLIENT-SIDE DOCUMENT FALLBACKS

**Objetivo:** Reducir dependencia LibreOffice para conversiones básicas

| Subfase | Tarea | Librerías |
|---------|-------|-----------|
| 3.1 | `docx` → PDF via `pdf-lib` (texto, tablas básicas, imágenes) | `docx` (parse), `pdf-lib` (ya instalado) |
| 3.2 | `xlsx` → PDF via `sheetjs` + `pdf-lib` | `xlsx` (NEW) |
| 3.3 | `pptx` → PDF: extraer texto + layout simple | `pptx2html` o `pptxgenjs` (NEW) |
| 3.4 | Registry: migrar `word-to-pdf`, `xlsx-to-pdf`, `pptx-to-pdf` a `CLIENT_SIDE` parcial | `tools.ts` |
| 3.5 | ToolRunner: detectar `engine: 'server-libreoffice'` + fallback client-side | `ToolRunner.tsx` |

**Tokens estimados:** ~8k | **Sesión:** 1-2

---

## 📋 FASE 4: EXPANSIÓN HERRAMIENTAS LOCALES (Continuo)

**Objetivo:** Reforzar y expandir toolkit client-side

### 4.1 Imagen: Conversiones Bidireccionales Completas

| Formato | A → B | Estado |
|---------|-------|--------|
| AVIF | ✅ PNG/JPG/WebP → AVIF, AVIF → PNG/JPG/WebP | ⬜ Pendiente |
| HEIC/HEIF | ⚠️ Solo lectura (heic2any) | ⬜ Investigar |
| JPEG XL | ⬜ Pendiente | ⬜ Pendiente |
| TIFF | ⬜ Pendiente | ⬜ Pendiente |
| BMP/ICO | ✅ Básico | ⬜ Reforzar |

**Nuevas tools imagen:**
- `avif-converter` (bidireccional)
- `heic-converter` (heic2any)
- `tiff-converter`
- `batch-format-converter` (multi-formato + zip)

### 4.2 PDF: Manipulación Avanzada Client-Side

| Tool | Descripción | Librería |
|------|-------------|----------|
| `compress-pdf` | Reducir tamaño PDF (downsample images, remove duplicates) | `pdf-lib` |
| `pdf-to-images` | Exportar páginas como PNG/JPG | `pdf-lib` + canvas |
| `pdf-to-text` | Extraer texto buscable | `pdf-lib` / `pdfjs-dist` |
| `pdf-ocr` | OCR client-side (Tesseract.js) | `tesseract.js` |
| `sign-pdf` | Firma digital visible/invisible | `pdf-lib` |

### 4.3 Audio: Expansión Web Audio API

| Tool | Descripción |
|------|-------------|
| `audio-fade` | Fade in/out configurable |
| `audio-concat` | Unir múltiples audios |
| `audio-silence-trim` | Auto-detectar y recortar silencios |
| `audio-loops` | Generar loops perfectos |
| `audio-spectrogram` | Visualizar espectrograma |

### 4.4 Developer Tools: Refuerzo

| Tool | Mejora |
|------|--------|
| `json-formatter` | JSONPath query, schema validation |
| `jwt-decoder` | Verificar firma (HS256/RS256) con JWKS |
| `hash-generator` | HMAC, PBKDF2, Argon2 (WASM) |
| `sql-formatter` | Formatear SQL (sql-formatter) |
| `graphql-formatter` | Formatear/validar GraphQL |

### 4.5 Utilities: Cotidianas

| Tool | Descripción |
|------|-------------|
| `cron-generator` | Generar/explicar expresiones cron |
| `regex-debugger` | Visual debugger paso a paso |
| `color-contrast-checker` | WCAG AA/AAA compliance |
| `markdown-editor` | Editor live con preview (ya existe base) |

**Tokens estimados:** Continuo | **Prioridad:** Según demanda usuario

---

## 📋 FASE 5: YT-DLP METADATA CLIENT-SIDE (Opcional)

**Objetivo:** Análisis de metadata sin servidor (no download)

| Subfase | Tarea | Viabilidad |
|---------|-------|------------|
| 5.1 | Port extractores ligeros a WASM (solo metadata) | ⚠️ Complejo |
| 5.2 | Usar `ytdl-core` (Node) en edge function para metadata | ✅ Factible |
| 5.3 | Migrar `video-metadata-inspector` a `CLIENT_SIDE` parcial | ✅ Factible |

---

## 🗑️ MÓDULOS ELIMINADOS (Confirmado - FASE 1.4)

| Módulo | Razones | Impacto |
|--------|---------|---------|
| **ProcessingHistory** (Backend + Frontend) | Innecesario, privacidad, complejidad, tokens DB | -5 tablas Prisma, -3 routes, -5 componentes, -1 service |
| **Settings: saveHistory / confirmBeforeClearHistory** | Ligados a historial | -2 toggles SettingsView |

---

## 🔒 SEGURIDAD & PUERTOS (Localhost Definitivo)

```typescript
// server.ts - ÚNICO entry point puerto 3000
app.use((req, res, next) => {
  // Redirect 127.0.0.1 → localhost (dev only)
  if (req.hostname === '127.0.0.1' && process.env.NODE_ENV !== 'production') {
    return res.redirect(301, `http://localhost:3000${req.originalUrl}`);
  }
  next();
});

// Cookies config
SESSION_COOKIE_SAME_SITE: nodeEnv === 'production' ? 'none' : 'lax'
SESSION_COOKIE_SECURE: nodeEnv === 'production' // true en prod (HTTPS)
```

**Garantías:**
- ✅ Sin vulnerabilidades CSRF (token en header + SameSite)
- ✅ Cookies httpOnly, secure (prod), sameSite=lax (dev)
- ✅ Rate limiting auth endpoints
- ✅ No exposición FS/red arbitraria (solo tools permitidas)
- ✅ WASM FFmpeg sandboxed en WebWorker

---

## 📊 RESUMEN TOKENS & SESIONES

| Fase | Tokens | Sesiones | Entregable Clave |
|------|--------|----------|------------------|
| **0** | ~3k | 0.5 | **Login local funcional** |
| **1** | ~18k | 2-3 | **Prod maintenance + Vercel + Sin historial** |
| **2** | ~20k | 3-4 | **FFmpeg 100% WASM (game changer)** |
| **3** | ~8k | 1-2 | **Docs fallback client-side** |
| **4** | Continuo | Continuo | **Toolkit expansion** |
| **Total** | **~49k+** | **7-10** | **VELYXORA v2.0 Client-First** |

---

## ✅ CHECKLIST EJECUCIÓN INMEDIATA (FASE 0 + 1.1-1.4)

- [x] **0.1** Redirect 127.0.0.1 → localhost en `server.ts`
- [x] **0.2** Eliminar `invalidate('auth:me')` en login/register
- [x] **0.3** Verificar cookies SameSite=Lax en dev
- [x] **0.4** Test login completo (register → login → reload → logout)
- [x] **1.1.1-1.1.3** `requiredServices` + limpieza types (`EXTERNAL_PROVIDER` fuera)
- [ ] **1.1.4** `HistoryItem` legacy fields → movido a 1.4
- [ ] **1.2.1-1.2.3** Maintenance badge UI
- [ ] **1.3.1-1.3.3** ToolRunner guard + modal
- [ ] **1.4.1-1.4.10** **ELIMINACIÓN TOTAL HISTORIAL** (10 sub-tareas)
- [ ] **1.5.1-1.5.4** Vercel static + client-only mode
- [ ] **1.6.1-1.6.3** ServiceStatusContext polling 30s

---

## 🚀 PRÓXIMO PASO

**FASE 0 ✅ completa. Ejecutar FASE 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6** en orden estricto de dependencias.

> **Nota:** La eliminación del historial (1.4) es la tarea más grande en archivos tocados (~15 archivos) pero reduce deuda técnica y tokens DB permanentemente.
