# VELYXORA | Universal Conversion & Media Toolkit

VELYXORA is an enterprise-grade, privacy-first universal file transformation and media processing toolkit designed for modern desktop and mobile web environments.

```text
velyxora/
├── frontend/             # High-speed React 19 / Vite / Tailwind v4 Client
│   ├── src/
│   │   ├── components/   # UI components and tool runners
│   │   ├── registry/     # Tool registry
│   │   ├── services/     # Client engines and API client
│   │   ├── types.ts      # Shared frontend types
│   │   └── types/        # Domain-specific type modules
│   ├── public/           # Static public files & web manifest
│   ├── package.json      # Frontend standalone package manifest
│   ├── tsconfig.json     # Frontend TypeScript extension
│   └── README.md         # Frontend developer documentation
│
├── backend/              # Node.js / Express / TypeScript Conversion Backend
│   ├── src/
│   │   ├── app.ts        # Express app factory with CORS & rate limiting
│   │   ├── server.ts     # Standalone HTTP server entry point
│   │   ├── config/       # Environment variables & constants
│   │   ├── controllers/  # Health, tools, formats, uploads, conversions, media
│   │   ├── routes/       # RESTful API route definitions
│   │   ├── services/     # Job service, storage service, media service
│   │   ├── engines/      # ServerFFmpegEngine, LibreOfficeEngine, ServerImageEngine
│   │   ├── providers/    # MediaProvider adapters (YouTube, Vimeo, TikTok, etc.)
│   │   ├── jobs/         # JobManager & InMemoryQueue (BullMQ compatible)
│   │   ├── workers/      # Asynchronous conversion worker
│   │   ├── middleware/   # Request logger, error handler, upload handler
│   │   ├── schemas/      # Input validation schemas & DTOs
│   │   ├── types/        # Typed API responses & job contracts
│   │   ├── utils/        # Sanitizer, logger, path assertion
│   │   └── security/     # SSRF defense, IP filtering, rate limiting
│   ├── storage/          # Ephemeral converted output storage with TTL
│   ├── temp/             # Temporary upload staging directory with TTL
│   ├── package.json      # Backend standalone package manifest
│   ├── tsconfig.json     # Backend TypeScript configuration
│   └── README.md         # Backend developer documentation
│
├── docs/                 # Engineering Documentation & Contracts
│   ├── ARCHITECTURE.md   # Detailed system & layer architecture diagrams
│   ├── IMPLEMENTATION_STATUS.md # Full 60-tool status & matrix
│   ├── TODO.md           # Concrete, actionable engineering roadmap
│   ├── API.md            # Complete RESTful API specification
│   └── FORMATS.md        # File formats & conversion engine matrix
│
├── server.ts             # Unified full-stack development & production server
├── package.json          # Root workspace & orchestrator manifest
├── .env.example          # Environment variable template
└── README.md             # This document
```

---

## 🏛️ Architecture & Processing Modes

Every tool in VELYXORA is strictly governed by its declared `processingMode`:

1. **`CLIENT_SIDE`**:
   - Zero-latency execution in browser memory.
   - Files never leave the client device (using Canvas 2D, Web Audio API, Web Crypto API, JSZip, and QRCode).
2. **`SERVER_SIDE`**:
   - High-throughput conversion requiring native system binaries (e.g. `/usr/bin/ffmpeg` for MP4/WebM to MP3/WAV, bitrate modification).
3. **`HYBRID`**:
   - Client-first inspection with automatic server fallback.
4. **`EXTERNAL_PROVIDER`**:
   - SSRF-sanitized queries to official oEmbed endpoints (e.g., YouTube, Vimeo, TikTok, Reddit, Twitter/X) avoiding fake stream claims.

> **Absolute Rule**: Never simulate functionality. If an external engine is not present on the host (e.g. LibreOffice), VELYXORA exposes the exact API contract, validation, and transparent diagnostic messages without producing dummy files.

---

## 🚀 Getting Started in VS Code

### 1. Unified Full-Stack Run (Recommended)

You can run both frontend and backend concurrently from the workspace root:

```bash
# Install dependencies from the workspace root
npm install

# Start development server (serves frontend + backend API on port 3000)
npm run dev
```

Visit `http://localhost:3000` in your browser.

### 2. Standalone Frontend Run

```bash
cd frontend
npm install
npm run dev
```

### 3. Standalone Backend Run

```bash
cd backend
npm install
npm run dev
```

---

## 🛠️ Binary Dependencies (Windows & Linux Setup)

### FFmpeg

- **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install -y ffmpeg` (Path: `/usr/bin/ffmpeg`)
- **Windows**: Install via `winget install Gyan.FFmpeg` or download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add `bin` to PATH. Configure `FFMPEG_PATH` in `backend/.env`.

### LibreOffice (for Word/PowerPoint/Excel to PDF)

- **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install -y libreoffice-writer libreoffice-calc libreoffice-impress` (Path: `soffice`)
- **Windows**: Install standard MSI from [libreoffice.org](https://www.libreoffice.org/download/download-libreoffice/). Path: `C:\Program Files\LibreOffice\program\soffice.exe`. Configure `LIBREOFFICE_PATH` in `backend/.env`.

---

## 🔒 Security Measures

- **SSRF Defense**: Strict validation in `backend/src/security/ssrfValidator.ts` blocks requests to loopback addresses (`127.0.0.1`, `::1`), private LAN ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local metadata endpoints (`169.254.169.254`), and forbidden protocols (`file://`, `ftp://`).
- **Path Traversal Protection**: All uploaded and generated file paths are strictly vetted with `assertSafePath` to prevent directory traversal outside `temp/` and `storage/`.
- **Ephemeral Storage TTL**: Automatic cleanup process evicts files older than 30 minutes.
- **Rate Limiting**: Configurable sliding window limit prevents API abuse.

---

## 📦 Production Deployment & Build

```bash
# Compile frontend and backend
npm run build

# Start production server
npm start
```

Vite is configured only in the root `vite.config.ts`; its root is `frontend/` and its output is `dist/`. There is no second frontend Vite configuration.

The current baseline includes real client PDF generation through `frontend/src/services/pdfEngine.ts`, API/media validation, and backend security/API tests. FFmpeg, LibreOffice and direct media extraction remain dependent on host binaries and are not treated as verified merely because their adapters exist.
