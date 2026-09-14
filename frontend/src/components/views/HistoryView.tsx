import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, History, Trash2 } from "lucide-react";
import { historyService } from "../../services/historyService";
import { settingsService } from "../../services/settingsService";
import { HistoryItem, ToolDefinition } from "../../types";
import { formatFileSize } from "../../services/detectionService";
import { getToolById } from "../../registry/tools";
import { toast } from "../common/ToastContainer";

interface Props { onSelectTool: (tool: ToolDefinition) => void; onBack: () => void; }
type Filter = "ALL" | HistoryItem["status"];
const labels = { COMPLETED: "Completado", FAILED: "Fallido", CANCELLED: "Cancelado" };

export const HistoryView: React.FC<Props> = ({ onSelectTool, onBack }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  useEffect(() => setHistory(historyService.getHistory()), []);
  const shown = filter === "ALL" ? history : history.filter((item) => item.status === filter);
  const clear = () => {
    if (settingsService.getSettings().confirmBeforeClearHistory && !window.confirm("¿Quieres limpiar todo el historial local?")) return;
    historyService.clearHistory(); setHistory([]); toast.info("Historial eliminado");
  };
  const remove = (id: string) => { historyService.deleteItem(id); setHistory(historyService.getHistory()); };

  return <div className="w-full max-w-4xl mx-auto space-y-6">
    <button onClick={onBack} className="min-h-11 px-3 rounded-xl border border-white/10 text-sm text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400 flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Regresar</button>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
      <div><h2 className="text-xl font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-400" />Historial de procesamiento</h2><p className="text-xs text-slate-400">Registro local; nunca guarda el contenido de tus archivos.</p></div>
      {history.length > 0 && <button onClick={clear} className="min-h-11 px-3 rounded-lg border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"><Trash2 className="w-4 h-4" />Limpiar historial</button>}
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Filtrar historial">{(["ALL", "COMPLETED", "FAILED", "CANCELLED"] as Filter[]).map((value) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`min-h-10 px-3 rounded-lg text-xs border ${filter === value ? "bg-indigo-600 border-indigo-500 text-white" : "border-white/10 text-slate-300"}`}>{value === "ALL" ? "Todos" : labels[value]}</button>)}</div>
    {shown.length ? <div className="space-y-3">{shown.map((item) => { const tool = getToolById(item.toolId); return <article key={item.id} className="p-4 rounded-xl bg-[#101218] border border-white/[0.06] flex flex-col sm:flex-row gap-3 justify-between">
      <div className="min-w-0"><div className="flex flex-wrap gap-2 items-center"><h3 className="text-sm font-semibold text-white truncate">{item.inputName}</h3><span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300">{item.toolName}</span><span className={`text-[10px] px-2 py-1 rounded ${item.status === "COMPLETED" ? "text-emerald-300 bg-emerald-500/10" : item.status === "FAILED" ? "text-rose-300 bg-rose-500/10" : "text-amber-300 bg-amber-500/10"}`}>{labels[item.status]}</span></div>
      <p className="mt-2 text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleString()} · {item.processingLocation === "server" ? "Servidor" : "Local"}{item.inputSize ? ` · ${formatFileSize(item.inputSize)}` : ""}{item.outputSize ? ` → ${formatFileSize(item.outputSize)}` : ""}</p>
      {item.outputFileId && <p className="mt-1 text-[11px] text-slate-500">El archivo es temporal y puede haber expirado.</p>}</div>
      <div className="flex gap-2">{tool && <button onClick={() => onSelectTool(tool)} className="min-h-11 px-3 rounded-lg bg-slate-800 text-xs text-white flex items-center gap-1">Abrir herramienta<ArrowRight className="w-3 h-3" /></button>}<button onClick={() => remove(item.id)} aria-label={`Eliminar ${item.inputName} del historial`} className="min-w-11 min-h-11 rounded-lg text-slate-400 hover:text-rose-400"><Trash2 className="w-4 h-4 mx-auto" /></button></div>
    </article>; })}</div> : <div className="py-16 text-center rounded-2xl bg-[#101218] border border-white/[0.06]"><History className="w-10 h-10 text-slate-600 mx-auto" /><h3 className="mt-3 text-sm font-semibold text-slate-300">Aún no tienes procesamientos recientes.</h3></div>}
  </div>;
};
