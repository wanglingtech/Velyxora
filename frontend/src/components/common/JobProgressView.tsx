import React, { useState } from "react";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";
import { ProcessingJob } from "../../types";
import { formatFileSize } from "../../services/detectionService";
import { CapabilityBadge } from "./Badge";
import { downloadService } from "../../services/downloadService";
import { toast } from "./ToastContainer";

interface JobProgressViewProps {
  job: ProcessingJob;
  onCancel: () => void;
  onReset: () => void;
}

export const JobProgressView: React.FC<JobProgressViewProps> = ({
  job,
  onCancel,
  onReset,
}) => {
  const [customFilename, setCustomFilename] = useState(
    job.output?.filename || "",
  );
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    if (!job.output) return;
    try {
      const filename = customFilename || job.output.filename;
      if (job.output.blob) downloadService.downloadBlob(job.output.blob, filename);
      else if (typeof job.output.fileId === "string") await downloadService.downloadBackendFile(job.output.fileId, filename);
      else if (job.output.downloadUrl) await downloadService.downloadFromUrl(job.output.downloadUrl, filename);
      else throw new Error("DOWNLOAD_FAILED: no existe un archivo de salida.");
    } catch (error) {
      toast.error("No se pudo descargar", error instanceof Error ? error.message : "DOWNLOAD_FAILED");
    }
  };

  const handleCopyText = () => {
    if (job.output?.textResult) {
      navigator.clipboard.writeText(job.output.textResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Processing state
  if (
    job.status === "PROCESSING" ||
    job.status === "ANALYZING" ||
    job.status === "UPLOADING" ||
    job.status === "FINALIZING"
  ) {
    return (
      <div className="w-full rounded-2xl bg-[#101218] border border-indigo-500/30 p-6 shadow-xl flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin flex items-center justify-center mb-4" />

        <h3 className="text-base font-semibold text-white">
          Procesando {job.toolName}
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          {job.stageDescription}
        </p>

        {job.progress >= 0 ? (
          <div className="w-full max-w-md mt-4">
            <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
              <span>Progreso real</span>
              <span>{Math.round(job.progress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-200"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md mt-4">
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-500 animate-pulse w-2/3 mx-auto rounded-full" />
            </div>
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-5 px-4 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 text-rose-300 text-xs font-medium transition-colors"
        >
          Cancelar procesamiento
        </button>
      </div>
    );
  }

  // Failed state
  if (job.status === "FAILED") {
    return (
      <div className="w-full rounded-2xl bg-[#101218] border border-rose-500/30 p-6 shadow-xl text-slate-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white">
              Error durante el procesamiento
            </h3>
            <p className="text-xs text-rose-300 mt-1">
              {job.error?.message || "Ocurrió un fallo inesperado."}
            </p>
            {job.error?.details && (
              <p className="text-[11px] font-mono text-slate-500 mt-2 bg-black/30 p-2 rounded border border-white/[0.05]">
                {job.error.details}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reintentar con otro archivo</span>
          </button>
        </div>
      </div>
    );
  }

  // Completed state
  if (job.status === "COMPLETED" && job.output) {
    const originalSize = job.input?.size;
    const newSize = job.output.size;
    const savings =
      originalSize && newSize && originalSize > newSize
        ? Math.round(((originalSize - newSize) / originalSize) * 100)
        : null;

    return (
      <div className="w-full rounded-2xl bg-[#101218] border border-emerald-500/30 p-5 sm:p-6 shadow-2xl text-slate-100">
        <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              Operación completada con éxito
            </h3>
            <p className="text-xs text-slate-400">
              Archivo procesado y listo para descargar.
            </p>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <div className="p-3 rounded-xl bg-[#161922] border border-white/[0.05]">
            <span className="text-[11px] text-slate-400 uppercase font-mono">
              Entrada original
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-0.5 truncate">
              {job.input?.name || "Archivo de entrada"}
            </p>
            {originalSize && (
              <span className="text-xs text-slate-500 font-mono">
                {formatFileSize(originalSize)}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-[#161922] border border-white/[0.05]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-emerald-400 uppercase font-mono">
                Resultado final
              </span>
              {savings && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  -{savings}% Reducción
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-semibold text-white mt-0.5 truncate">
              {job.output.filename}
            </p>
            <span className="text-xs text-emerald-400/90 font-mono">
              {formatFileSize(newSize)}
            </span>
          </div>
        </div>

        {/* Custom text result preview if available */}
        {job.output.textResult && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-300">
                Salida generada:
              </span>
              <button
                onClick={handleCopyText}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copied ? "Copiado" : "Copiar texto"}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={job.output.textResult}
              className="w-full h-32 p-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-slate-200 resize-none focus:outline-none"
            />
          </div>
        )}

        {/* Download and Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
          {job.output.blob || job.output.fileId || job.output.downloadUrl ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={customFilename || job.output.filename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="Nombre del archivo"
                className="px-3 py-1.5 rounded-lg bg-[#08090D] border border-white/[0.1] text-xs font-mono text-slate-200 focus:outline-none w-full sm:w-56"
              />
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Descargar archivo</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <button
            onClick={onReset}
            className="px-3.5 py-1.5 rounded-xl border border-white/[0.1] hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors w-full sm:w-auto justify-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Procesar otro</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
