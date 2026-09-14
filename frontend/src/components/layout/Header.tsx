import React, { useEffect, useState } from "react";
import {
  Search,
  History,
  Star,
  Settings,
  Menu,
  X,
  Command,
  DownloadCloud,
  Server,
  CheckCircle2,
} from "lucide-react";
import { VelyxoraLogo } from "../logo/VelyxoraLogo";
import { apiClient, BackendHealth } from "../../services/apiClient";

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onNavigate: (view: string, param?: any) => void;
  activeView: string;
  favoritesCount: number;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onNavigate,
  activeView,
  favoritesCount,
  isMobileMenuOpen,
  onToggleMobileMenu,
}) => {
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(
    null,
  );

  useEffect(() => {
    apiClient.checkHealth().then((health) => {
      setBackendHealth(health);
    });
  }, []);
  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-[#08090D]/90 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
      {/* Brand Logo & Sidebar Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0"
          aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          title={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5 text-indigo-400" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        <div
          onClick={() => onNavigate("home")}
          className="cursor-pointer transition-opacity hover:opacity-95 shrink-0"
        >
          <VelyxoraLogo variant="full" size="md" />
        </div>
      </div>

      {/* Center Search / Command Palette Bar */}
      <button
        onClick={onOpenCommandPalette}
        className="flex-1 min-w-0 max-w-xs md:max-w-sm lg:max-w-md hidden sm:flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#101218] border border-white/[0.08] hover:border-indigo-500/40 text-slate-400 hover:text-slate-200 transition-all text-xs group"
        title="Buscar herramientas, formatos o pegar enlace (Ctrl+K)"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0" />
          <span className="truncate hidden xl:inline">
            Buscar herramientas, formatos o pegar enlace...
          </span>
          <span className="truncate hidden md:inline xl:hidden">
            Buscar herramientas o formatos...
          </span>
          <span className="truncate inline md:hidden">
            Buscar herramientas...
          </span>
        </div>
        <kbd className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700 shrink-0 ml-1.5">
          <Command className="w-2.5 h-2.5" /> K
        </kbd>
      </button>

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Backend Engine Status Badge */}
        {backendHealth && (
          <div
            className={`hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              backendHealth.status === "ok"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
            title={`Backend Velyxora Activo | FFmpeg: ${backendHealth.services.ffmpeg ? "Conectado" : "No disponible"} | LibreOffice: ${backendHealth.services.libreOffice ? "Conectado" : "Pendiente"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Backend:{" "}
              {backendHealth.services.ffmpeg ? "FFmpeg Activo" : "Online"}
            </span>
          </div>
        )}

        {/* Mobile Search trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] sm:hidden transition-colors"
          title="Buscar"
          aria-label="Buscar"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Media Downloader Shortcut */}
        <button
          onClick={() => onNavigate("media-downloader")}
          className={`hidden md:flex px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold items-center gap-1.5 transition-all ${
            activeView === "media-downloader"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-[#101218] border border-white/[0.08] text-slate-300 hover:text-white hover:border-indigo-500/30"
          }`}
          title="Descargar Medios"
        >
          <DownloadCloud className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="hidden xl:inline">Descargar Medios</span>
        </button>

        {/* Favorites */}
        <button
          onClick={() => onNavigate("favorites")}
          className={`hidden sm:inline-flex relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] transition-colors ${
            activeView === "favorites" ? "text-amber-400 bg-[#161922]" : ""
          }`}
          title="Favoritos"
          aria-label="Favoritos"
        >
          <Star
            className="w-4 h-4"
            fill={activeView === "favorites" ? "currentColor" : "none"}
          />
          {favoritesCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-mono font-bold flex items-center justify-center">
              {favoritesCount}
            </span>
          )}
        </button>

        {/* History */}
        <button
          onClick={() => onNavigate("history")}
          className={`hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] transition-colors ${
            activeView === "history" ? "text-indigo-400 bg-[#161922]" : ""
          }`}
          title="Historial"
          aria-label="Historial"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={() => onNavigate("settings")}
          className={`hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] transition-colors ${
            activeView === "settings" ? "text-indigo-400 bg-[#161922]" : ""
          }`}
          title="Configuración"
          aria-label="Configuración"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
