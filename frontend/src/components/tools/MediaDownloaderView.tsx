import React, { useState } from "react";
import {
  DownloadCloud,
  ArrowRight,
  Shield,
  AlertTriangle,
  Play,
  CheckCircle,
  ExternalLink,
  Server,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import {
  ALL_MEDIA_ADAPTERS,
  findMatchingMediaAdapter,
} from "../../services/mediaService";
import { MediaMetadata, MediaFormatOption } from "../../types/media";
import { toast } from "../common/ToastContainer";

interface MediaDownloaderViewProps {
  initialUrl?: string;
  onBack?: () => void;
}

export const MediaDownloaderView: React.FC<MediaDownloaderViewProps> = ({
  initialUrl = "",
  onBack,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [selectedFormat, setSelectedFormat] =
    useState<MediaFormatOption | null>(null);

  const handleAnalyze = async (inputUrl?: string) => {
    const targetUrl = (inputUrl || url).trim();
    if (!targetUrl) {
      toast.warning("Por favor ingresa una URL válida.");
      return;
    }

    const adapter = findMatchingMediaAdapter(targetUrl);
    if (!adapter) {
      toast.error(
        "Proveedor no reconocido",
        "Por favor ingresa un enlace de YouTube, TikTok, Vimeo, Instagram, X/Twitter, Facebook o Reddit.",
      );
      return;
    }

    setIsAnalyzing(true);
    setMetadata(null);
    setSelectedFormat(null);

    try {
      const meta = await adapter.analyze(targetUrl);
      setMetadata(meta);
      if (meta.availableFormats.length > 0) {
        setSelectedFormat(meta.availableFormats[0]);
      }
      toast.success("Contenido analizado con éxito", meta.title);
    } catch (err: any) {
      const message = err?.message || "No fue posible analizar esta URL.";
      const title = message.startsWith("Backend no disponible")
        ? "Backend no disponible"
        : message.includes("No compatible")
          ? "Proveedor no compatible"
          : "No fue posible analizar esta URL";
      toast.error(title, message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadAction = () => {
    if (!selectedFormat || !metadata) return;

    if (metadata.requiresServerEngine) {
      toast.warning(
        "Backend Microservice Requerido",
        `${metadata.engineDetails.backendEngine} es necesario en el backend para empaquetar y entregar este flujo de video sin bloqueos CORS del navegador.`,
      );
    } else if (selectedFormat.directDownloadUrl) {
      window.open(selectedFormat.directDownloadUrl, "_blank");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <DownloadCloud className="w-3.5 h-3.5" />
          <span>Universal Media Downloader & Analyzer</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Descarga autorizada de medios digitales
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Analiza enlaces multimedia y extrae formatos autorizados con
          previsualización oficial y respeto a términos de servicio.
        </p>
      </div>

      {/* Input URL Bar */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-[#101218] border border-white/[0.1] shadow-xl flex flex-col sm:flex-row items-center gap-2 focus-within:border-indigo-500/50 transition-colors">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAnalyze();
            }
          }}
          placeholder="Pega el enlace del video (YouTube, TikTok, Vimeo, Instagram, X...)"
          className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
        />

        <button
          onClick={() => handleAnalyze()}
          disabled={isAnalyzing || !url.trim()}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all shrink-0"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analizando...</span>
            </>
          ) : (
            <>
              <span>Analizar</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Supported Platforms Strip */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 pt-1">
        <span className="text-slate-400 font-medium">
          Adaptadores integrados:
        </span>
        {ALL_MEDIA_ADAPTERS.map((a) => (
          <span
            key={a.id}
            className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 text-[11px] border border-white/[0.04]"
          >
            {a.name}
          </span>
        ))}
      </div>

      {/* Loading Skeleton */}
      {isAnalyzing && (
        <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] animate-pulse space-y-4">
          <div className="h-56 bg-slate-800/40 rounded-xl w-full" />
          <div className="h-6 bg-slate-800/50 rounded w-3/4" />
          <div className="h-4 bg-slate-800/30 rounded w-1/2" />
        </div>
      )}

      {/* Analyzed Result View */}
      {metadata && !isAnalyzing && (
        <div className="rounded-2xl bg-[#101218] border border-white/[0.1] overflow-hidden shadow-2xl space-y-6">
          {/* Media Player / Embed Preview Section */}
          <div className="relative bg-black w-full overflow-hidden flex items-center justify-center">
            {metadata.embedUrl ? (
              <div className="w-full aspect-video max-h-[380px]">
                <iframe
                  src={metadata.embedUrl}
                  title={metadata.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : metadata.thumbnailUrl ? (
              <div className="relative w-full aspect-video max-h-[320px] overflow-hidden">
                <img
                  src={metadata.thumbnailUrl}
                  alt={metadata.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full py-16 flex flex-col items-center justify-center text-slate-500">
                <Play className="w-12 h-12 mb-2 text-indigo-400 opacity-60" />
                <p className="text-xs">
                  Vista previa sin reproductor embed público
                </p>
              </div>
            )}
          </div>

          {/* Details Content */}
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 font-bold">
                  {metadata.platformLabel}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1.5 leading-snug">
                  {metadata.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Por {metadata.author}{" "}
                  {metadata.formattedDuration &&
                    `• ${metadata.formattedDuration}`}
                </p>
              </div>

              <a
                href={metadata.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>Ver original</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Formats Matrix */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Formatos disponibles
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  {metadata.availableFormats.length} opciones detectadas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {metadata.availableFormats.map((fmt) => {
                  const isSelected = selectedFormat?.id === fmt.id;
                  return (
                    <div
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500 text-white"
                          : "bg-[#161922] border-white/[0.06] text-slate-300 hover:border-indigo-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {fmt.extension.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold">
                            {fmt.formatNote}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {fmt.streamType}{" "}
                            {fmt.resolution && `• ${fmt.resolution}`}
                          </p>
                        </div>
                      </div>

                      {fmt.qualityBadge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-indigo-300 border border-indigo-500/20">
                          {fmt.qualityBadge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Backend Integration & Execution Notice */}
            <div className="p-4 rounded-xl bg-[#08090D] border border-white/[0.08] space-y-3">
              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-white">
                    Estado de la Arquitectura de Descarga
                  </p>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">
                    {metadata.engineDetails.legalNote}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Contrato de API: POST /api/media/process (body: &#123; url:
                    "{metadata.id}", format: "{selectedFormat?.id || "default"}"
                    &#125;)
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                {metadata.requiresServerEngine || !selectedFormat?.directDownloadUrl ? (
                  <span className="px-4 py-2 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 text-xs font-medium">
                    Análisis disponible · Descarga directa pendiente de motor externo
                  </span>
                ) : (
                  <button
                    onClick={handleDownloadAction}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>Descargar {selectedFormat.formatNote}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
