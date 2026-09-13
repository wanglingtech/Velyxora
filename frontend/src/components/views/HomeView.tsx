import React from 'react';
import { Sparkles, Shield, Zap, Layers, ArrowRight } from 'lucide-react';
import { UniversalInput } from '../common/UniversalInput';
import { ToolCard } from '../common/ToolCard';
import { SmartFileInspector } from '../common/SmartFileInspector';
import { TOOL_REGISTRY, CATEGORIES_CONFIG } from '../../registry/tools';
import { ToolDefinition, DetectedFileInfo } from '../../types';

interface HomeViewProps {
  onSelectTool: (tool: ToolDefinition, file?: File) => void;
  onSelectCategory: (categoryId: string) => void;
  onOpenMediaDownloader: (url?: string) => void;
  favorites: string[];
  onToggleFavorite: (toolId: string, e: React.MouseEvent) => void;
  detectedFile: DetectedFileInfo | null;
  onClearDetectedFile: () => void;
  onFileDetected: (info: DetectedFileInfo) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectTool,
  onSelectCategory,
  onOpenMediaDownloader,
  favorites,
  onToggleFavorite,
  detectedFile,
  onClearDetectedFile,
  onFileDetected
}) => {
  const popularTools = TOOL_REGISTRY.filter((t) => t.popular).slice(0, 8);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-3 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-medium">
          <Sparkles className="w-3 h-3" />
          <span>One workspace for every file</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
          ¿Qué quieres hacer hoy?
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Convierte, procesa, edita y analiza archivos multimedia y enlaces de video directamente en tu navegador.
        </p>
      </div>

      {/* Universal Input Dropzone */}
      <div className="max-w-3xl mx-auto">
        {detectedFile ? (
          <SmartFileInspector
            info={detectedFile}
            onSelectTool={(tool, file) => onSelectTool(tool, file)}
            onClear={onClearDetectedFile}
          />
        ) : (
          <UniversalInput
            onFileDetected={onFileDetected}
            onUrlDetected={(url) => onOpenMediaDownloader(url)}
          />
        )}
      </div>

      {/* Popular Tools Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Herramientas populares
            </h2>
            <p className="text-xs text-slate-400">Las utilidades más frecuentes listas para usar.</p>
          </div>
          <button
            onClick={() => onSelectCategory('all')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Ver catálogo completo ({TOOL_REGISTRY.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {popularTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isFavorite={favorites.includes(tool.id)}
              onToggleFavorite={onToggleFavorite}
              onSelect={(t) => onSelectTool(t)}
            />
          ))}
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Explorar por categoría
        </h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES_CONFIG.filter((c) => c.id !== 'all').map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="px-3.5 py-2 rounded-xl bg-[#101218] border border-white/[0.06] hover:border-indigo-500/40 hover:bg-[#161922] text-xs font-medium text-slate-300 hover:text-white transition-all"
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Features / Privacy Callout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.06]">
        <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.05] space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Shield className="w-4 h-4" />
          </div>
          <h4 className="text-xs sm:text-sm font-semibold text-white">Privacidad Local Garantizada</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Las conversiones de imagen, audio, JSON y códigos QR se ejecutan en tu hardware sin subir tus archivos a servidores externos.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.05] space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="text-xs sm:text-sm font-semibold text-white">Velocidad Nativa</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Aceleración por Canvas 2D, Web Audio API y Web Crypto para resultados instantáneos sin colas de espera.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.05] space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
          <h4 className="text-xs sm:text-sm font-semibold text-white">Arquitectura Modular</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Contratos de API desacoplados y adaptadores de medios preparados para conectar microservicios backend en VS Code.
          </p>
        </div>
      </div>
    </div>
  );
};
