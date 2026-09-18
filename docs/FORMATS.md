# VELYXORA — Supported Formats & Conversion Matrix

| Input Format              | Output Format  | Engine                 | Execution Environment          | Status                     |
| :------------------------ | :------------- | :--------------------- | :----------------------------- | :------------------------- |
| **PNG**                   | JPG, WebP      | BrowserImageEngine     | Browser Canvas                 | `COMPLETE`                 |
| **JPG**                   | PNG, WebP      | BrowserImageEngine     | Browser Canvas                 | `COMPLETE`                 |
| **WebP**                  | PNG, JPG       | BrowserImageEngine     | Browser Canvas                 | `COMPLETE`                 |
| **PNG/JPG/WebP (Sticker)**| WebP 512×512   | StickerMakerService    | Browser Canvas, ≤100 KB target | `COMPLETE`                 |
| **SVG**                   | PNG, JPG       | BrowserImageEngine     | Browser Canvas                 | `COMPLETE`                 |
| **Images (JPG/PNG/WebP)** | PDF            | pdf-lib/browser-canvas | Browser Blob PDF               | `COMPLETE`                 |
| **Plain Text**            | PDF            | pdf-lib                | Browser Blob PDF               | `COMPLETE`                 |
| **Video (MP4/WebM)**      | WAV            | BrowserAudioEngine     | Web Audio API PCM              | `COMPLETE`                 |
| **Audio (WAV)**           | Trimming, Gain | BrowserAudioEngine     | Web Audio API PCM              | `COMPLETE`                 |
| **MP4, WebM, MOV**        | MP3            | ServerFFmpegEngine     | Node.js child_process (ffmpeg) | `BACKEND_READY`            |
| **MP4, WebM, MOV**        | WAV            | ServerFFmpegEngine     | Node.js child_process (ffmpeg) | `BACKEND_READY`            |
| **WAV, FLAC, M4A**        | MP3            | ServerFFmpegEngine     | Node.js child_process (ffmpeg) | `BACKEND_READY`            |
| **MP4**                   | WebM           | ServerFFmpegEngine     | Node.js child_process (ffmpeg) | `BACKEND_READY`            |
| **WebM**                  | MP4            | ServerFFmpegEngine     | Node.js child_process (ffmpeg) | `BACKEND_READY`            |
| **Video**                 | GIF            | ServerFFmpegEngine     | Node.js child_process (ffmpeg) | `BACKEND_READY`            |
| **DOCX**                  | PDF            | LibreOfficeEngine      | soffice --headless             | `REQUIRES_EXTERNAL_ENGINE` |
| **PPTX**                  | PDF            | LibreOfficeEngine      | soffice --headless             | `REQUIRES_EXTERNAL_ENGINE` |
| **XLSX**                  | PDF            | LibreOfficeEngine      | soffice --headless             | `REQUIRES_EXTERNAL_ENGINE` |
| **ODT**                   | PDF            | LibreOfficeEngine      | soffice --headless             | `REQUIRES_EXTERNAL_ENGINE` |
| **CSV**                   | JSON           | BrowserTextEngine      | RFC 4180 Parser                | `COMPLETE`                 |
| **JSON**                  | CSV            | BrowserTextEngine      | Array Flattener                | `COMPLETE`                 |
| **Markdown**              | HTML           | BrowserTextEngine      | Markdown Lexer                 | `COMPLETE`                 |
| **Code 128 Data**         | PNG Barcode    | BrowserCanvasEngine    | Canvas 2D Barcode              | `COMPLETE`                 |
| **URL / Text**            | QR Code (PNG)  | BrowserQrEngine        | QRCode Canvas Matrix           | `COMPLETE`                 |

## Compatibilidad de Share

Share no transforma formatos. Los archivos ya generados conservan su MIME y nombre y se entregan al menú nativo únicamente si `navigator.canShare({ files })` los acepta en el navegador/SO actual. La disponibilidad puede variar incluso para un formato de esta matriz; la descarga existente permanece como fallback. Los resultados de texto pueden compartirse o copiarse. Las URL requieren un destino HTTP(S) público real.
