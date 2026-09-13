# VELYXORA — Backend Service Architecture

VELYXORA Backend provides high-throughput, secure media and document conversion services with native FFmpeg integration, LibreOffice document compilation, SSRF-hardened media analysis, and an in-memory asynchronous worker queue (swappable with BullMQ + Redis).

## Features

- **Real Native Engine Integration**:
  - `ServerFFmpegEngine`: Audio/video conversion, trimming, bitrate adaptation, audio extraction with native FFmpeg.
  - `LibreOfficeEngine`: Office document to PDF compilation (DOCX, PPTX, XLSX) via headless LibreOffice.
- **SSRF Defense**:
  - Direct loopback, IPv4 private/link-local, IPv6 loopback, ULA (`fc00::/7`), link-local (`fe80::/10`) and IPv4-mapped IPv6 addresses are blocked before and after DNS resolution.
- **Storage Lifecycle Management**:
  - Automatic TTL eviction for uploaded temporary files (`temp/`) and finished jobs (`storage/`).
- **Asynchronous Job System**:
  - In-memory concurrency worker queue with BullMQ-compatible interface.
- **RESTful API**:
  - Healthcheck (`GET /api/health`), tool capabilities (`GET /api/tools`), format matrix (`GET /api/formats`), uploads (`POST /api/uploads`), conversions (`POST /api/conversions`), media analysis (`POST /api/media/analyze`), and job management (`GET/DELETE /api/jobs/:id`).

---

## 🛠️ Binary Dependencies (Windows & Linux)

### 1. FFmpeg

#### Linux (Debian / Ubuntu)

```bash
sudo apt update && sudo apt install -y ffmpeg
```

Executable resolution uses `FFMPEG_PATH` when configured, otherwise `ffmpeg` from PATH. FFprobe uses `FFPROBE_PATH` or `ffprobe` from PATH.

#### Windows

1. Install via **winget** or **Chocolatey**:
   ```powershell
   winget install Gyan.FFmpeg
   # or
   choco install ffmpeg
   ```
2. Or download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add the `bin/` directory to your System PATH.
3. In `backend/.env`:
   ```env
   FFMPEG_PATH=ffmpeg
   # or full path:
   # FFMPEG_PATH="C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe"
   ```

---

### 2. LibreOffice (Headless Document to PDF)

#### Linux (Debian / Ubuntu)

```bash
sudo apt update && sudo apt install -y libreoffice-writer libreoffice-calc libreoffice-impress
```

Default executable path: `/usr/bin/soffice` or `soffice`

#### Windows

1. Download installer from [libreoffice.org](https://www.libreoffice.org/download/download-libreoffice/).
2. Standard installation directory:
   `C:\Program Files\LibreOffice\program\soffice.exe`
3. In `backend/.env`:
   ```env
   LIBREOFFICE_PATH="C:\\Program Files\\LibreOffice\\program\\soffice.exe"
   ```

---

## Getting Started (Local Development in VS Code)

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Server will boot on `http://localhost:3000` with live reloading.

The root command `npm run dev` starts the unified server. The backend package remains independently runnable with `npm run dev` from this directory.

## Running in Production

```bash
npm run build
npm start
```

`npm test` runs the backend security and API tests. FFmpeg and LibreOffice availability is reported by the API, but conversion success still requires the corresponding host binary and fixture-based validation.
