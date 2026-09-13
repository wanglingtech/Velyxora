import React from 'react';
import { Star } from 'lucide-react';
import { ToolDefinition } from '../../types';
import { IconRenderer } from './IconRenderer';
import { CapabilityBadge } from './Badge';

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
  return (
    <div
      id={`tool-card-${tool.id}`}
      onClick={() => onSelect(tool)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(tool);
        }
      }}
      className="group relative flex flex-col justify-between p-4 rounded-xl bg-[#101218] border border-white/[0.07] hover:border-indigo-500/40 hover:bg-[#161922] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-left h-full"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300 group-hover:bg-indigo-500/20 transition-colors">
            <IconRenderer name={tool.icon} size={18} />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => onToggleFavorite(tool.id, e)}
              className={`p-1 rounded-md transition-colors ${
                isFavorite
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

        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white tracking-tight leading-snug line-clamp-1">
          {tool.name}
        </h3>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          {tool.description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-white/[0.04]">
        <CapabilityBadge mode={tool.processingMode} size="sm" />
        {tool.supportsBatch && (
          <span className="text-[10px] font-mono text-slate-500 font-medium">LOTE</span>
        )}
      </div>
    </div>
  );
};
