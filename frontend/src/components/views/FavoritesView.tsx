import React from 'react';
import { Star } from 'lucide-react';
import { ToolCard } from '../common/ToolCard';
import { TOOL_REGISTRY } from '../../registry/tools';
import { ToolDefinition } from '../../types';

interface FavoritesViewProps {
  favorites: string[];
  onToggleFavorite: (toolId: string, e: React.MouseEvent) => void;
  onSelectTool: (tool: ToolDefinition) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  onToggleFavorite,
  onSelectTool
}) => {
  const favoriteTools = TOOL_REGISTRY.filter((t) => favorites.includes(t.id));

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Star className="w-5 h-5" fill="currentColor" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Herramientas Favoritas</h2>
          <p className="text-xs text-slate-400">
            Acceso rápido a las herramientas que utilizas con mayor frecuencia.
          </p>
        </div>
      </div>

      {favoriteTools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {favoriteTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isFavorite={true}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelectTool}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center rounded-2xl bg-[#101218] border border-white/[0.06] space-y-2">
          <Star className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No tienes favoritos guardados</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Haz clic en la estrella de cualquier tarjeta de herramienta para fijarla aquí y en la barra lateral.
          </p>
        </div>
      )}
    </div>
  );
};
