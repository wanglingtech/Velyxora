# VELYXORA — auditoría funcional final pre-auth

Fecha: 2026-09-13. Fuente de verdad: `PUBLIC_TOOL_REGISTRY` (55 herramientas públicas de 65 definiciones; 10 internas permanecen ocultas).

## Criterio y resultado

- `SERVER_COMPLETE` (17): flujo HTTP real probado, job `COMPLETED`, salida validada y descarga real.
- `LOCAL_COMPLETE` (0): no se concede este estado sin ejecutar la interfaz en un navegador controlable.
- `EXTERNAL_DEPENDENCY` (0 públicas): el downloader dedicado no pertenece al catálogo público de 55 y se informa aparte.
- `PARTIAL` (38): runner/código resoluble, pero no hubo prueba interactiva completa en navegador en esta sesión.
- `BROKEN` (0): `password-generator` era el único resolver incorrecto encontrado y fue corregido antes del cierre.

`H` significa que el resultado es aplicable al historial. Extensiones `—` indican entrada textual o que el registro declara MIME pero todavía no una lista estructurada de extensiones; no se infieren extensiones a partir de nombres conceptuales.

| toolId | nombre | categoría | modo / motor | extensiones / MIME de entrada | salida | runner | estado | prueba | historial | nota |
|---|---|---|---|---|---|---|---|---|---|---|
| png-to-jpg | PNG a JPG | image | CLIENT_SIDE / canvas | — / image/png | JPEG | standard-file | PARTIAL | código | H | UI no ejecutada |
| jpg-to-png | JPG a PNG | image | CLIENT_SIDE / canvas | — / image/jpeg | PNG | standard-file | PARTIAL | código | H | UI no ejecutada |
| png-to-webp | PNG a WebP | image | CLIENT_SIDE / canvas | — / image/png | WebP | standard-file | PARTIAL | código | H | UI no ejecutada |
| jpg-to-webp | JPG a WebP | image | CLIENT_SIDE / canvas | — / image/jpeg | WebP | standard-file | PARTIAL | código | H | UI no ejecutada |
| image-compressor | Compresor de Imágenes | image | CLIENT_SIDE / canvas | — / PNG,JPEG,WebP | JPEG/WebP | standard-file | PARTIAL | código | H | UI no ejecutada |
| image-resizer | Redimensionar Imagen | image | CLIENT_SIDE / canvas | — / PNG,JPEG,WebP | PNG/JPEG/WebP | standard-file | PARTIAL | código | H | UI no ejecutada |
| image-to-base64 | Imagen a Base64 | image | CLIENT_SIDE / FileReader | — / imágenes | texto | image-advanced | PARTIAL | código | no | UI no ejecutada |
| favicon-generator | Generador de Favicon | image | CLIENT_SIDE / canvas+ZIP | — / PNG,JPEG,SVG | ZIP | standard-file | PARTIAL | código | H | UI no ejecutada |
| color-picker-image | Extractor de Colores | image | CLIENT_SIDE / canvas | — / PNG,JPEG,WebP | texto | image-advanced | PARTIAL | código | no | UI no ejecutada |
| svg-to-png | SVG a PNG | image | CLIENT_SIDE / canvas | — / SVG,text | PNG | image-advanced | PARTIAL | código | H | UI no ejecutada |
| svg-to-jpg | SVG a JPG | image | CLIENT_SIDE / canvas | — / SVG,text | JPEG | image-advanced | PARTIAL | código | H | UI no ejecutada |
| image-filters | Filtros de Imagen | image | CLIENT_SIDE / canvas | — / PNG,JPEG,WebP | PNG/JPEG | image-advanced | PARTIAL | código | H | UI no ejecutada |
| image-watermark | Marca de Agua | image | CLIENT_SIDE / canvas | — / PNG,JPEG,WebP | JPEG | image-advanced | PARTIAL | código | H | UI no ejecutada |
| video-frame-extractor | Extractor de Fotogramas | video | CLIENT_SIDE / video+canvas | — / MP4,WebM,QuickTime | PNG/JPEG | standard-file | PARTIAL | código | H | UI no ejecutada |
| video-metadata-inspector | Inspector Técnico de Video | video | CLIENT_SIDE / media API | — / video | JSON | utilities | PARTIAL | código | no | UI no ejecutada |
| video-to-mp3 | Video a Audio | video | SERVER_SIDE / FFmpeg | — / MP4,WebM | WAV/MP3 | standard-file | SERVER_COMPLETE | HTTP E2E | H | FFprobe + download |
| video-compressor | Compresor de Video | video | SERVER_SIDE / FFmpeg | — / video | MP4 | standard-file | SERVER_COMPLETE | HTTP E2E | H | FFprobe + download |
| video-to-wav | Video a WAV | video | SERVER_SIDE / FFmpeg | — / video | WAV | standard-file | SERVER_COMPLETE | HTTP E2E | H | FFprobe + download |
| video-to-gif | Video a GIF | video | SERVER_SIDE / FFmpeg | — / video | GIF | standard-file | SERVER_COMPLETE | HTTP E2E | H | salida y download |
| video-trimmer | Recortar video | video | SERVER_SIDE / FFmpeg | — / video | MP4 | standard-file | SERVER_COMPLETE | HTTP E2E | H | parámetros reales |
| video-mute | Silenciar video | video | SERVER_SIDE / FFmpeg | — / video | MP4 | standard-file | SERVER_COMPLETE | HTTP E2E | H | audio ausente validado |
| video-speed | Velocidad de video | video | SERVER_SIDE / FFmpeg | — / video | MP4 | standard-file | SERVER_COMPLETE | HTTP E2E | H | duración validada |
| video-resize | Resolución de video | video | SERVER_SIDE / FFmpeg | — / video | MP4 | standard-file | SERVER_COMPLETE | HTTP E2E | H | dimensiones validadas |
| mp4-to-webm | MP4 a WebM | video | SERVER_SIDE / FFmpeg | — / video/mp4 | WebM | standard-file | SERVER_COMPLETE | HTTP E2E | H | FFprobe + download |
| webm-to-mp4 | WebM a MP4 | video | SERVER_SIDE / FFmpeg | — / video/webm | MP4 | standard-file | SERVER_COMPLETE | HTTP E2E | H | FFprobe + download |
| audio-trimmer | Recortador de Audio | audio | CLIENT_SIDE / WebAudio | — / audio | WAV | standard-file | PARTIAL | código | H | UI no ejecutada |
| wav-to-mp3 | WAV a MP3 | audio | SERVER_SIDE / FFmpeg | — / audio/wav | MP3 | standard-file | SERVER_COMPLETE | HTTP E2E | H | FFprobe + download |
| mp3-to-wav | MP3 a WAV | audio | SERVER_SIDE / FFmpeg | — / audio/mpeg | WAV | standard-file | SERVER_COMPLETE | HTTP E2E | H | FFprobe + download |
| audio-bitrate | Bitrate de audio | audio | SERVER_SIDE / FFmpeg | — / audio | MP3 | standard-file | SERVER_COMPLETE | HTTP E2E | H | bitrate probado |
| audio-normalize | Normalizar volumen | audio | SERVER_SIDE / FFmpeg | — / audio | MP3 | standard-file | SERVER_COMPLETE | HTTP E2E | H | loudnorm probado |
| json-formatter | Formateador JSON | developer | CLIENT_SIDE / texto | — / JSON,text | JSON | text | PARTIAL | runner | no | UI no ejecutada |
| jwt-decoder | Decodificador JWT | developer | CLIENT_SIDE / texto | — / text | JSON | text | PARTIAL | runner | no | UI no ejecutada |
| hash-generator | Generador Hash | developer | CLIENT_SIDE / WebCrypto | — / text | texto | text | PARTIAL | runner | no | UI no ejecutada |
| uuid-generator | Generador UUID | developer | CLIENT_SIDE / WebCrypto | — / text | texto | text | PARTIAL | runner | no | UI no ejecutada |
| csv-to-json | CSV a JSON | developer | CLIENT_SIDE / texto | — / CSV,text | JSON | data-code | PARTIAL | unit real | H | salida probada; UI no |
| json-to-csv | JSON a CSV | developer | CLIENT_SIDE / texto | — / JSON,text | CSV | data-code | PARTIAL | unit real | H | válido e inválido probados |
| markdown-to-html | Markdown a HTML | developer | CLIENT_SIDE / texto | — / Markdown,text | HTML | data-code | PARTIAL | unit real | H | escape probado; UI no |
| color-converter | Conversor de Colores | developer | CLIENT_SIDE / texto | — / text | texto | data-code | PARTIAL | unit real | no | válido/inválido probados |
| diff-checker | Comparador Diff | developer | CLIENT_SIDE / texto | — / text | texto | data-code | PARTIAL | unit real | no | diff probado; UI no |
| word-counter | Contador de Palabras | text | CLIENT_SIDE / texto | — / text | texto | text | PARTIAL | runner | no | UI no ejecutada |
| case-converter | Conversor de Caso | text | CLIENT_SIDE / texto | — / text | texto | text | PARTIAL | runner | no | UI no ejecutada |
| qr-generator | Generador QR | qr-barcode | CLIENT_SIDE / qrcode | — / text | PNG/SVG | qr | PARTIAL | PNG real | H | Blob probado; UI no |
| barcode-generator | Generador Code 128 | qr-barcode | CLIENT_SIDE / canvas | — / text | PNG | barcode | PARTIAL | encoder | H | rechazo Unicode probado; canvas UI no |
| images-to-pdf | Imágenes a PDF | pdf | CLIENT_SIDE / pdf-lib | — / JPEG,PNG,WebP | PDF | pdf | PARTIAL | PDF real | H | PDF y rechazo probados; UI no |
| text-to-pdf | Texto a PDF | pdf | CLIENT_SIDE / pdf-lib | — / text | PDF | pdf | PARTIAL | PDF real | H | multipágina probado; UI no |
| word-to-pdf | Word (DOCX) a PDF | documents | SERVER_SIDE / LibreOffice | docx / MIME DOCX | PDF | standard-file | SERVER_COMPLETE | HTTP E2E | H | upload→job→PDF→download |
| xlsx-to-pdf | Excel (XLSX) a PDF | documents | SERVER_SIDE / LibreOffice | xlsx / MIME XLSX | PDF | standard-file | SERVER_COMPLETE | HTTP E2E | H | upload→job→PDF→download |
| pptx-to-pdf | PowerPoint (PPTX) a PDF | documents | SERVER_SIDE / LibreOffice | pptx / MIME PPTX | PDF | standard-file | SERVER_COMPLETE | HTTP E2E | H | upload→job→PDF→download |
| odt-to-pdf | ODT a PDF | documents | SERVER_SIDE / LibreOffice | odt / MIME ODT | PDF | standard-file | PARTIAL | motor | H | no E2E de formato |
| ods-to-pdf | ODS a PDF | documents | SERVER_SIDE / LibreOffice | ods / MIME ODS | PDF | standard-file | PARTIAL | motor | H | no E2E de formato |
| odp-to-pdf | ODP a PDF | documents | SERVER_SIDE / LibreOffice | odp / MIME ODP | PDF | standard-file | PARTIAL | motor | H | no E2E de formato |
| aspect-ratio-calculator | Relación de Aspecto | utilities | CLIENT_SIDE / cálculo | — / text | texto | utilities | PARTIAL | runner | no | UI no ejecutada |
| password-generator | Generador de Contraseñas | utilities | CLIENT_SIDE / WebCrypto | — / text | texto | text | PARTIAL | resolver test | no | runner corregido |
| timestamp-converter | Conversor Timestamp | utilities | CLIENT_SIDE / cálculo | — / text | texto | utilities | PARTIAL | runner | no | UI no ejecutada |
| unit-converter | Conversor de Almacenamiento | utilities | CLIENT_SIDE / cálculo | — / text | texto | utilities | PARTIAL | runner | no | UI no ejecutada |

## Hallazgos fuera de la matriz pública

- `media-url-analyzer` permanece `public: false` y tiene vista dedicada. yt-dlp es `EXTERNAL_DEPENDENCY`: sus adaptadores y rechazos se prueban, pero la red del entorno bloqueó la conexión saliente (`WinError 10013`), por lo que no se declara descarga externa real.
- `image-cropper`, `audio-channel-converter`, `audio-format-converter`, `base64-text-converter`, `url-encoder-decoder`, `regex-tester`, `line-cleaner-sorter`, `slug-generator` y `merge-pdf` continúan ocultas. No cuentan como públicas.
- `200.js` y el identificador exacto `M_ID` no existen en fuente, `dist`, mapas ni dependencias instaladas. Los bundles Vite usan nombres `index-*.js`. Sin navegador controlable no se pudo inspeccionar Initiator ni repetir incógnito; la evidencia apunta a script inyectado/extensión, no a VELYXORA. No se añadió supresión.
- Footer: enlaces sociales externos con `target=_blank`, `rel=noopener noreferrer`, etiquetas accesibles, foco visible y objetivo táctil de 44 px. Se eliminó el indicador decorativo “Sistemas Operativos” que no estaba conectado a health.

## Validación ejecutada

- Tests: 43/43, sin skips. Incluye Office DOCX/XLSX/PPTX, FFmpeg/FFprobe/download, PDF, historial/settings, catálogo/búsqueda, validación Office, datos, QR y Code 128.
- La revisión visual 320–1920 e incógnito queda pendiente porque no existe navegador integrado disponible en esta sesión.
