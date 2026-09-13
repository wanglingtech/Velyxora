import React, { useState, useEffect } from 'react';
import { History, Trash2, Clock, FileCheck, ArrowRight, ShieldCheck } from 'lucide-react';
import { historyService } from '../../services/historyService';
import { HistoryItem, ToolDefinition } from '../../types';
import { formatFileSize } from '../../services/detectionService';
import { getToolById } from '../../registry/tools';
import { toast } from '../common/ToastContainer';

interface HistoryViewProps {
  onSelectTool: (tool: ToolDefinition) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelectTool }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(historyService.getHistory());
  }, []);

  const handleClear = () => {
    historyService.clearHistory();
    setHistory([]);
    toast.info('Historial eliminado');
  };

  const handleDeleteItem = (id: string) => {
    historyService.deleteItem(id);
    setHistory(historyService.getHistory());
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Historial de Procesamiento</h2>
            <p className="text-xs text-slate-400">
              Registro local privado. No se almacenan archivos pesados en el almacenamiento del navegador.
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Borrar historial</span>
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-2.5">
          {history.map((item) => {
            const tool = getToolById(item.toolId);
            const dateStr = new Date(item.timestamp).toLocaleString();

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#101218] border border-white/[0.06] hover:border-white/[0.12] transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{item.inputName}</h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {item.toolName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-mono">
                      {item.inputSize && <span>{formatFileSize(item.inputSize)}</span>}
                      {item.outputSize && (
                        <>
                          <span>→</span>
                          <span className="text-emerald-400">{formatFileSize(item.outputSize)}</span>
                        </>
                      )}
                      <span className="text-slate-500">• {dateStr}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {tool && (
                    <button
                      onClick={() => onSelectTool(tool)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <span>Abrir herramienta</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    title="Eliminar del historial"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center rounded-2xl bg-[#101218] border border-white/[0.06] space-y-2">
          <History className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">Aún no has procesado ningún archivo</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Las conversiones y tareas que realices aparecerán listadas aquí con sus métricas de compresión.
          </p>
        </div>
      )}
    </div>
  );
};
