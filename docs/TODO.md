# VELYXORA — Actionable Roadmap & Engineering Next Steps

This file details concrete, granular engineering steps required to continue development outside Google AI Studio (e.g. in VS Code or production cloud environments).

---

## Completed in Phase 1

- [x] Implement real client PDF generation and tests for text, images and invalid image formats.
- [x] Unify root typecheck, lint and test scripts.
- [x] Add deterministic API tests without requiring a process on port 3000.
- [x] Add IPv6 SSRF coverage for loopback, ULA, link-local and IPv4-mapped IPv6.
- [x] Connect frontend media analysis to `POST /api/media/analyze`; direct extraction remains intentionally unavailable.

## Completed in Phase 2A

- [x] Load the single root Vite configuration in the unified development middleware.
- [x] Restore Tailwind v4 utility generation for `frontend/src` in dev and production.
- [x] Remove the global `fetch` monkeypatch from `frontend/index.html`.
- [x] Verify the UI at 320, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 pixels without horizontal overflow.
- [x] Remove external font requests that were failing in the browser environment.
- [x] Fix duplicate mobile header actions causing narrow viewport overflow.
- [x] Add PATH-based FFmpeg/FFprobe configuration and typed `probeMedia` helper.
- [x] Add explicit FFmpeg integration prerequisite reporting; conversion fixtures remain skipped when host binaries are absent.
- [x] Fix the `qs` audit finding with a compatible npm override.

## Completed in Phase 2B — real result delivery

- [x] Use one absolute frontend API origin (`VITE_API_URL=http://localhost:3000`); API paths are centralized in `apiClient` and no Vite proxy is used.
- [x] Route media analysis to the backend and distinguish validation, provider and offline failures.
- [x] Add central Blob, URL and backend-file download handling with Object URL cleanup.
- [x] Add `fileId` to completed backend job output and exact-id download resolution with MIME, length and attachment headers.
- [x] Connect server tools to upload → conversion → bounded polling → download, with cancellation request support.
- [x] Stop advertising a browser-produced WAV as MP3; real MP3 now requires the FFmpeg backend.
- [x] Hide media stream download actions when no real provider/extractor URL exists.

### Remaining after Phase 2B

- [ ] Wire AbortSignal through the conversion worker so cancellation terminates an already-running FFmpeg child process.
- [ ] Add per-file batch retry/remove controls; current implemented image batch produces one real ZIP.
- [ ] Install no external engines automatically. LibreOffice and yt-dlp features remain external-engine-required.

### Phase 2A findings

- React Router is not installed or used by the current source, so the reported v7 future-flag warnings do not originate in VELYXORA.
- `M_ID` is absent from source, generated bundles and installed dependencies; it is classified as `UNKNOWN/external` and no runtime suppression was added.
- Google Fonts requests were removed because the browser environment returned failed font requests; CSS fallbacks remain active.

## 1. Host Binary Dependencies & Environment Setup

- [ ] **Install LibreOffice Headless on Host Server**:
  ```bash
  sudo apt-get update && sudo apt-get install -y libreoffice-writer libreoffice-calc libreoffice-impress
  ```
- [ ] **Verify LibreOffice Execution**:
      Test that `soffice --version` returns zero exit status in the execution environment.
- [ ] **Optional yt-dlp Extractor Installation**:
  ```bash
  sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  ```
- [ ] **Configure Environment Secrets**:
      Copy `backend/.env.example` to `backend/.env` and update `FFMPEG_PATH=/usr/bin/ffmpeg` and `LIBREOFFICE_PATH=/usr/bin/soffice`.

---

## 2. ServerFFmpegEngine Enhancements

- [x] **Spawn `/usr/bin/ffmpeg` with isolated child_process** (Completed).
- [x] **Parse timestamp progress from stderr** (Completed).
- [ ] **Add AbortController / child_process.kill(SIGTERM) signal to cancel running jobs**:
      Update `ServerFFmpegEngine.convert()` to accept an `AbortSignal`, invoking `proc.kill('SIGTERM')` on cancellation.
- [ ] **Add Video Watermark Filter Graph**:
      Append `-filter_complex "drawtext=text='VELYXORA':x=10:y=H-th-10:fontsize=24:fontcolor=white@0.8"` when `options.watermarkText` is supplied.
- [ ] **Add Video Speed Filter**:
      When `options.speedMultiplier` is supplied, append `-filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]" -map "[v]" -map "[a]"`.

---

## 3. Production Queue & Scale (BullMQ + Redis)

- [x] **Implement BullMQ-compatible in-memory queue interface** (Completed in `backend/src/jobs/InMemoryQueue.ts`).
- [ ] **Swap InMemoryQueue with BullMQ**:
  1. Run `npm install bullmq ioredis` in `backend/`.
  2. Instantiate `new Queue('conversions', { connection: { host: process.env.REDIS_HOST, port: 6379 } })`.
  3. Instantiate `new Worker('conversions', async (job) => { ... })`.

---

## 4. Object Storage Migration (StorageProvider)

- [x] **Implement local filesystem ephemeral storage with TTL** (Completed in `backend/src/services/storageService.ts`).
- [ ] **Create IStorageProvider interface**:
  ```typescript
  export interface IStorageProvider {
    upload(key: string, filePath: string, mimeType: string): Promise<string>;
    getDownloadStream(key: string): Promise<NodeJS.ReadableStream>;
    delete(key: string): Promise<void>;
  }
  ```
- [ ] **Implement S3/GCS Storage Adapter**:
      Create `S3StorageProvider` using `@aws-sdk/client-s3` for multi-node deployments.

---

## 5. Automated Tests & Quality Assurance

- [ ] **Fixture-based SSRF and engine expansion**:
      Keep extending deterministic tests for edge-case URL parsing and host-engine availability.
- [ ] **Integration Test: ServerFFmpegEngine Audio Extraction**:
      Add sample 2-second fixture `fixtures/sample.mp4` and verify `ServerFFmpegEngine.convert('sample.mp4', 'output.mp3')` produces valid MP3 file > 1000 bytes.
- [ ] **Frontend Component Test: UniversalInput**:
      Verify drag-and-drop event emits correct file metadata and MIME detection.
