import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  Images,
  Link2,
  Plus,
  Download,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileArchive,
  ShieldCheck,
} from "lucide-react";
import {
  BULK_IMAGE_FORMAT_OPTIONS,
  DEFAULT_BULK_IMAGE_FORMAT,
  type BulkImageItem,
  type BulkImageOutputFormat,
  bulkItemFilename,
  createBulkImageItem,
  extensionFromImageUrl,
  parseBulkImageUrls,
  uniqueFilename,
} from "../../services/bulkImageService";
import { apiClient } from "../../services/apiClient";
import { downloadService } from "../../services/downloadService";
import { convertImage, generateBatchZip } from "../../services/conversionEngine";
import { completedMediaOutput } from "../../services/mediaService";
import { pathForView } from "../../services/appRouting";
import { useAuth } from "../../auth/authContextValue";
import { toast } from "../common/toast";

interface BulkImageDownloaderViewProps {
  onBack?: () => void;
  onRequireAuth: (returnTo?: string) => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : "No se pudo descargar esta imagen.";

export const BulkImageDownloaderView: React.FC<BulkImageDownloaderViewProps> = ({
  onBack,
  onRequireAuth,
}) => {
  const { user } = useAuth();
  const [rawInput, setRawInput] = useState("");
  const [defaultFormat, setDefaultFormat] = useState<BulkImageOutputFormat>(DEFAULT_BULK_IMAGE_FORMAT);
  const [items, setItems] = useState<BulkImageItem[]>([]);
  const [previewErrors, setPreviewErrors] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);

  const pendingCount = items.filter((item) => item.status !== "done").length;
  const readyCount = items.length - pendingCount;

  const handleAdd = () => {
    const urls = parseBulkImageUrls(rawInput);
    if (!urls.length) {
      toast.warning("Pega al menos una URL de imagen válida.");
      return;
    }
    const existing = new Set(items.map((item) => item.url));
    const additions = urls
      .filter((url) => !existing.has(url))
      .map((url, index) => createBulkImageItem(url, defaultFormat, items.length + index));
    if (!additions.length) {
      toast.info("Esas imágenes ya están en la lista.");
      return;
    }
    setItems((previous) => {
      const known = new Set(previous.map((item) => item.url));
      return [...previous, ...additions.filter((item) => !known.has(item.url))];
    });
    setRawInput("");
    toast.success(`${additions.length} imagen(es) agregada(s)`, "Revisa la vista previa y ajusta el formato si lo necesitas.");
  };

  const updateFormat = (id: string, format: BulkImageOutputFormat) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, format } : item)));
  };

  const removeItem = (id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
    setPreviewErrors((previous) => {
      if (!(id in previous)) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });
  };

  const clearAll = () => {
    if (isDownloading) return;
    setItems([]);
    setPreviewErrors({});
    setBatchProgress(null);
  };

  const markItem = (id: string, patch: Partial<BulkImageItem>) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  /** Downloads the original through the media pipeline and converts locally if needed. */
  const fetchItemFile = async (item: BulkImageItem): Promise<{ blob: Blob; filename: string }> => {
    const sourceExtension = extensionFromImageUrl(item.url);
    let job = await apiClient.startMediaDownload({
      url: item.url,
      formatId: "direct",
      container: sourceExtension,
      type: "image",
      title: `${item.baseName}.${sourceExtension}`,
    });
    activeJobIdRef.current = job.id;

    for (let attempt = 0; attempt < 300; attempt += 1) {
      await sleep(1000);
      job = await apiClient.getJobStatus(job.id);
      if (job.status === "COMPLETED") {
        const output = completedMediaOutput(job)!;
        const original = await downloadService.getBackendFile(output.fileId);
        if (item.format === "original") {
          return { blob: original.blob, filename: bulkItemFilename(item) };
        }
        const namedFile = new File(
          [original.blob],
          output.filename || `${item.baseName}.${sourceExtension}`,
          { type: original.contentType || original.blob.type || "image/*" },
        );
        const converted = await convertImage(namedFile, {
          format: item.format,
          quality: item.format === "image/png" ? undefined : 0.92,
        });
        return { blob: converted.blob, filename: bulkItemFilename(item) };
      }
      if (job.status === "CANCELLED") throw new Error("Descarga cancelada.");
      if (job.status === "FAILED") {
        throw new Error(job.error || "El trabajo no pudo completarse.");
      }
    }
    throw new Error("La descarga excedió el tiempo de espera.");
  };

  const requireSession = (): boolean => {
    if (user) return true;
    toast.info("Inicia sesión para descargar imágenes en lote");
    onRequireAuth(pathForView("image-downloader"));
    return false;
  };

  const handleDownloadItem = async (item: BulkImageItem) => {
    if (isDownloading || !requireSession()) return;
    setIsDownloading(true);
    markItem(item.id, { status: "downloading", error: undefined });
    try {
      const file = await fetchItemFile(item);
      downloadService.downloadBlob(file.blob, file.filename);
      markItem(item.id, { status: "done" });
    } catch (error: unknown) {
      markItem(item.id, { status: "error", error: errorMessage(error) });
      toast.error("No se pudo descargar la imagen", errorMessage(error));
    } finally {
      activeJobIdRef.current = null;
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!items.length || isDownloading || !requireSession()) return;
    const queue = items.filter((item) => item.status !== "done");
    if (!queue.length) {
      toast.info("Todas las imágenes de la lista ya se descargaron.");
      return;
    }

    setIsDownloading(true);
    cancelRef.current = false;
    const downloaded: Array<{ blob: Blob; filename: string }> = [];
    const usedNames = new Set<string>();
    let failed = 0;

    for (let index = 0; index < queue.length; index += 1) {
      if (cancelRef.current) break;
      const item = queue[index];
      setBatchProgress({ current: index + 1, total: queue.length });
      markItem(item.id, { status: "downloading", error: undefined });
      try {
        const file = await fetchItemFile(item);
        downloaded.push({
          blob: file.blob,
          filename: uniqueFilename(file.filename, usedNames),
        });
        markItem(item.id, { status: "done" });
      } catch (error: unknown) {
        failed += 1;
        markItem(item.id, { status: "error", error: errorMessage(error) });
      }
    }

    activeJobIdRef.current = null;
    setBatchProgress(null);
    setIsDownloading(false);

    if (!downloaded.length) {
      toast.error("No se descargó ninguna imagen", "Revisa los enlaces o inténtalo de nuevo.");
      return;
    }

    try {
      if (downloaded.length === 1) {
        downloadService.downloadBlob(downloaded[0].blob, downloaded[0].filename);
      } else {
        const zip = await generateBatchZip(downloaded);
        downloadService.downloadBlob(zip, `imagenes-${new Date().toISOString().slice(0, 10)}.zip`);
      }
      toast.success(
        downloaded.length === 1 ? "Imagen descargada" : `${downloaded.length} imágenes empaquetadas`,
        failed ? `${failed} no se pudieron descargar.` : "El paquete está listo.",
      );
    } catch (error: unknown) {
      toast.error("No se pudo preparar la descarga", errorMessage(error));
    }
  };

  const handleStop = async () => {
    cancelRef.current = true;
    if (activeJobIdRef.current) {
      try {
        await apiClient.cancelJob(activeJobIdRef.current);
      } catch {
        // The current item may finish first; the loop still stops.
      }
    }
    toast.info("Deteniendo la descarga por lotes…");
  };

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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
          <Images className="w-3.5 h-3.5" />
          <span>Descarga masiva de imágenes</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Pega varias URLs y descárgalas juntas
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
          Agrega imágenes una por línea, revisa su vista previa y elige el formato de cada una o uno predeterminado para todo el lote.
        </p>
        <p className="text-xs text-amber-300">
          Usa solo imágenes públicas o contenido que tengas permiso de descargar.
        </p>
      </div>

      {/* Add images */}
      <div className="rounded-2xl bg-[#101218] border border-white/[0.1] p-4 sm:p-5 space-y-3">
        <label htmlFor="bulk-image-urls" className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
          <Link2 className="w-3.5 h-3.5" /> Enlaces de imágenes
        </label>
        <textarea
          id="bulk-image-urls"
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          rows={4}
          disabled={isDownloading}
          placeholder={"https://sitio.com/foto1.jpg\nhttps://sitio.com/foto2.png\nhttps://sitio.com/foto3.webp"}
          className="w-full rounded-xl bg-[#08090D] border border-white/[0.08] px-3 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 font-mono resize-y"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="bulk-default-format" className="text-xs text-slate-400 whitespace-nowrap">
              Formato predeterminado
            </label>
            <select
              id="bulk-default-format"
              value={defaultFormat}
              onChange={(event) => setDefaultFormat(event.target.value as BulkImageOutputFormat)}
              disabled={isDownloading}
              className="rounded-lg bg-[#08090D] border border-white/[0.1] px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
            >
              {BULK_IMAGE_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-[11px] text-slate-500 font-mono">
              {parseBulkImageUrls(rawInput).length} enlace(s) detectado(s)
            </span>
            <button
              onClick={handleAdd}
              disabled={isDownloading || !rawInput.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Agregar a la lista
            </button>
          </div>
        </div>
      </div>

      {/* List header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Imágenes en la lista
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">{items.length}</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {readyCount} lista(s) · {pendingCount} pendiente(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={clearAll}
              disabled={isDownloading}
              className="px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-300 hover:bg-[#161922] disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vaciar lista
            </button>
          )}
          {isDownloading ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-300 text-xs font-semibold"
            >
              Detener
            </button>
          ) : (
            <button
              onClick={handleDownloadAll}
              disabled={!items.length}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <FileArchive className="w-4 h-4" />
              {items.length === 1 ? "Descargar imagen" : "Descargar todo (ZIP)"}
            </button>
          )}
        </div>
      </div>

      {batchProgress && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Procesando {batchProgress.current} de {batchProgress.total}. No cierres esta pestaña.
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <div className="py-14 text-center rounded-2xl bg-[#101218] border border-dashed border-white/[0.1]">
          <Images className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-300">Todavía no hay imágenes.</p>
          <p className="text-xs text-slate-500 mt-1">Pega tus enlaces arriba y pulsa «Agregar a la lista».</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {items.map((item) => {
            const previewFailed = previewErrors[item.id] === true;
            return (
              <div key={item.id} className="rounded-2xl bg-[#101218] border border-white/[0.08] overflow-hidden flex flex-col">
                <div className="relative aspect-square bg-[#08090D] flex items-center justify-center overflow-hidden">
                  {previewFailed ? (
                    <div className="text-center px-4">
                      <AlertTriangle className="w-7 h-7 mx-auto text-amber-400/80 mb-1.5" />
                      <p className="text-[11px] text-slate-400">Vista previa no disponible</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Puedes intentar la descarga igualmente.</p>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.baseName}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                      onError={() => setPreviewErrors((previous) => ({ ...previous, [item.id]: true }))}
                    />
                  )}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={isDownloading}
                    title="Quitar de la lista"
                    aria-label={`Quitar ${item.baseName}`}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 border border-white/10 text-slate-300 hover:text-white hover:bg-black/90 disabled:opacity-40"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    item.status === "done" ? "bg-emerald-500/20 text-emerald-300"
                      : item.status === "downloading" ? "bg-indigo-500/20 text-indigo-200"
                        : item.status === "error" ? "bg-red-500/20 text-red-300"
                          : "bg-slate-800/90 text-slate-400"
                  }`}>
                    {item.status === "done" ? "LISTA"
                      : item.status === "downloading" ? "DESCARGANDO"
                        : item.status === "error" ? "ERROR"
                          : "PENDIENTE"}
                  </span>
                </div>

                <div className="p-3 space-y-2.5 flex-1 flex flex-col">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate" title={item.baseName}>{item.baseName}</p>
                    <p className="text-[10px] text-slate-500 truncate" title={item.url}>{item.url}</p>
                  </div>

                  {item.error && (
                    <p className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 leading-snug">
                      {item.error}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5">
                    <label htmlFor={`format-${item.id}`} className="text-[10px] text-slate-500 shrink-0">Formato</label>
                    <select
                      id={`format-${item.id}`}
                      value={item.format}
                      onChange={(event) => updateFormat(item.id, event.target.value as BulkImageOutputFormat)}
                      disabled={isDownloading}
                      className="flex-1 min-w-0 rounded-lg bg-[#08090D] border border-white/[0.08] px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500/50"
                    >
                      {BULK_IMAGE_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadItem(item)}
                      disabled={isDownloading}
                      className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5"
                    >
                      {item.status === "downloading"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : item.status === "done"
                          ? <CheckCircle2 className="w-3.5 h-3.5" />
                          : <Download className="w-3.5 h-3.5" />}
                      {item.status === "done" ? "Descargar otra vez" : "Descargar"}
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={isDownloading}
                      title="Eliminar"
                      aria-label={`Eliminar ${item.baseName}`}
                      className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-red-300 hover:border-red-500/30 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl bg-[#08090D] border border-white/[0.06] p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Las imágenes se descargan mediante VELYXORA para evitar bloqueos del navegador. Las conversiones de formato se hacen en tu navegador; el archivo original no se modifica.
        </p>
      </div>
    </div>
  );
};
