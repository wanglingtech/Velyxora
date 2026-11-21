---
name: Feature Request
about: Proponer nueva tool o mejora alineada con el roadmap
title: '[FEATURE] '
labels: ['feature', 'needs-triage']
assignees: ''
---

## 💡 Resumen de la Propuesta

**Descripción clara** de la feature/nueva tool.

---

## 🎯 Alineación con Roadmap

| Fase | Subfase | Tool/Área |
|------|---------|-----------|
| [ ] FASE 0 | - | Auth/Foundation |
| [ ] FASE 1 | 1.x | Maintenance/History/Vercel |
| [ ] FASE 2 | 2.x | **FFmpeg WASM** (video/audio tools) |
| [ ] FASE 3 | 3.x | Document fallbacks (LibreOffice) |
| [ ] FASE 4 | 4.x | **Expansión tools locales** (imagen, PDF, audio, dev, utils) |
| [ ] FASE 5 | 5.x | yt-dlp metadata client-side |

> **Nota:** Features fuera de FASE 4 requieren justificación fuerte.

---

## 📋 Especificación Técnica (si nueva Tool)

### ToolDefinition Propuesta
```typescript
{
  id: 'nueva-tool-id',
  slug: 'nueva-tool-id',
  name: 'Nombre Visible',
  description: 'Una frase descriptiva < 160 chars',
  category: 'image|video|audio|developer|text|qr-barcode|whatsapp|media-downloader|pdf|documents|utilities',
  subcategory: 'Conversión|Edición|Optimización|...',
  icon: 'LucideIconName', // ej. FileImage, Music, Code2, etc.
  inputTypes: ['mime/type1', 'mime/type2'],
  outputTypes: ['mime/type1'],
  acceptedExtensions: ['ext1', 'ext2'],
  acceptedMimeTypes: ['mime/type1'],
  processingMode: 'CLIENT_SIDE', // CLIENT_SIDE | HYBRID_WASM | SERVER_SIDE
  engine: 'browser-canvas', // browser-canvas|browser-webaudio|browser-crypto|browser-text|browser-qrcode|browser-pdf|browser-svg|browser-speech|browser-ffmpeg-wasm|server-ffmpeg|server-libreoffice|server-ytdlp
  supportsBatch: false,
  supportsPreview: true,
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  popular: false,
  isClientReady: true,
  requiredServices: [], // ['ffmpeg'] | ['libreOffice'] | ['ytDlp'] si SERVER_SIDE
}
```

### Runner Kind
```typescript
// getToolRunnerKind(tool) debería retornar:
'standard-file' | 'sticker-maker' | 'pdf' | 'image-advanced' | 'data-code' | 'utilities' | 'barcode' | 'qr' | 'text' | 'creative' | 'whatsapp' | 'speech'
```

---

## 🎨 UX / UI Considerations

- **ToolCard:** Badge, icono, descripción corta
- **ToolRunner:** Controles específicos, preview, progress
- **Categoría:** ¿Dónde aparece en `TOOLKIT_GROUPS`?
- **Mobile:** ¿Funciona en móvil? ¿Controles touch?

---

## ⚙️ Implementación Técnica

### Dependencias Nuevas
```json
{
  "nueva-lib": "^1.0.0"
}
```

### Archivos a Crear/Modificar
- [ ] `frontend/src/registry/tools.ts` — Añadir ToolDefinition
- [ ] `frontend/src/components/tools/subtools/NuevaTool.tsx` — Subtool component
- [ ] `frontend/src/components/tools/ToolRunner.tsx` — Añadir case en runnerKind
- [ ] `frontend/src/services/conversionEngine.ts` — Si motor nuevo
- [ ] `.agents/tool-registry.md` — Actualizar catálogo
- [ ] `.agents/context.md` — Si arquitectura cambia

### Testing
- [ ] Unit test: `backend/test/nueva-tool.test.ts`
- [ ] Manual: `localhost:3000` → tool funciona end-to-end
- [ ] Edge cases: archivos grandes, formatos inválidos, cancelación

---

## 📊 Impacto Estimado

| Métrica | Estimación |
|---------|------------|
| **Tokens implementación** | [ej. 3k, 8k, 15k] |
| **Tamaño bundle** | [ej. +15KB gzipped] |
| **Nuevas dependencias** | [ej. 1 nueva, 0 breaking] |
| **Breaking changes** | [Ninguno / Lista] |
| **Docs a actualizar** | [tool-registry.md, context.md, etc.] |

---

## ✅ Checklist Pre-Propuesta

- [ ] He leído `.agents/roadmap.md` — feature alineada con fase actual
- [ ] He verificado `.agents/tool-registry.md` — no duplicada
- [ ] He definido `processingMode` + `engine` + `requiredServices` correctos
- [ ] He especificado `runnerKind` para ToolRunner routing
- [ ] He considerado mobile + accessibility
- [ ] He estimado tokens + bundle impact