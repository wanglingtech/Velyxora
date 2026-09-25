import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Move, RefreshCw, Share2, ZoomIn } from "lucide-react";
import { ToolDefinition } from "../../../types";
import { downloadService } from "../../../services/downloadService";
import { historyService } from "../../../services/historyService";
import { shareService } from "../../../services/shareService";
import { formatFileSize } from "../../../services/detectionService";
import { toast } from "../../common/ToastContainer";
import {
  DEFAULT_STICKER_EDIT,
  generateSticker,
  renderStickerCanvas,
  STICKER_FILENAME,
  STICKER_LIMITS,
  StickerEdit,
  StickerImage,
  StickerResult,
  validateAndDecodeStickerImage,
} from "../../../services/stickerMakerService";

type Phase = "empty" | "loading" | "editing" | "generating" | "compatible" | "oversize" | "error";

export function StickerMakerTool({ tool, initialFile }: { tool: ToolDefinition; initialFile?: File }) {
  const [phase, setPhase] = useState<Phase>("empty");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [image, setImage] = useState<StickerImage | null>(null);
  const [edit, setEdit] = useState<StickerEdit>({ ...DEFAULT_STICKER_EDIT });
  const [result, setResult] = useState<StickerResult | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<StickerImage | null>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => () => imageRef.current?.close?.(), []);
  useEffect(() => { if (image && canvasRef.current) renderStickerCanvas(canvasRef.current, image, edit); }, [image, edit]);

  const selectFile = useCallback(async (file: File) => {
    setPhase("loading"); setError(""); setResult(null);
    try {
      const decoded = await validateAndDecodeStickerImage(file);
      imageRef.current?.close?.(); imageRef.current = decoded;
      setImage(decoded); setSourceFile(file); setEdit({ ...DEFAULT_STICKER_EDIT }); setPhase("editing");
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "STICKER_IMAGE_INVALID";
      const messages: Record<string, string> = {
        STICKER_MIME_UNSUPPORTED: "Selecciona una imagen PNG, JPG/JPEG o WebP.",
        STICKER_INPUT_TOO_LARGE: `La imagen supera el límite local de ${formatFileSize(STICKER_LIMITS.maxInputBytes)}.`,
        STICKER_DIMENSIONS_TOO_LARGE: "La imagen excede los límites seguros de dimensiones o píxeles.",
        STICKER_SIGNATURE_INVALID: "El contenido no corresponde al formato declarado.",
        STICKER_IMAGE_CORRUPT: "El navegador no pudo decodificar la imagen.",
      };
      setError(messages[code] || "No se pudo cargar una imagen válida."); setPhase("error");
    }
  }, []);

  useEffect(() => { if (initialFile) void selectFile(initialFile); }, [initialFile, selectFile]);

  const resetEdit = () => { setEdit({ ...DEFAULT_STICKER_EDIT }); setResult(null); setPhase(image ? "editing" : "empty"); };
  const create = async () => {
    if (!image || !sourceFile || phase === "generating") return;
    setPhase("generating"); setError("");
    try {
      const next = await generateSticker(image, edit);
      setResult(next); setPhase(next.compatible ? "compatible" : "oversize");
      historyService.addItem({ toolId: tool.id, toolName: tool.name, inputName: sourceFile.name, inputSize: sourceFile.size, outputName: STICKER_FILENAME, outputSize: next.blob.size, category: "image", status: "COMPLETED", processingLocation: "local", creditsCost: 0 });
    } catch {
      setError("No fue posible generar un WebP válido en este navegador."); setPhase("error");
    }
  };
  const download = () => { if (result) downloadService.downloadBlob(result.blob, STICKER_FILENAME); };
  const share = async () => {
    if (!result) return;
    try {
      const outcome = await shareService.share({ kind: "file", title: "Sticker de VELYXORA", text: "Sticker generado localmente", getFile: async () => result.file, download });
      if (outcome.status === "fallback") toast.info("Compartir no está disponible", "Se descargó el sticker como alternativa.");
    } catch { toast.error("No se pudo compartir", "El navegador no pudo abrir el menú para compartir."); }
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerRef.current || pointerRef.current.id !== event.pointerId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = STICKER_LIMITS.outputSize / rect.width;
    const dx = (event.clientX - pointerRef.current.x) * factor;
    const dy = (event.clientY - pointerRef.current.y) * factor;
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setEdit((old) => ({ ...old, offsetX: old.offsetX + dx, offsetY: old.offsetY + dy }));
  };
  const pointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
  };

  return <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="rounded-2xl border border-white/10 bg-[#101218] p-4 sm:p-5">
        {!image ? <label className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 px-6 text-center hover:border-indigo-500/40">
          {phase === "loading" ? <Loader2 className="h-9 w-9 animate-spin text-indigo-300" /> : <ImagePlus className="h-9 w-9 text-indigo-300" />}
          <strong className="mt-3">{phase === "loading" ? "Validando imagen…" : "Seleccionar imagen"}</strong>
          <span className="mt-2 text-xs text-slate-400">PNG, JPG/JPEG o WebP · máximo {formatFileSize(STICKER_LIMITS.maxInputBytes)}</span>
          <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void selectFile(event.target.files[0])} />
        </label> : <div>
          <div className="mx-auto aspect-square w-full max-w-[32rem] overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(45deg,#20232d_25%,transparent_25%),linear-gradient(-45deg,#20232d_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#20232d_75%),linear-gradient(-45deg,transparent_75%,#20232d_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0]">
            <canvas ref={canvasRef} aria-label="Vista previa cuadrada del sticker" className="h-full w-full touch-none cursor-grab active:cursor-grabbing" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} />
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400"><Move className="h-4 w-4" /> Arrastra para encuadrar. El tablero visible representa transparencia.</p>
        </div>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-300">{error}</p>}
      </div>
      <aside className="space-y-4 rounded-2xl border border-white/10 bg-[#101218] p-5">
        <div><p className="text-xs font-bold tracking-widest text-indigo-300">STICKER WEBP</p><p className="mt-2 text-sm text-slate-300">Salida exacta 512 × 512. Procesamiento local en tu dispositivo.</p></div>
        <label className="block text-sm"><span className="flex items-center justify-between"><span className="flex items-center gap-2"><ZoomIn className="h-4 w-4" /> Zoom</span><span>{edit.zoom.toFixed(2)}×</span></span><input className="mt-2 w-full accent-indigo-500" type="range" min={STICKER_LIMITS.minZoom} max={STICKER_LIMITS.maxZoom} step="0.05" value={edit.zoom} disabled={!image} onChange={(event) => setEdit((old) => ({ ...old, zoom: Number(event.target.value) }))} /></label>
        <button disabled={!image || phase === "generating"} onClick={resetEdit} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Restablecer</button>
        <button disabled={!image || phase === "generating"} onClick={create} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 font-semibold disabled:opacity-50">{phase === "generating" ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</> : "Generar sticker"}</button>
        {result && <div className={`rounded-xl border p-3 text-sm ${result.compatible ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200" : "border-amber-500/20 bg-amber-500/5 text-amber-200"}`}><strong>{result.compatible ? "Objetivo de tamaño alcanzado" : "Resultado fuera del objetivo"}</strong><p className="mt-1 text-xs">{formatFileSize(result.blob.size)} · calidad {(result.quality * 100).toFixed(0)}% · {result.attempts} intento(s)</p>{!result.compatible && <p className="mt-2 text-xs">No fue posible alcanzar 100 KB manteniendo la calidad mínima. Puedes descargarlo, pero no se presenta como compatible.</p>}</div>}
        {result && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"><button onClick={download} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10"><Download className="h-4 w-4" /> Descargar sticker</button><button onClick={() => void share()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-500/30 text-indigo-200"><Share2 className="h-4 w-4" /> Compartir</button></div>}
        <label className="block cursor-pointer text-center text-xs text-slate-400 underline">Elegir otra imagen<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void selectFile(event.target.files[0])} /></label>
      </aside>
    </div>
    <p className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">La imagen se recorta y convierte en este dispositivo; no se envía al servidor para crear el sticker. No elimina fondos ni instala el archivo automáticamente en WhatsApp.</p>
  </div>;
}
