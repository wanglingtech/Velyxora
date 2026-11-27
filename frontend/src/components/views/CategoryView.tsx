import React, { useMemo, useState } from 'react';
import { Search, ArrowLeft, AlertTriangle, Wrench } from 'lucide-react';
import { ToolCard, ComingSoonCard } from '../common/ToolCard';
import { CATEGORIES_CONFIG, getToolkitGroup, getToolsForGroup, getPlannedToolsForGroup, searchTools } from '../../registry/tools';
import { ToolDefinition } from '../../types';
<<<<<<< HEAD
import { useServiceStatus } from '../../context/serviceStatusContextValue';
=======
import { useServiceStatus } from '../../context/ServiceStatusContext';
>>>>>>> origin/main
import { countToolsInMaintenance, isToolInMaintenance } from '../../services/toolAvailability';

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
  onSelectCategory: _onSelectCategory,
  onSelectTool,
  favorites,
  onToggleFavorite,
  onBack
}) => {
  const { isServiceAvailable } = useServiceStatus();
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [showMaintenance, setShowMaintenance] = useState(false);

  const categoryName = currentCategory === 'all'
    ? 'Todas las herramientas'
    : getToolkitGroup(currentCategory)?.name
      || CATEGORIES_CONFIG.find((c) => c.id === currentCategory)?.name
      || 'Todas las herramientas';

  const toolsInCategory = useMemo(() => getToolsForGroup(currentCategory), [currentCategory]);
  const plannedTools = useMemo(() => getPlannedToolsForGroup(currentCategory), [currentCategory]);
  const searchActive = searchFilter.trim().length > 0;
  const searchResults = useMemo(
    () => (searchActive ? searchTools(searchFilter) : []),
    [searchActive, searchFilter]
  );
  const showPlanned = plannedTools.length > 0 && selectedSubcategory === 'all' && !searchActive;
  const displayTitle = searchActive ? 'Resultados de búsqueda' : categoryName;

  // Extract unique subcategories
  const subcategories = useMemo(
    () => Array.from(new Set(toolsInCategory.map((t) => t.subcategory).filter(Boolean))) as string[],
    [toolsInCategory]
  );

  const maintenanceCount = useMemo(
    () => countToolsInMaintenance(searchActive ? searchResults : toolsInCategory, isServiceAvailable),
    [searchActive, searchResults, toolsInCategory, isServiceAvailable]
  );

  const filteredTools = useMemo(() => {
    // While searching, results come from every category so the user never
    // misses a tool because it lives outside the current section.
    const sourceTools = searchActive ? searchResults : toolsInCategory;
    return sourceTools.filter((t) => {
      const matchesSub = searchActive || selectedSubcategory === 'all' || t.subcategory === selectedSubcategory;
      // Tools whose backend service is in maintenance are hidden by default so
      // users do not click into a dead action; the toggle reveals them.
      const matchesMaintenance = showMaintenance || !isToolInMaintenance(t, isServiceAvailable);
      return matchesSub && matchesMaintenance;
    });
  }, [searchActive, searchResults, toolsInCategory, selectedSubcategory, showMaintenance, isServiceAvailable]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <button onClick={onBack} className="min-h-11 px-3 rounded-xl border border-white/10 text-sm text-slate-300 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-indigo-400"><ArrowLeft className="w-4 h-4" />Regresar</button>
      {/* Category Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {displayTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {searchActive
              ? `${filteredTools.length} resultados en todas las categorías.`
              : `${filteredTools.length} herramientas disponibles en esta categoría.`}
            {maintenanceCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-300"
                title={`${maintenanceCount} herramienta(s) dependen de un servicio en mantenimiento y se ocultan por defecto. Las herramientas locales siguen funcionando.`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {maintenanceCount} en mantenimiento
              </span>
            )}
          </p>
        </div>

        {/* In-category Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar en todas las herramientas..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#101218] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Subcategories Filter Chips + Maintenance Toggle */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
        {subcategories.length > 0 && !searchActive && (
          <>
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
          </>
        )}
        <label
          className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors bg-[#101218] text-slate-400 hover:text-white border border-white/[0.06] cursor-pointer"
          title="Las herramientas que dependen de un servicio en mantenimiento se ocultan por defecto. Activa esta opción para verlas atenuadas y saber por qué no están disponibles."
        >
          <input
            type="checkbox"
            checked={showMaintenance}
            onChange={(e) => setShowMaintenance(e.target.checked)}
            className="w-3.5 h-3.5 accent-indigo-500 rounded border-slate-600"
          />
          <span className="flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            Mostrar en mantenimiento
          </span>
        </label>
      </div>

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
      ) : showPlanned ? null : (
        <div className="py-16 text-center text-slate-500 rounded-2xl bg-[#101218] border border-white/[0.06]">
          <p className="text-sm">No se encontraron herramientas con el filtro actual.</p>
          <button
            onClick={() => {
              setSearchFilter('');
              setSelectedSubcategory('all');
              setShowMaintenance(true);
            }}
            className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Restablecer filtros
          </button>
        </div>
      )}

      {showPlanned && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Próximamente
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {plannedTools.map((tool) => (
              <ComingSoonCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
