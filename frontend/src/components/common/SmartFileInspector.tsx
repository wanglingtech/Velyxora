import React from 'react';
import { File, Clock, Maximize, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { DetectedFileInfo, ToolDefinition } from '../../types';
import { TOOL_REGISTRY } from '../../registry/tools';
import { IconRenderer } from './IconRenderer';

interface SmartFileInspectorProps {
  info: DetectedFileInfo;
  onSelectTool: (tool: ToolDefinition, file: File) => void;
  onClear: () => void;
}

export const SmartFileInspector: React.FC<SmartFileInspectorProps> = ({
  info,
  onSelectTool,
  onClear
}) => {
  const recommendedTools = info.recommendedToolIds
    .map((id) => TOOL_REGISTRY.find((t) => t.id === id))
    .filter((t): t is ToolDefinition => Boolean(t))
    .slice(0, 6);

  return (
    <div className="w-full rounded-2xl bg-[#101218] border border-indigo-500/30 p-4 sm:p-5 shadow-2xl shadow-indigo-950/20 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          {info.previewUrl && info.mimeType.startsWith('image/') ? (
            <img
              src={info.previewUrl}
              alt={info.name}
              className="w-12 h-12 rounded-lg object-cover border border-white/[0.1] shrink-0 bg-black/40"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <File className="w-6 h-6" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white truncate">{info.name}</h4>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 font-semibold">
                {info.extension || 'FILE'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400 font-mono">
              <span>{info.formattedSize}</span>
              {info.width && info.height && (
                <span className="flex items-center gap-1">
                  <Maximize className="w-3 h-3 text-slate-500" />
                  {info.width}×{info.height} {info.aspectRatio && `(${info.aspectRatio})`}
                </span>
              )}
              {info.formattedDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {info.formattedDuration}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClear}
          className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          title="Descartar archivo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recommended Actions */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Acciones sugeridas para este archivo
          </span>
          <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Procesamiento local
          </span>
        </div>

        {recommendedTools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recommendedTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool, info.file)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#161922] hover:bg-indigo-600/20 border border-white/[0.06] hover:border-indigo-500/40 text-left transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300 shrink-0">
                    <IconRenderer name={tool.icon} size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                      {tool.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {tool.subcategory || tool.category}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">
            No se encontraron herramientas específicas automáticas para este formato MIME. Puedes explorar el catálogo completo.
          </p>
        )}
      </div>
    </div>
  );
};
