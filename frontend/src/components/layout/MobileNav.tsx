import React from 'react';
import { Home, Search, History, Settings, DownloadCloud } from 'lucide-react';

interface MobileNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onOpenSearch: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeView,
  onNavigate,
  onOpenSearch
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden h-14 bg-[#08090D]/95 backdrop-blur-md border-t border-white/[0.08] flex items-center justify-around px-2">
      <button
        onClick={() => onNavigate('home')}
        className={`flex flex-col items-center justify-center min-w-[48px] min-h-[44px] transition-colors ${
          activeView === 'home' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Home className="w-4 h-4" />
        <span className="text-[10px] mt-0.5 font-medium">Inicio</span>
      </button>

      <button
        onClick={onOpenSearch}
        className="flex flex-col items-center justify-center min-w-[48px] min-h-[44px] text-slate-400 hover:text-white transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="text-[10px] mt-0.5 font-medium">Buscar</span>
      </button>

      <button
        onClick={() => onNavigate('media-downloader')}
        className={`flex flex-col items-center justify-center min-w-[48px] min-h-[44px] transition-colors ${
          activeView === 'media-downloader' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
        }`}
      >
        <DownloadCloud className="w-4 h-4" />
        <span className="text-[10px] mt-0.5 font-medium">Medios</span>
      </button>

      <button
        onClick={() => onNavigate('history')}
        className={`flex flex-col items-center justify-center min-w-[48px] min-h-[44px] transition-colors ${
          activeView === 'history' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'
        }`}
      >
        <History className="w-4 h-4" />
        <span className="text-[10px] mt-0.5 font-medium">Historial</span>
      </button>

      <button
        onClick={() => onNavigate('settings')}
        className={`flex flex-col items-center justify-center min-w-[48px] min-h-[44px] transition-colors ${
          activeView === 'settings' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Settings className="w-4 h-4" />
        <span className="text-[10px] mt-0.5 font-medium">Ajustes</span>
      </button>
    </nav>
  );
};
