# VELYXORA — RESTful API Specification

Base URL: `/api` (or `http://localhost:3000/api`)

---

## 1. System & Capabilities

### `GET /api/health`

Checks server health and presence of native system binaries.

**Response `200 OK`:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptimeSeconds": 142,
  "memoryUsageMb": {
    "rss": 48,
    "heapTotal": 32,
    "heapUsed": 24
  },
  "services": {
    "ffmpeg": true,
    "libreoffice": false,
    "storage": true
  },
  "timestamp": "2026-09-13T15:30:00.000Z"
}
```

The frontend consumes this endpoint through `frontend/src/services/apiClient.ts`. It does not fabricate metadata when the backend is unavailable or the provider is unsupported. Direct stream extraction is intentionally not implemented in this phase; the API reports `requiresExternalExtractor` and the frontend presents that requirement explicitly.

### `GET /api/tools`

Returns tool catalog capabilities and available backend execution engines.

### `GET /api/formats`

Returns format matrix for each backend engine.

---

## 2. File Uploads

### `POST /api/uploads`

Uploads a file to temporary server storage for subsequent processing.

- `Content-Type`: `multipart/form-data`
- Field: `file` (binary)

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "fileId": "1694612345-file",
    "filename": "1694612345-input.mp4",
    "originalName": "video.mp4",
    "size": 1542010,
    "mimeType": "video/mp4",
    "expiresInMinutes": 30
  },
  "timestamp": "2026-09-13T15:30:00.000Z"
}
```

---

## 3. Conversions

### `POST /api/conversions`

Submits a conversion job to the worker queue.

- `Content-Type`: `application/json`

**Request Body:**

```json
{
  "fileId": "1694612345-file",
  "toolId": "video-to-mp3",
  "targetFormat": "mp3",
  "options": {
    "bitrate": "320k",
    "trimStart": 0,
    "trimEnd": 30
  }
}
```

**Response `202 Accepted`:**

```json
{
  "success": true,
  "data": {
    "id": "job-1694612350-1234",
    "toolId": "video-to-mp3",
    "status": "QUEUED",
    "progress": 0,
    "createdAt": "2026-09-13T15:30:00.000Z"
  },
  "timestamp": "2026-09-13T15:30:00.000Z"
}
```

### `GET /api/conversions/:id`

Polls status and retrieves download link upon completion.

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "job-1694612350-1234",
    "toolId": "video-to-mp3",
    "status": "COMPLETED",
    "progress": 100,
    "output": {
      "filename": "converted-job-video.mp3",
      "mimeType": "audio/mp3",
      "size": 948210,
      "downloadUrl": "/api/download/converted-job-video"
    }
  },
  "timestamp": "2026-09-13T15:30:05.000Z"
}
```

### `DELETE /api/conversions/:id`

Cancels an active or queued conversion job.

---

## 4. Media Analysis & Downloader

### `POST /api/media/analyze`

Inspects an external media URL via SSRF-safe oEmbed resolvers.

**Request Body:**

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "platform": "youtube",
    "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
    "author": "Rick Astley",
    "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    "embedHtml": "<iframe src=\"https://www.youtube.com/embed/dQw4w9WgXcQ\" ...></iframe>",
    "formats": [],
    "isDirectDownloadPossible": false,
    "requiresExternalExtractor": true
  },
  "timestamp": "2026-09-13T15:30:00.000Z"
}
```
