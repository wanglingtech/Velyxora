import React, { useEffect } from 'react';
import {
  Home,
  DownloadCloud,
  Image,
  Video,
  Music,
  Files,
  Code,
  MessageCircle,
  RefreshCw,
  Wrench,
  History,
  Star,
  Settings,
  ShieldCheck,
  Heart,
  X
} from 'lucide-react';
import { TOOLKIT_GROUPS, getToolsForGroup } from '../../registry/tools';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';

interface SidebarProps {
  activeView: string;
  activeCategory: string;
  onNavigate: (view: string, param?: any) => void;
  favoritesCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  activeCategory,
  onNavigate,
  favoritesCount,
  isOpenMobile,
  onCloseMobile
}) => {
  // Prevent background scrolling on all devices while sidebar is open
  useEffect(() => {
    if (!isOpenMobile) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar width to prevent layout shift
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Handle Escape key to close menu
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpenMobile, onCloseMobile]);

  const categoryIcons: Record<string, React.ReactNode> = {
    multimedia: <Video className="w-4 h-4" />,
    documents: <Files className="w-4 h-4" />,
    'audio-speech': <Music className="w-4 h-4" />,
    images: <Image className="w-4 h-4" />,
    whatsapp: <MessageCircle className="w-4 h-4" />,
    converters: <RefreshCw className="w-4 h-4" />,
    utilities: <Wrench className="w-4 h-4" />,
    'dev-tools': <Code className="w-4 h-4" />
  };

  const getCategoryCount = (catId: string) => getToolsForGroup(catId).length;

  const handleNav = (view: string, param?: any) => {
    onNavigate(view, param);
    onCloseMobile();
  };

  if (!isOpenMobile) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Menú lateral de navegación"
    >
      {/* Dimmed Backdrop: clicking any empty space closes the menu */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200 cursor-pointer touch-none"
        onClick={onCloseMobile}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => e.preventDefault()}
        title="Haz clic en cualquier espacio para cerrar el menú"
        aria-label="Cerrar menú"
      />

      {/* Drawer Panel - slides in from left */}
      <div
        className="relative z-10 w-72 sm:w-80 max-w-[85vw] h-full bg-[#08090D] shadow-2xl border-r border-white/[0.08] flex flex-col animate-in slide-in-from-left duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header with Logo & Close Button */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.08] shrink-0">
          <div
            onClick={() => handleNav('home')}
            className="cursor-pointer transition-opacity hover:opacity-90"
          >
            <VelyxoraLogo variant="full" size="sm" />
          </div>

          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Cerrar menú (Esc)"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6 select-none">
          {/* Main Section */}
          <div className="space-y-1">
            <button
              onClick={() => handleNav('home')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'home'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#101218]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Home className="w-4 h-4 text-indigo-400" />
                <span>Inicio</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('media-downloader')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'media-downloader'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#101218]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <DownloadCloud className="w-4 h-4 text-sky-400" />
                <span>Descargar Medios</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 font-bold">
                URL
              </span>
            </button>
          </div>

          {/* Categories Section */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Categorías de Herramientas
            </div>

            {TOOLKIT_GROUPS.map((cat) => {
              const count = getCategoryCount(cat.id);
              const isActive = activeView === 'category' && activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleNav('category', cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-white border border-indigo-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#101218]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={isActive ? 'text-indigo-400' : 'text-slate-500'}>
                      {categoryIcons[cat.id] || <Wrench className="w-4 h-4" />}
                    </span>
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">{count}</span>
                </button>
              );
            })}
          </div>

          {/* User Space */}
          <div className="space-y-1 pt-2 border-t border-white/[0.06]">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Mi Espacio
            </div>

            <button
              onClick={() => handleNav('favorites')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeView === 'favorites'
                  ? 'bg-[#161922] text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101218]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4 text-amber-400" />
                <span>Favoritos</span>
              </div>
              {favoritesCount > 0 && (
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  {favoritesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleNav('history')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeView === 'history'
                  ? 'bg-[#161922] text-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101218]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Historial Local</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('settings')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeView === 'settings'
                  ? 'bg-[#161922] text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101218]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Configuración</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('support')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeView === 'support'
                  ? 'bg-[#161922] text-rose-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101218]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-rose-400" />
                <span>Apoyar a VELYXORA</span>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Privacy Status Card */}
        <div className="p-3 border-t border-white/[0.08] bg-[#0A0C11] shrink-0">
          <div className="p-3 rounded-xl bg-[#101218] border border-white/[0.05]">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Motor Client-First</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              Archivos procesados en tu navegador con total soberanía y seguridad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
