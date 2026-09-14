# VELYXORA — System Architecture & Design

## SaaS beta

PostgreSQL es la persistencia de producción mediante Prisma. La migración crea `User`, `Session`, `Plan`, `UserPlan`, `CreditLedger`, `ProcessingUsage`, `PaymentOrder`, `Payment` y `AdminAuditLog`, unidos por UUID. El saldo es la suma del ledger, no un campo mutable.

Una operación SERVER autenticada calcula costo en backend, comprueba plan/concurrencia, reserva con clave idempotente y confirma consumo al completar. `FAILED` y `CANCELLED` reembolsan íntegramente. ADMIN registra `ADMIN_TEST` con costo estimado y reserva cero.

Yape beta exige revisión ADMIN. Aprobar converge en Payment, PURCHASE, UserPlan y audit log dentro de una transacción. `PaymentProvider` queda como contrato sin checkout/webhook simulado. El downloader aplica `ProviderPolicyService` antes de SSRF/yt-dlp; GenericProvider no elude la allowlist.

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
