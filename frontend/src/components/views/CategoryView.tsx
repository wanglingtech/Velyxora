import React, { useState } from 'react';
import { Search, Filter, ArrowLeft } from 'lucide-react';
import { ToolCard } from '../common/ToolCard';
import { PUBLIC_TOOL_REGISTRY, CATEGORIES_CONFIG, searchTools } from '../../registry/tools';
import { ToolDefinition } from '../../types';

interface CategoryViewProps {
  currentCategory: string;
  onSelectCategory: (cat: string) => void;
  onSelectTool: (tool: ToolDefinition) => void;
  favorites: string[];
  onToggleFavorite: (toolId: string, e: React.MouseEvent) => void;
  onBack: () => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  currentCategory,
  onSelectCategory,
  onSelectTool,
  favorites,
  onToggleFavorite,
  onBack
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');

  const categoryConfig = CATEGORIES_CONFIG.find((c) => c.id === currentCategory) || CATEGORIES_CONFIG[0];

  const toolsInCategory = currentCategory === 'all'
    ? PUBLIC_TOOL_REGISTRY
    : PUBLIC_TOOL_REGISTRY.filter((t) => t.category === currentCategory);

  // Extract unique subcategories
  const subcategories = Array.from(
    new Set(toolsInCategory.map((t) => t.subcategory).filter(Boolean))
  ) as string[];

  const filteredTools = toolsInCategory.filter((t) => {
    const matchesSub = selectedSubcategory === 'all' || t.subcategory === selectedSubcategory;
    const matchesQuery =
      !searchFilter.trim() ||
      searchTools(searchFilter).some((match) => match.id === t.id);
    return matchesSub && matchesQuery;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <button onClick={onBack} className="min-h-11 px-3 rounded-xl border border-white/10 text-sm text-slate-300 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-indigo-400"><ArrowLeft className="w-4 h-4" />Regresar</button>
      {/* Category Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {categoryConfig.name}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {filteredTools.length} herramientas disponibles en esta categoría.
          </p>
        </div>

        {/* In-category Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrar herramientas..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#101218] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Subcategories Filter Chips */}
      {subcategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedSubcategory('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              selectedSubcategory === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-[#101218] text-slate-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            Todas
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubcategory(sub)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                selectedSubcategory === sub
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#101218] text-slate-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Tools Grid */}
      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isFavorite={favorites.includes(tool.id)}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelectTool}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-500 rounded-2xl bg-[#101218] border border-white/[0.06]">
          <p className="text-sm">No se encontraron herramientas con el filtro actual.</p>
          <button
            onClick={() => {
              setSearchFilter('');
              setSelectedSubcategory('all');
            }}
            className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Restablecer filtros
          </button>
        </div>
      )}
    </div>
  );
};
