import React from 'react';
import { Star, Wrench } from 'lucide-react';
import { ToolDefinition } from '../../types';
import { IconRenderer } from './IconRenderer';
import { CapabilityBadge } from './Badge';
import { PlannedTool } from '../../registry/tools';
import { useServiceStatus } from '../../context/ServiceStatusContext';
import { getMissingServices, maintenanceTooltip } from '../../services/toolAvailability';

interface ToolCardProps {
  tool: ToolDefinition;
  isFavorite: boolean;
  onToggleFavorite: (toolId: string, e: React.MouseEvent) => void;
  onSelect: (tool: ToolDefinition) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  isFavorite,
  onToggleFavorite,
  onSelect
}) => {
  const { isServiceAvailable } = useServiceStatus();
  const missingServices = getMissingServices(tool, isServiceAvailable);
  const isMaintenance = missingServices.length > 0;
  const maintenanceMessage = isMaintenance ? maintenanceTooltip(missingServices) : undefined;

  return (
    <div
      id={`tool-card-${tool.id}`}
      title={maintenanceMessage}
      aria-disabled={isMaintenance || undefined}
      className={`group relative flex flex-col justify-between p-4 rounded-xl bg-[#101218] border border-white/[0.07] transition-all duration-200 text-left h-full ${
        isMaintenance
          ? 'opacity-60 border-amber-500/20 cursor-not-allowed'
          : 'cursor-pointer hover:border-indigo-500/40 hover:bg-[#161922] focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
      }`}
      onClick={isMaintenance ? undefined : () => onSelect(tool)}
      role={isMaintenance ? undefined : 'button'}
      tabIndex={isMaintenance ? -1 : 0}
      onKeyDown={isMaintenance ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(tool);
        }
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            isMaintenance
              ? 'bg-slate-500/10 border border-slate-500/20 text-slate-500'
              : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:text-indigo-300 group-hover:bg-indigo-500/20'
          }`}>
            <IconRenderer name={tool.icon} size={18} />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => onToggleFavorite(tool.id, e)}
              disabled={isMaintenance}
              className={`p-1 rounded-md transition-colors ${
                isMaintenance
                  ? 'text-slate-500 cursor-not-allowed opacity-50'
                  : isFavorite
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/40'
              }`}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <h3 className={`text-sm font-semibold tracking-tight leading-snug line-clamp-2 ${
          isMaintenance ? 'text-slate-400' : 'text-slate-100 group-hover:text-white'
        }`}>
          {tool.name}
        </h3>
        <p className={`text-xs leading-relaxed line-clamp-2 mt-1 ${
          isMaintenance ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {tool.description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-white/[0.04]">
        <CapabilityBadge mode={tool.processingMode} size="sm" />
        {tool.supportsBatch && !isMaintenance && (
          <span className="text-[10px] font-mono text-slate-500 font-medium">LOTE</span>
        )}
        {isMaintenance && (
          <span
            className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-300"
            title={maintenanceMessage}
          >
            <Wrench className="w-2.5 h-2.5" />
            Mantenimiento
          </span>
        )}
      </div>
    </div>
  );
};

// Non-interactive card for planned/coming-soon tools. It never calls an
// endpoint and never implies that processing exists yet.
export const ComingSoonCard: React.FC<{ tool: PlannedTool }> = ({ tool }) => (
  <div
    aria-disabled="true"
    title="Próximamente: esta herramienta aún no está disponible."
    className="group relative flex flex-col justify-between p-4 rounded-xl bg-[#101218]/60 border border-dashed border-white/[0.08] cursor-not-allowed text-left h-full"
  >
    <div>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="w-9 h-9 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-500">
          <IconRenderer name={tool.icon} size={18} />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-slate-300 tracking-tight leading-snug line-clamp-1">
        {tool.name}
      </h3>
      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
        {tool.description}
      </p>
    </div>
    <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-white/[0.04]">
      <span className="inline-flex items-center rounded-md border border-slate-600/40 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400">
        Próximamente
      </span>
    </div>
  </div>
);
