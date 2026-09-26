# Hardening de producción — septiembre de 2026

> **Documento histórico.** Registra una revisión de seguridad realizada en
> septiembre de 2026. Algunas secciones describen el modelo comercial de
> planes y créditos que posteriormente fue retirado
> (`prisma/migrations/20260926000100_retire_commercial_models`). No describe el
> comportamiento actual en esos puntos; se conserva como historial.

## Alcance de la corrección

Se cerraron SEC-001 a SEC-014 de forma incremental: rechazo temprano y validación por herramienta en uploads; limitadores para registro y rutas costosas; CSRF estable entre pestañas; shortener sin resolución DNS; límites diferenciados; firmas mínimas y nombres físicos UUID; enlaces Markdown seguros; login/registro JSON con origen estricto en producción; cabeceras y caché privada; logs y errores sanitizados; comprobación de frontera en paths; y límites menores para cuerpos JSON/urlencoded. No se modificaron hashing, pagos, idempotencia, Prisma como ORM, allowlist/SSRF de media, FFmpeg, LibreOffice ni la estrategia pinneada de yt-dlp.

## Planes y límites (HISTÓRICO / RETIRADO)

> Planes y créditos fueron retirados. VELYXORA usa límites técnicos de
> fair-use (`backend/src/config/freeServiceLimits.ts`). La tabla siguiente se
> conserva solo como registro histórico.

`backend/src/config/plans.ts` definía los valores comerciales que el seed sincronizaba con PostgreSQL. En runtime, el plan activo almacenado en la base de datos era autoritativo. Los valores no fueron modificados:

| Plan | Créditos | Upload comercial | Jobs | Historial |
| --- | ---: | ---: | ---: | ---: |
| FREE | 25 | 25 MiB | 1 | 30 días |
| PLUS | 300 | 100 MiB | 2 | 90 días |
| PRO | 1200 | 500 MiB | 4 | sin vencimiento configurado |

El límite efectivo de upload es el menor entre el plan y `MAX_UPLOAD_SIZE_MB`. El default físico continúa siendo 100 MiB. Por ello PRO no debe anunciar capacidad efectiva superior a 100 MiB en Railway hasta validar disco, memoria, proxy y tiempos de request y configurar conscientemente un hard limit mayor.

ADMIN omite créditos y límites comerciales, pero conserva validación de formato, firma, ownership, timeouts, rate limits, SSRF y concurrencia técnica. En producción conserva `MAX_UPLOAD_SIZE_MB`. Fuera de producción usa el hard limit independiente `LOCAL_ADMIN_MAX_UPLOAD_SIZE_MB` (default 1024 MiB, rango 1–16384) para pruebas locales. No existe un bypass general de seguridad.

La API de cuenta devuelve las capacidades efectivas; el frontend las utiliza para informar y rechazar archivos demasiado grandes antes de transferirlos. El backend y la base de datos siguen siendo autoritativos. Las definiciones visuales de herramientas no conceden permisos al cliente.

## Uploads

El cliente envía `toolId` con el upload. Antes de escribir el archivo se comprueban sesión, plan, herramienta, extensión, MIME, límite efectivo y cantidad de archivos pendientes. Después de escribir se verifica una firma mínima conocida. Los nombres físicos usan UUID y los IDs públicos continúan siendo UUID opacos. El backend vuelve a comprobar que el archivo se procese con la misma herramienta.

## CSRF

El token de cada sesión es estable entre llamadas a `/auth/me`; abrir otra pestaña no invalida la primera. Sesiones anteriores a la migración reciben un token al primer `/auth/me`. El cliente solo recupera y repite una petición cuando recibe explícitamente `CSRF_INVALID`, y el retry máximo es uno.

## Shortener

El shortener usa validación sintáctica local, admite exclusivamente HTTP/HTTPS y no realiza DNS, fetch, HEAD, metadata ni ejecución de procesos. Los slugs nuevos usan 96 bits; los anteriores siguen siendo resolubles. La moderación distingue enlaces activos, deshabilitados y expirados. Los reportes no deshabilitan automáticamente.

- `POST /api/links/:slug/reports` registra un reporte limitado por tasa.
- `GET /api/admin/short-link-reports` lista reportes para revisión.
- `PATCH /api/admin/short-links/:id/status` habilita o deshabilita con auditoría.
- `PATCH /api/admin/short-link-reports/:id` marca un reporte como revisado o descartado.

Todas las mutaciones administrativas conservan autenticación, rol ADMIN, CSRF y rate limiting.

## Rate limiting y escalado

Login/registro, uploads, short links, media, pagos, feedback y mutaciones admin tienen límites diferenciados. El store continúa en memoria, apropiado para la beta de una réplica. Para varias réplicas deberá migrarse a un store compartido sin alterar las políticas de ruta. Railway debe mantener `TRUST_PROXY=true`.

## Cabeceras, errores y logs

Railway añade `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, anti-clickjacking/CSP y HSTS en producción. Las APIs privadas se sirven con `Cache-Control: no-store, private`. Vercel aplica una CSP compatible con Vite y medios remotos, y conserva el orden filesystem-first antes del fallback SPA. Los logs HTTP registran pathname sin query string; los motores no registran comandos, stderr crudo ni paths temporales. Los errores inesperados se convierten en mensajes públicos genéricos.

## Configuración

No se añadieron variables obligatorias de producción. Se reutilizan `MAX_UPLOAD_SIZE_MB` como hard limit, `TRUST_PROXY=true` en Railway y los orígenes CORS existentes. `LOCAL_ADMIN_MAX_UPLOAD_SIZE_MB` es opcional y solo afecta a ADMIN fuera de producción; Railway no debe configurarla. Antes de elevar el hard limit productivo deben validarse límites reales de Railway, memoria, disco, proxy y timeouts; esta corrección no cambia valores comerciales.

## Verificación ejecutable

```text
npm run typecheck
npm test
npm run lint
npm run build:frontend
npm run build:backend
npm audit --audit-level=high
git diff --check
```

## Despliegue

1. Aplicar la nueva migración con `prisma migrate deploy` en Railway.
2. Desplegar el backend.
3. Desplegar el frontend desde `frontend/`.
4. Comprobar login, `/auth/me`, una mutación desde dos pestañas, uploads válidos/incorrectos, short links antiguos/nuevos y moderación admin.
