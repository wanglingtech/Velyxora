# VELYXORA — System Architecture & Design

## SaaS beta

PostgreSQL es la persistencia de producción mediante Prisma. La migración crea `User`, `Session`, `Plan`, `UserPlan`, `CreditLedger`, `ProcessingUsage`, `PaymentOrder`, `Payment` y `AdminAuditLog`, unidos por UUID. El saldo es la suma del ledger, no un campo mutable.

Una operación SERVER autenticada calcula costo en backend, comprueba plan/concurrencia, reserva con clave idempotente y confirma consumo al completar. `FAILED` y `CANCELLED` reembolsan íntegramente. ADMIN registra `ADMIN_TEST` con costo estimado y reserva cero.

Yape beta exige revisión ADMIN. Aprobar converge en Payment, PURCHASE, UserPlan y audit log dentro de una transacción. `PaymentProvider` queda como contrato sin checkout/webhook simulado. El downloader aplica `ProviderPolicyService` antes de SSRF/yt-dlp; GenericProvider no elude la allowlist.

WhatsApp Click-to-Chat es una ayuda de contacto separada de Share Layer y de la aprobación. `GET /api/payments/config`, protegido por sesión, expone únicamente el número público normalizado; las órdenes y la cuenta continúan llegando desde consultas limitadas por `userId`. El navegador construye `https://wa.me/<número>?text=<mensaje codificado>` solo para `PENDING_PAYMENT` y `PENDING_REVIEW`, usando el DTO real de la orden. No hay envío servidor, webhook, bot, Cloud API ni cambio de estado provocado por WhatsApp.

Sticker Maker usa un runner dedicado y `stickerMakerService` en el cliente. El servicio valida firma y MIME, decodifica la imagen, limita memoria por bytes/dimensiones/píxeles, calcula un crop cuadrado de tipo cover y exporta WebP mediante Canvas. No crea jobs ni endpoints. El resultado es un `File` que pasa al Share Layer existente; el historial conserva únicamente metadata mínima, nunca el archivo.

El historial local no se borra. Una futura `ApiHistoryRepository` importará solo metadata tras consentimiento.

VELYXORA is engineered as a resilient, privacy-first, hybrid media and document transformation platform. It strictly enforces separation of concerns between client-side compute, server-side media processing, and external provider integrations.

The active Vite configuration is the single root `vite.config.ts`; it uses `frontend/` as the Vite root and writes the production frontend to `dist/`. The frontend does not have a second Vite configuration.

```text
┌─────────────────────────────────────────────────────────────┐
│                 Client Layer (React / Vite)                 │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   Universal Input     │       │     Tool Registry     │  │
│  │ (Drag, Drop, URL, Pl) │       │ (Single Source Truth) │  │
│  └──────────┬────────────┘       └───────────┬───────────┘  │
│             │                                │              │
│             ▼                                ▼              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Tool Runner Engine                  │  │
│  └───────┬───────────────────────────────────────┬───────┘  │
│          │                                       │          │
│          ▼                                       ▼          │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Browser Engines       │       │ API Client            │  │
│  │ (Canvas, Audio, PDF)  │       │ (Resilient HTTP/XHR)  │  │
│  └───────────────────────┘       └───────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │ HTTP / REST
┌──────────────────────────────────────────────┼──────────────┐
│                 Server Layer (Node / Express)│              │
│                                              ▼              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Middleware: RateLimiter, RequestLogger, Upload, SSRF  │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Controllers: Health, Tools, Uploads, Converts, Media  │  │
│  └───────┬───────────────────────────────┬───────────────┘  │
│          ▼                               ▼                  │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Job Manager           │       │ Media Provider Router │  │
│  │ & In-Memory Queue     │       │ (SSRF-Protected)      │  │
│  └───────┬───────────────┘       └───────────┬───────────┘  │
│          ▼                                   ▼              │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Conversion Worker     │       │ oEmbed Extractors     │  │
│  │ (Concurrency Limited) │       │ (YouTube, Vimeo, ...) │  │
│  └───────┬───────────────┘       └───────────────────────┘  │
│          ▼                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Execution Engines:                                    │  │
│  │ • ServerFFmpegEngine (/usr/bin/ffmpeg)                │  │
│  │ • LibreOfficeEngine (soffice headless)                │  │
│  │ • ServerImageEngine                                   │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Storage & Cleanup Layer (backend/temp, storage, TTL)  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### 1. Frontend Client

- **Client Execution**: Whenever technically possible, data never leaves the user's browser. Standard raster images, the `pdf-lib` PDF engine, Web Audio extraction, QR codes, barcodes, and text/developer utilities execute through browser APIs. Web Workers are not currently part of the checked-in frontend implementation.
- **Fail-Safe Backend Degradation**: The frontend polls `GET /api/health`. If the server is offline or unreachable, client-side tools remain 100% operational. Server-dependent tools display a clear "Backend no disponible" badge with technical diagnostics rather than crashing.

### 2. Backend Security & Execution

- **Strict SSRF Isolation**: Incoming media URLs are audited against loopback (`127.0.0.1`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local metadata endpoints (`169.254.169.254`), and forbidden URI schemes (`file://`, `ftp://`) before making external HTTP requests.
- **Child Process Execution**: FFmpeg and LibreOffice use `spawn` with separated arguments and sanitized paths. Process cancellation and hard execution timeouts remain pending work.
- **Ephemeral Storage Lifecycle**: Files in `temp/` and `storage/` are indexed with creation timestamps and automatically evicted every 30 minutes to prevent disk exhaustion.

## Share layer

`frontend/src/services/shareService.ts` define un contrato discriminado para `file`, `text` y `url`. `JobProgressView` es la primera integración: cubre los resultados Blob de imagen/audio/video/PDF/QR que usan el job común, los archivos temporales descargables del backend y los resultados de texto del mismo flujo. Los runners con UI y descarga propias todavía no están integrados para evitar refactors transversales.

- `file`: resuelve el `File` de forma diferida, comprueba `navigator.canShare({ files })` y llama a `navigator.share`; sin soporte conserva la descarga existente.
- `text`: usa `navigator.share` o copia el texto como fallback.
- `url`: solo admite HTTP(S) público y usa compartir o copiar enlace. La integración común actual no convierte `downloadUrl`, `fileId` ni Blob URLs en enlaces públicos; una herramienta futura debe aportar explícitamente una URL pública válida.
- `AbortError` representa cancelación del usuario y no genera error. Otros fallos se propagan a la UI.

Para integrar una herramienta futura se construye un único `ShareTarget` con el contenido real y su fallback ya funcional. La capa no hace uploads, no conoce redes sociales, no consume créditos y no cambia los motores de procesamiento ni la API backend.
