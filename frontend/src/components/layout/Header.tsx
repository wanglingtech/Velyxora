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
  UserCircle,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { VelyxoraLogo } from "../logo/VelyxoraLogo";
import { apiClient, BackendHealth } from "../../services/apiClient";
import {
  SERVICE_STATE_DOTS,
  SERVICE_STATE_LABELS,
  SERVICE_STATE_TONES,
  isServiceOperationalState,
  resolveServiceOperationalState,
  type ServiceOperationalState,
} from "../../config/serviceStatus";

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onNavigate: (view: string, param?: any) => void;
  activeView: string;
  favoritesCount: number;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  currentUser: { email: string; role: 'USER'|'ADMIN' } | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onNavigate,
  activeView,
  favoritesCount,
  isMobileMenuOpen,
  onToggleMobileMenu,
  currentUser,
  onLogout,
}) => {
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(
    null,
  );
  const [productStatus, setProductStatus] = useState<{
    state: ServiceOperationalState;
    message: string | null;
  } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    let active = true;
    // Persisted admin product status first; the technical-health snapshot is
    // kept only as a fallback when the public status request is unavailable.
    apiClient.status
      .get()
      .then((status) => {
        if (active && isServiceOperationalState(status?.state)) {
          setProductStatus({ state: status.state, message: status.message ?? null });
        }
      })
      .catch(() => {});
    apiClient.checkHealth().then((health) => {
      if (active) setBackendHealth(health);
    });
    return () => {
      active = false;
    };
  }, []);

  // Product service status (persisted admin state, health fallback). Rendered
  // once and reused: inline on tablet/desktop, on its own compact row on phones
  // so the full label never forces the header past the viewport width.
  const serviceStatusChip = (backendHealth || productStatus) ? (() => {
    const state = resolveServiceOperationalState(productStatus?.state ?? null, backendHealth);
    const description = productStatus?.message
      ? `Estado del servicio: ${SERVICE_STATE_LABELS[state]}. ${productStatus.message}`
      : `Estado del servicio: ${SERVICE_STATE_LABELS[state]}`;
    return (
      <div
        role="status"
        aria-label={description}
        title={description}
        className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${SERVICE_STATE_TONES[state]}`}
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${SERVICE_STATE_DOTS[state]}`} />
        <span className="whitespace-nowrap">{SERVICE_STATE_LABELS[state]}</span>
      </div>
    );
  })() : null;

  return (
    <header className="sticky top-0 z-40 w-full min-w-0 bg-[#08090D]/90 backdrop-blur-md border-b border-white/[0.08]">
      <div className="flex h-16 w-full min-w-0 items-center gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Brand Logo & Mobile Menu Toggle */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400"
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
            className="min-w-0 cursor-pointer transition-opacity hover:opacity-95"
          >
            <VelyxoraLogo variant="full" size="md" className="max-[479px]:hidden" />
            <VelyxoraLogo variant="isotype" size="md" className="hidden max-[479px]:inline-flex" />
          </div>
        </div>

        {/* Center Search / Command Palette Bar (tablet and up) */}
        <div className="hidden min-w-0 flex-1 justify-center sm:flex">
          <button
            onClick={onOpenCommandPalette}
            className="group flex w-full max-w-xs items-center justify-between px-3 py-1.5 rounded-xl bg-[#101218] border border-white/[0.08] hover:border-indigo-500/40 text-slate-400 hover:text-slate-200 transition-all text-xs md:max-w-sm lg:max-w-md"
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
        </div>

        {/* Right Actions */}
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-1.5">
          {currentUser?.role === 'ADMIN' && <button onClick={() => onNavigate('admin')} className="hidden lg:inline-flex min-h-11 items-center rounded-xl px-3 text-xs text-indigo-300 hover:bg-white/5">Administración</button>}
          <div className="relative"><button onClick={() => setAccountOpen(!accountOpen)} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 text-xs text-slate-300 hover:bg-white/5" aria-expanded={accountOpen} aria-label="Menú de cuenta"><UserCircle className="h-5 w-5"/><span className="hidden lg:inline">{currentUser?'Mi cuenta':'Entrar'}</span></button>{accountOpen&&<div className="absolute right-0 top-12 z-50 w-56 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-[#11141d] p-2 shadow-2xl">{currentUser?<><button onClick={()=>{onNavigate('account');setAccountOpen(false)}} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm hover:bg-white/5"><UserCircle className="h-4 w-4"/>Mi cuenta</button><button onClick={()=>{onNavigate('history');setAccountOpen(false)}} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm hover:bg-white/5"><History className="h-4 w-4"/>Historial</button><button onClick={()=>{onNavigate('suggestions');setAccountOpen(false)}} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm hover:bg-white/5"><MessageSquare className="h-4 w-4"/>Sugerencias</button><button onClick={()=>{onLogout();setAccountOpen(false)}} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-rose-300 hover:bg-rose-500/10"><LogOut className="h-4 w-4"/>Salir</button></>:<><button onClick={()=>{onNavigate('auth');setAccountOpen(false)}} className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-white/5">Iniciar sesión</button><button onClick={()=>{onNavigate('auth');setAccountOpen(false)}} className="min-h-11 w-full rounded-xl bg-indigo-600 px-3 text-left text-sm">Crear cuenta</button></>}</div>}</div>

          {/* Product service status inline (tablet and up) */}
          {serviceStatusChip && <div className="hidden sm:flex">{serviceStatusChip}</div>}

          {/* Mobile Search trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] sm:hidden transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400"
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
            className={`hidden lg:inline-flex relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] transition-colors ${
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
            className={`hidden lg:inline-flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] transition-colors ${
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
            className={`hidden lg:inline-flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#161922] transition-colors ${
              activeView === "settings" ? "text-indigo-400 bg-[#161922]" : ""
            }`}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact mobile status row: keeps the full, non-truncated label visible
          on phones without competing with the header actions for width. */}
      {serviceStatusChip && (
        <div className="flex justify-center border-t border-white/[0.06] px-3 py-1.5 sm:hidden">
          {serviceStatusChip}
        </div>
      )}
    </header>
  );
};
