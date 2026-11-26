import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Globe,
  Loader2,
  Wand2,
  Download,
  FileArchive,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Rows3,
  Zap,
  Crop,
  X,
  RefreshCw,
} from "lucide-react";
import { ApiError, apiClient, type WebpageSnapshot } from "../../services/apiClient";
import {
  CAPTURE_SEGMENT_HEIGHT,
  type CaptureCropRegion,
  type CaptureImageFormat,
  type CapturedSegment,
  WebpageCaptureError,
  captureFilename,
  captureFullPageWithBrowser,
  sliceCapturedImage,
} from "../../services/webpageCaptureService";
import { generateBatchZip } from "../../services/conversionEngine";
import { createPdfFromImages, type PdfOrientation, type PdfPageSize } from "../../services/pdfEngine";
import { downloadService } from "../../services/downloadService";
import { pathForView } from "../../services/appRouting";
import { useAuth } from "../../auth/AuthContext";
import { toast } from "../common/ToastContainer";

interface WebpageCaptureViewProps {
  onBack?: () => void;
  onRequireAuth: (returnTo?: string) => void;
}

const CAPTURE_WIDTHS = [1024, 1280, 1440, 1600, 1920];
const FORMAT_OPTIONS: Array<{ value: CaptureImageFormat; label: string }> = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPG" },
  { value: "image/webp", label: "WebP" },
];

interface PreviewState {
  url: string;
  blob: Blob;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  width: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const errorMessage = (error: unknown): string =>
  error instanceof WebpageCaptureError || error instanceof Error
    ? error.message
    : "No se pudo completar la captura de la página.";

const isBrowserUnavailable = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.code === "BROWSER_UNAVAILABLE" ||
    error.code === "BACKEND_UNAVAILABLE" ||
    error.code === "CAPTURE_FAILED_UNSUPPORTED");

export const WebpageCaptureView: React.FC<WebpageCaptureViewProps> = ({ onBack, onRequireAuth }) => {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [snapshot, setSnapshot] = useState<WebpageSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [browserCapture, setBrowserCapture] = useState<boolean | null>(null);

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState<CaptureCropRegion | null>(null);
  const [draftCrop, setDraftCrop] = useState<CaptureCropRegion | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draftCropRef = useRef<CaptureCropRegion | null>(null);

  const [captureWidth, setCaptureWidth] = useState(1280);
  const [format, setFormat] = useState<CaptureImageFormat>("image/png");
  const [quality, setQuality] = useState(90);
  const [segmentHeight, setSegmentHeight] = useState(CAPTURE_SEGMENT_HEIGHT);
  const [scale, setScale] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<{ done: number; total: number } | null>(null);
  const [segments, setSegments] = useState<CapturedSegment[]>([]);
  const [skipBlank, setSkipBlank] = useState(true);

  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>("A4");
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>("portrait");
  const [pdfMargin, setPdfMargin] = useState(24);
  const [isExporting, setIsExporting] = useState(false);

  const selectedSegments = segments.filter((segment) => !skipBlank || !segment.blank);
  const blankCount = segments.filter((segment) => segment.blank).length;
  const previewMatches = Boolean(
    preview && preview.width === captureWidth && preview.scale === scale,
  );
  const activeRegion = draftCrop ?? crop;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setBrowserCapture(null);
      return;
    }
    let active = true;
    apiClient
      .webpageCapabilities()
      .then((capabilities) => {
        if (active) setBrowserCapture(capabilities.browserCapture);
      })
      .catch(() => {
        if (active) setBrowserCapture(null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const requireSession = (): boolean => {
    if (user) return true;
    toast.info("Inicia sesión para cargar y capturar páginas");
    onRequireAuth(pathForView("webpage-capture"));
    return false;
  };

  const applyPreview = (page: Omit<PreviewState, "url">, resetCrop: boolean) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const objectUrl = URL.createObjectURL(page.blob);
    previewUrlRef.current = objectUrl;
    setPreview({ ...page, url: objectUrl });
    setDraftCrop(null);
    if (resetCrop) setCrop(null);
  };

  const loadPreview = async (target: string, width: number, scaleValue: number) => {
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const page = await captureFullPageWithBrowser({ url: target, width, scale: scaleValue });
      applyPreview({ ...page, width }, true);
    } catch (error: unknown) {
      if (isBrowserUnavailable(error)) {
        setBrowserCapture(false);
        setPreviewError(
          "La vista previa con navegador no está disponible en este servidor. Aun así puedes generar capturas.",
        );
        toast.info("Vista previa no disponible", "Se usará el renderizador del servidor al capturar.");
      } else {
        setPreviewError(errorMessage(error));
        toast.error("No se pudo previsualizar la página", errorMessage(error));
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleLoad = async () => {
    if (isLoading || isCapturing || !requireSession()) return;
    const target = url.trim();
    if (!target) {
      toast.warning("Escribe la URL de una página web.");
      return;
    }
    setIsLoading(true);
    setSnapshot(null);
    setSegments([]);
    setPreview(null);
    setCrop(null);
    setPreviewError(null);
    try {
      const result = await apiClient.fetchWebpageSnapshot(target);
      setSnapshot(result);
      toast.success("Página lista", result.title || result.finalUrl);
      if (browserCapture !== false) {
        await loadPreview(result.finalUrl, captureWidth, scale);
      } else {
        setPreviewError("La captura completa no está disponible ahora.");
      }
    } catch (error: unknown) {
      toast.error("No se pudo cargar la página", errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshPreview = async () => {
    if (!snapshot || isPreviewing || isCapturing) return;
    await loadPreview(snapshot.finalUrl, captureWidth, scale);
  };

  const handleCapture = async () => {
    if (isCapturing || isExporting || isPreviewing || !snapshot || !requireSession()) return;
    if (browserCapture === false) {
      toast.warning(
        "Captura no disponible",
        "Este servidor no tiene el navegador de captura. Prueba de nuevo más tarde.",
      );
      return;
    }
    setIsCapturing(true);
    setCaptureProgress({ done: 0, total: 0 });
    try {
      let source: { blob: Blob; pageWidth: number; pageHeight: number; width: number; scale: number };
      if (preview && previewMatches) {
        source = preview;
      } else {
        const page = await captureFullPageWithBrowser({
          url: snapshot.finalUrl,
          width: captureWidth,
          scale,
        });
        source = { ...page, width: captureWidth };
        applyPreview({ ...page, width: captureWidth }, false);
      }

      const result = await sliceCapturedImage(source.blob, {
        pageWidth: source.pageWidth,
        pageHeight: source.pageHeight,
        format,
        quality: quality / 100,
        segmentHeight,
        crop,
        onProgress: (done, total) => setCaptureProgress({ done, total }),
      });

      setSegments(result);
      const blankScreens = result.filter((segment) => segment.blank).length;
      if (blankScreens === result.length) {
        toast.warning(
          `${result.length} pantalla(s) en blanco`,
          "La página no mostró contenido o el área seleccionada está vacía. Prueba con otra zona.",
        );
      } else {
        toast.success(
          `${result.length} pantalla(s) capturada(s)`,
          blankScreens > 0
            ? "Algunas pantallas parecen estar en blanco."
            : "Revisa las miniaturas antes de descargar.",
        );
      }
    } catch (error: unknown) {
      if (isBrowserUnavailable(error)) {
        setBrowserCapture(false);
        toast.error(
          "Captura no disponible",
          "El navegador del servidor no está disponible en este momento.",
        );
      } else {
        toast.error("No se pudo capturar la página", errorMessage(error));
      }
    } finally {
      setIsCapturing(false);
      setCaptureProgress(null);
    }
  };

  const pointToPage = (event: React.PointerEvent): { x: number; y: number } | null => {
    const image = imgRef.current;
    if (!image || !preview) return null;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1) * preview.pageWidth,
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1) * preview.pageHeight,
    };
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!preview || isCapturing) return;
    const point = pointToPage(event);
    if (!point) return;
    draggingRef.current = true;
    dragStartRef.current = point;
    const initial = { x: point.x, y: point.y, width: 1, height: 1 };
    draftCropRef.current = initial;
    setDraftCrop(initial);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current || !preview) return;
    const start = dragStartRef.current;
    const point = pointToPage(event);
    if (!start || !point) return;
    const region = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.max(1, Math.abs(point.x - start.x)),
      height: Math.max(1, Math.abs(point.y - start.y)),
    };
    draftCropRef.current = region;
    setDraftCrop(region);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    dragStartRef.current = null;
    const region = draftCropRef.current;
    draftCropRef.current = null;
    setDraftCrop(null);
    if (region && region.width >= 8 && region.height >= 8) {
      setCrop(region);
      setSegments([]);
    }
  };

  const clearCrop = () => {
    setCrop(null);
    setDraftCrop(null);
    draftCropRef.current = null;
    draggingRef.current = false;
    dragStartRef.current = null;
  };

  const removeSegment = (id: string) => {
    setSegments((previous) => previous.filter((segment) => segment.id !== id));
  };

  const handleDownloadImages = async () => {
    if (!selectedSegments.length || isExporting) {
      if (!selectedSegments.length) toast.warning("No hay pantallas para descargar.");
      return;
    }
    setIsExporting(true);
    try {
      const files = selectedSegments.map((segment) => ({
        blob: segment.blob,
        filename: captureFilename(segment.index, format),
      }));
      if (files.length === 1) {
        downloadService.downloadBlob(files[0].blob, files[0].filename);
      } else {
        const zip = await generateBatchZip(files);
        downloadService.downloadBlob(zip, "pagina-web-capturas.zip");
      }
      toast.success("Capturas listas", `${files.length} imagen(es) preparadas.`);
    } catch (error: unknown) {
      toast.error("No se pudieron preparar las imágenes", errorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedSegments.length || isExporting) {
      if (!selectedSegments.length) toast.warning("No hay pantallas para incluir en el PDF.");
      return;
    }
    setIsExporting(true);
    try {
      const files = selectedSegments.map((segment) =>
        new File([segment.blob], captureFilename(segment.index, format), { type: format }),
      );
      const pdf = await createPdfFromImages(files, {
        pageSize: pdfPageSize,
        orientation: pdfOrientation,
        margin: pdfMargin,
      });
      downloadService.downloadBlob(pdf, "pagina-web.pdf");
      toast.success("PDF generado", `${files.length} página(s) incluidas.`);
    } catch (error: unknown) {
      toast.error("No se pudo generar el PDF", errorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const controlsLocked = isCapturing || isExporting;
  const selectionPercent = (value: number, total: number): string =>
    `${clamp((value / total) * 100, 0, 100)}%`;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {onBack && (
        <button
          onClick={onBack}
          className="min-h-11 px-3 rounded-xl border border-white/10 text-sm text-slate-300 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <ArrowLeft className="w-4 h-4" />Regresar
        </button>
      )}

      <div className="text-center space-y-2 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold">
          <Globe className="w-3.5 h-3.5" />
          <span>Página web a imágenes y PDF</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Captura una página completa
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
          Pega la URL, revisa la página real y elige el área exacta que quieres capturar en PNG, JPG o WebP, o genera un PDF.
        </p>
        <p className="text-xs text-amber-300">
          Usa solo páginas públicas o contenido que tengas permiso de capturar.
        </p>
      </div>

      {/* URL bar */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-[#101218] border border-white/[0.1] shadow-xl flex flex-col sm:flex-row items-center gap-2 focus-within:border-sky-500/50 transition-colors">
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={isLoading || isCapturing}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleLoad();
            }
          }}
          placeholder="https://ejemplo.com/pagina"
          className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          onClick={handleLoad}
          disabled={isLoading || isCapturing || !url.trim()}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all shrink-0"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {isLoading ? "Cargando..." : "Cargar página"}
        </button>
      </div>

      {/* Preview + capture settings */}
      {(snapshot || previewError) && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="rounded-2xl bg-[#101218] border border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] text-[11px] text-slate-400 gap-3">
              <span className="truncate" title={snapshot?.finalUrl}>
                {snapshot?.title || snapshot?.finalUrl || "Vista previa"}
              </span>
              <span className="font-mono shrink-0">
                {preview ? `${preview.pageWidth} × ${preview.pageHeight}px` : `${captureWidth}px`}
              </span>
            </div>

            {isPreviewing && (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                <p className="text-xs">Renderizando la página real...</p>
              </div>
            )}

            {!isPreviewing && preview && (
              <div className="relative">
                <div className="max-h-[60vh] overflow-auto bg-white">
                  <div className="relative overflow-hidden select-none">
                    <img
                      ref={imgRef}
                      src={preview.url}
                      alt="Vista previa de la página"
                      draggable={false}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      className={`block w-full h-auto touch-none ${
                        isCapturing ? "cursor-wait" : "cursor-crosshair"
                      }`}
                    />
                    {activeRegion && (
                      <div
                        className="absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-none"
                        style={{
                          left: selectionPercent(activeRegion.x, preview.pageWidth),
                          top: selectionPercent(activeRegion.y, preview.pageHeight),
                          width: selectionPercent(activeRegion.width, preview.pageWidth),
                          height: selectionPercent(activeRegion.height, preview.pageHeight),
                          boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.55)",
                        }}
                      >
                        <span className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-sky-500 text-[10px] font-mono text-white whitespace-nowrap">
                          {Math.round(activeRegion.width)} × {Math.round(activeRegion.height)} px
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-white/[0.06] text-[10px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Crop className="w-3 h-3" />
                    {crop
                      ? `Área: ${Math.round(crop.width)} × ${Math.round(crop.height)} px`
                      : "Arrastra sobre la imagen para recortar el área que quieres capturar."}
                  </span>
                  {crop && (
                    <button
                      onClick={clearCrop}
                      className="px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:bg-white/[0.05] flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Quitar área
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isPreviewing && !preview && previewError && (
              <div className="px-4 py-10 text-center text-xs text-amber-200/80 bg-amber-500/[0.04]">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-300" />
                {previewError}
                {snapshot && (
                  <div className="mt-3">
                    <button
                      onClick={handleRefreshPreview}
                      className="px-3 py-1.5 rounded-lg border border-amber-400/30 text-amber-200 text-[11px] inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" /> Reintentar vista previa
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#101218] border border-white/[0.08] p-4 space-y-3 h-fit">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5" /> Ajustes de captura
              {browserCapture !== null && (
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-semibold normal-case tracking-normal border flex items-center gap-1 ${
                    browserCapture
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/25 text-amber-300"
                  }`}
                >
                  <Zap className="w-2.5 h-2.5" />
                  {browserCapture ? "Renderizado completo" : "No disponible"}
                </span>
              )}
            </h3>

            <label className="block text-[11px] text-slate-400">
              Ancho de la página
              <select
                value={captureWidth}
                onChange={(event) => setCaptureWidth(Number(event.target.value))}
                disabled={controlsLocked}
                className="mt-1 w-full rounded-lg bg-[#08090D] border border-white/[0.1] px-2.5 py-2 text-xs text-slate-200 disabled:opacity-50"
              >
                {CAPTURE_WIDTHS.map((width) => (
                  <option key={width} value={width}>{width} px</option>
                ))}
              </select>
            </label>

            {preview && !previewMatches && (
              <button
                onClick={handleRefreshPreview}
                disabled={isPreviewing || controlsLocked}
                className="w-full px-2.5 py-2 rounded-lg border border-sky-500/30 text-sky-300 text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" /> Actualizar vista previa
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-slate-400">
                Formato
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as CaptureImageFormat)}
                  disabled={controlsLocked}
                  className="mt-1 w-full rounded-lg bg-[#08090D] border border-white/[0.1] px-2.5 py-2 text-xs text-slate-200 disabled:opacity-50"
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-slate-400">
                Nitidez
                <select
                  value={scale}
                  onChange={(event) => setScale(Number(event.target.value))}
                  disabled={controlsLocked}
                  className="mt-1 w-full rounded-lg bg-[#08090D] border border-white/[0.1] px-2.5 py-2 text-xs text-slate-200 disabled:opacity-50"
                >
                  <option value={1}>1x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </label>
            </div>

            <label className="block text-[11px] text-slate-400">
              Calidad {format === "image/png" ? "(sin pérdida)" : `· ${quality}%`}
              <input
                type="range"
                min={40}
                max={100}
                value={quality}
                onChange={(event) => setQuality(Number(event.target.value))}
                disabled={controlsLocked || format === "image/png"}
                className="mt-1.5 w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
              />
            </label>

            <label className="block text-[11px] text-slate-400">
              Alto de cada pantalla
              <select
                value={segmentHeight}
                onChange={(event) => setSegmentHeight(Number(event.target.value))}
                disabled={controlsLocked}
                className="mt-1 w-full rounded-lg bg-[#08090D] border border-white/[0.1] px-2.5 py-2 text-xs text-slate-200 disabled:opacity-50"
              >
                <option value={1000}>1000 px</option>
                <option value={1400}>1400 px</option>
                <option value={1800}>1800 px</option>
                <option value={2400}>2400 px</option>
              </select>
            </label>

            <button
              onClick={handleCapture}
              disabled={isCapturing || isExporting || isPreviewing || !snapshot || browserCapture === false}
              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              {isCapturing || isPreviewing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rows3 className="w-4 h-4" />
              )}
              {isCapturing
                ? captureProgress?.total
                  ? `Capturando ${captureProgress.done} de ${captureProgress.total}...`
                  : "Preparando captura..."
                : isPreviewing
                  ? "Preparando vista previa..."
                  : segments.length
                    ? "Volver a capturar"
                    : "Generar capturas"}
            </button>

            {segments.length > 0 && (
              <p className="text-[10px] text-slate-500 leading-snug">
                Cambiar formato, ancho, área o nitidez requiere volver a capturar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Captures */}
      {segments.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Pantallas capturadas
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">{segments.length}</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {blankCount > 0 ? `${blankCount} parecen estar en blanco. ` : ""}Elimina las que no necesites antes de exportar.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipBlank}
                  onChange={(event) => setSkipBlank(event.target.checked)}
                  className="w-3.5 h-3.5 accent-sky-500"
                />
                <EyeOff className="w-3.5 h-3.5" />
                Omitir en blanco
              </label>
              <button
                onClick={handleDownloadImages}
                disabled={isExporting || !selectedSegments.length}
                className="px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-200 hover:bg-[#161922] disabled:opacity-50 flex items-center gap-1.5"
              >
                <FileArchive className="w-3.5 h-3.5" /> Imágenes (ZIP)
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={isExporting || !selectedSegments.length}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>

          {/* PDF options */}
          <div className="rounded-xl bg-[#101218] border border-white/[0.08] p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="block text-[10px] text-slate-400">
              Tamaño PDF
              <select
                value={pdfPageSize}
                onChange={(event) => setPdfPageSize(event.target.value as PdfPageSize)}
                disabled={isExporting}
                className="mt-1 w-full rounded-lg bg-[#08090D] border border-white/[0.1] px-2 py-1.5 text-[11px] text-slate-200"
              >
                <option value="A4">A4</option>
                <option value="Letter">Carta</option>
                <option value="Fit">Ajustar a la imagen</option>
              </select>
            </label>
            <label className="block text-[10px] text-slate-400">
              Orientación
              <select
                value={pdfOrientation}
                onChange={(event) => setPdfOrientation(event.target.value as PdfOrientation)}
                disabled={isExporting || pdfPageSize === "Fit"}
                className="mt-1 w-full rounded-lg bg-[#08090D] border border-white/[0.1] px-2 py-1.5 text-[11px] text-slate-200 disabled:opacity-50"
              >
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </label>
            <label className="block text-[10px] text-slate-400">
              Margen
              <input
                type="number"
                min={0}
                max={80}
                value={pdfMargin}
                onChange={(event) => setPdfMargin(Math.max(0, Math.min(80, Number(event.target.value) || 0)))}
                disabled={isExporting}
                className="mt-1 w-full rounded-lg bg-[#08090D] border border-white/[0.1] px-2 py-1.5 text-[11px] text-slate-200"
              />
            </label>
            <div className="flex items-end text-[10px] text-slate-500">
              {selectedSegments.length} página(s) en el PDF
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {segments.map((segment) => {
              const omitted = skipBlank && segment.blank;
              return (
                <div
                  key={segment.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col ${
                    omitted ? "bg-[#0B0D12] border-amber-500/20 opacity-70" : "bg-[#101218] border-white/[0.08]"
                  }`}
                >
                  <div className="relative bg-[#08090D] max-h-64 overflow-hidden flex items-start justify-center">
                    <img
                      src={segment.dataUrl}
                      alt={`Pantalla ${segment.index + 1}`}
                      className="w-full h-auto object-top"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-slate-200">
                      #{segment.index + 1}
                    </span>
                    {segment.blank && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[10px] font-mono text-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> EN BLANCO
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-500 font-mono">
                      {segment.width} × {segment.height}px
                    </p>
                    <div className="flex items-center gap-1.5">
                      {!segment.blank && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      <button
                        onClick={() => removeSegment(segment.id)}
                        disabled={isExporting}
                        title="Eliminar esta pantalla"
                        aria-label={`Eliminar pantalla ${segment.index + 1}`}
                        className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-red-300 hover:border-red-500/30 disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!snapshot && !isLoading && !previewError && (
        <div className="py-14 text-center rounded-2xl bg-[#101218] border border-dashed border-white/[0.1]">
          <Globe className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-300">Carga una página para empezar.</p>
          <p className="text-xs text-slate-500 mt-1">Después podrás previsualizarla, recortar el área y descargar imágenes o un PDF.</p>
        </div>
      )}

      <div className="rounded-xl bg-[#08090D] border border-white/[0.06] p-4 flex items-start gap-3">
        <Download className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          La vista previa y las capturas se renderizan con un navegador real en el servidor, así que las páginas con JavaScript se ven como en tu navegador. Los archivos solo se guardan cuando los descargas.
        </p>
      </div>
    </div>
  );
};
