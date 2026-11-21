# GitHub Copilot Instructions — VELYXORA

> **Contexto obligatorio** para sugerencias de código compatibles con la arquitectura.

---

## 🏗️ ARQUITECTURA CLAVE

- **Client-first**: 80% tools CLIENT_SIDE (Canvas, WebAudio, WebCrypto, WebAssembly)
- **Unified server**: `server.ts` puerto 3000 (Express + Vite middleware dev)
- **ToolDefinition registry**: `frontend/src/registry/tools.ts` = única fuente verdad
- **ProcessingMode**: `CLIENT_SIDE` | `SERVER_SIDE` | `HYBRID` | `HYBRID_WASM` determina TODO
- **Auth**: Session cookies (httpOnly, SameSite=Lax dev / None prod) + CSRF double-submit
- **API Client**: Deduplicado (`deduped`), epoch guard en AuthContext, NO invalidate en login

---

## 📁 ESTRUCTURA IMPORTS

```typescript
// 1. Externos
import React from 'react';
// 2. Absolutos (@/ = frontend/src/)
import { ToolDefinition } from '@/types';
import { apiClient } from '@/services/apiClient';
// 3. Relativos
import { ToolCard } from '../common/ToolCard';
```

---

## ⚛️ PATRONES REACT OBLIGATORIOS

### Component Props
```typescript
interface Props {
  tool: ToolDefinition;           // Required
  initialFile?: File;             // Optional
  onBack: () => void;             // Required callback
  onRequireAuth: (returnTo?: string) => void;
}
```

### State + Refs
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const backendJobIdRef = useRef<string | null>(null);  // Mutación sin re-render
const pollingCancelledRef = useRef(false);
```

### Effects con Cleanup
```typescript
useEffect(() => {
  let active = true;
  apiClient.auth.account().then((data) => { if (active) setData(data); });
  return () => { active = false; };
}, [deps]);
```

### Lazy Loading (chunks >50kb)
```typescript
const HeavyComponent = React.lazy(() => 
  import('./HeavyComponent').then(m => ({ default: m.HeavyComponent }))
);
// SIEMPRE con Suspense
<React.Suspense fallback={<div>Cargando…</div>}><HeavyComponent /></React.Suspense>
```

---

## 🔧 TYPESCRIPT STRICT

- **NO `any`** — usar `unknown` + type guards
- **Generics** en services: `async function request<T>(...): Promise<T>`
- **Discriminated unions** para status: `type Status = 'OK' | 'ERROR'`
- **Type narrowing** por `processingMode`

---

## 🔐 SECURITY PATTERNS

```typescript
// API Client: SIEMPRE credentials + CSRF
fetch(url, {
  credentials: 'include',
  headers: { 'X-CSRF-Token': csrfToken(), 'Content-Type': 'application/json' }
});

// Rate limiting en endpoints públicos
// Validación estricta inputs (no confiar en cliente)
```

---

## 🎨 TAILWIND / UI

```tsx
// Button primary
className="min-h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40"

// Card
className="p-4 rounded-2xl bg-[#101218] border border-white/[0.08]"

// Input
className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"

// Responsive grid
className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5"
```

---

## 🛠️ TOOL REGISTRY (fuente única)

```typescript
// frontend/src/registry/tools.ts
{
  id: 'video-to-mp3',
  processingMode: 'HYBRID_WASM',      // CLIENT_SIDE | SERVER_SIDE | HYBRID | HYBRID_WASM
  engine: 'browser-ffmpeg-wasm',      // Determina ejecución
  requiresServer: false,              // true SOLO si SERVER_SIDE
  requiredServices: ['ffmpeg'],       // Granularidad maintenance
  isClientReady: true,                // true si funciona sin server
  // ...
}
```

---

## 🚫 PROHIBICIONES

| No hacer | Por qué |
|----------|---------|
| Usar `127.0.0.1:3000` en dev | Cookies host-scoped |
| `invalidate('auth:me')` en login/register | Race condition |
| Reintroducir `ProcessingHistory` | Eliminado intencionalmente |
| `processingMode: 'EXTERNAL_PROVIDER'` | No usado |
| `requiresServer` sin `requiredServices` | Maintenance impreciso |
| Server.ts en Vercel | No serverless |
| FFmpeg WASM eager load | OOM |
| `any` en TypeScript | Tipo unsafe |

---

## 📝 COMANDOS VALIDACIÓN

```bash
npm run typecheck  # 0 errores
npm run lint       # 0 warnings críticos
npm run build      # dist/ sin errores
npm run test       # Tests pasan
```

---

## 🎯 FASE ACTUAL: 0 → 1

**Roadmap en `.agents/roadmap.md`** — seguir orden estricto:
1. FASE 0: Auth fix (redirect + invalidate removal)
2. FASE 1: Maintenance banner + Vercel + History removal
3. FASE 2: FFmpeg WASM integration
4. FASE 3: Document fallbacks
5. FASE 4: Tool expansion continua

---

> **Referencia completa:** `.agents/context.md` + `.agents/conventions.md` + `.agents/api-contracts.md`