---
name: Bug Report
about: Reportar un bug con contexto completo para reproducción rápida
title: '[BUG] '
labels: ['bug', 'needs-triage']
assignees: ''
---

## 🐛 Descripción del Bug

**Descripción clara y concisa** del problema.

---

## 🔄 Pasos para Reproducir

1. Ir a `http://localhost:3000` (o `https://velyxora.vercel.app`)
2. Navegar a '...'
3. Click en '...'
4. Observar error: '...'

---

## 🎯 Comportamiento Esperado

Qué debería pasar.

---

## 📸 Capturas de Pantalla / Logs

```bash
# Pegar logs relevantes (consola browser, terminal backend, network tab)
```

---

## 🖥️ Entorno

| Campo | Valor |
|-------|-------|
| **OS** | [ej. Windows 11, macOS 14, Ubuntu 22.04] |
| **Browser** | [ej. Chrome 128, Firefox 130, Safari 17] |
| **URL** | [ej. http://localhost:3000, https://velyxora.vercel.app] |
| **Node** | [ej. 22.11.0] |
| **Commit** | [ej. `abc1234` o branch] |

---

## 🛠️ Tool Afectada (si aplica)

- [ ] **Tool ID:** [ej. `video-to-mp3`, `png-to-webp`, `media-url-analyzer`]
- [ ] **Processing Mode:** [CLIENT_SIDE / SERVER_SIDE / HYBRID / HYBRID_WASM]
- [ ] **Requiere Server:** [Sí / No]

---

## 🔍 Contexto Adicional

- **Fase actual del roadmap:** [ej. FASE 0, FASE 1.3, FASE 2.1]
- **¿Relacionado con cambios recientes?** [Sí/No - qué commit/PR]
- **¿Error en `.agents/troubleshooting.md`?** [Sí/No]

---

## ✅ Checklist Pre-Reporte

- [ ] He leído `.agents/troubleshooting.md` — no es un known issue
- [ ] He probado en `localhost:3000` (NO `127.0.0.1:3000`)
- [ ] He verificado `npm run typecheck` y `npm run lint` pasan
- [ ] He adjuntado logs/errores relevantes
- [ ] He especificado tool + processing mode si aplica