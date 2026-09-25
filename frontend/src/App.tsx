import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { HomeView } from './components/views/HomeView';
import { CategoryView } from './components/views/CategoryView';
const ToolRunner = React.lazy(() => import('./components/tools/ToolRunner').then((module) => ({ default: module.ToolRunner })));
const MediaDownloaderView = React.lazy(() => import('./components/tools/MediaDownloaderView').then((module) => ({ default: module.MediaDownloaderView })));
import { HistoryView } from './components/views/HistoryView';
import { FavoritesView } from './components/views/FavoritesView';
import { SettingsView } from './components/views/SettingsView';
import { LegalView } from './components/views/LegalView';
import { SupportView } from './components/views/SupportView';
import { CommandPalette } from './components/common/CommandPalette';
import { ToastContainer, toast } from './components/common/ToastContainer';
import { GlobalDropOverlay } from './components/common/GlobalDropOverlay';
import { favoritesService } from './services/favoritesService';
import { detectFile } from './services/detectionService';
import { ToolDefinition, DetectedFileInfo } from './types';
import { getToolById } from './registry/tools';
import { AccountView, AdminView, AuthView } from './components/views/AccountViews';
import { historyService } from './services/historyService';
import { useAuth } from './auth/AuthContext';
import { AdminRoute, ProtectedRoute } from './auth/RouteGuards';
import { AppLoader } from './components/common/AppLoader';
import { FeedbackView } from './components/views/FeedbackViews';
import { ShortLinkView } from './components/views/ShortLinkView';
import { pathForView, routeFromPath, sanitizeReturnTo } from './services/appRouting';

export default function App() {
  const initialRoute = routeFromPath(window.location.pathname);
  const initialTool = initialRoute.view === 'tool' && initialRoute.param ? getToolById(initialRoute.param) || null : null;
  const { user: currentUser, isLoading: authLoading, logout } = useAuth();
  const [activeView, setActiveView] = useState<string>(initialRoute.view === 'tool' && !initialTool ? 'not-found' : initialRoute.view);
  const [activeCategory, setActiveCategory] = useState<string>(initialRoute.view === 'category' ? initialRoute.param || 'all' : 'all');
  const [activeTool, setActiveTool] = useState<ToolDefinition | null>(initialTool);
  const [shortSlug, setShortSlug] = useState(initialRoute.view === 'short-link' ? initialRoute.param || '' : '');
  const [authMode, setAuthMode] = useState<'login'|'register'>(initialRoute.authMode || 'login');
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | undefined>(undefined);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [detectedFile, setDetectedFile] = useState<DetectedFileInfo | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    setFavorites(favoritesService.getFavorites());
  }, []);
  useEffect(() => {
    const started = Date.now();
    const interval = window.setInterval(() => setProgress((value) => Math.min(authLoading ? 82 : 96, value + Math.ceil(Math.random() * 8))), 120);
    if (!authLoading) {
      const timeout = window.setTimeout(() => { setProgress(100); window.setTimeout(() => setBootstrapReady(true), 180); }, Math.max(0, 900 - (Date.now() - started)));
      return () => { window.clearInterval(interval); window.clearTimeout(timeout); };
    }
    return () => window.clearInterval(interval);
  }, [authLoading]);
  useEffect(() => { historyService.setAuthenticated(Boolean(currentUser)); }, [currentUser]);
  const applyRoute = React.useCallback((path: string) => {
    const route = routeFromPath(path);
    const routeTool = route.view === 'tool' && route.param ? getToolById(route.param) || null : null;
    setActiveView(route.view === 'tool' && !routeTool ? 'not-found' : route.view);
    setAuthMode(route.authMode || 'login');
    if (route.view === 'short-link') setShortSlug(route.param || '');
    if (route.view === 'category') setActiveCategory(route.param || 'all');
    if (route.view === 'tool') setActiveTool(routeTool);
  }, []);
  useEffect(() => {
    const sync = () => applyRoute(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [applyRoute]);

  const handleToggleFavorite = (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    favoritesService.toggleFavorite(toolId);
    setFavorites(favoritesService.getFavorites());
    const isFav = favoritesService.isFavorite(toolId);
    toast.info(isFav ? 'Añadido a favoritos' : 'Eliminado de favoritos');
  };

  const handleSelectTool = (tool: ToolDefinition, file?: File) => {
    setActiveTool(tool);
    setActiveFile(file);
    setActiveView('tool');
    window.history.pushState({}, '', pathForView('tool', tool.slug));
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMediaDownloader = (url?: string) => {
    if (url) setMediaUrl(url);
    setActiveView('media-downloader');
    window.history.pushState({}, '', pathForView('media-downloader'));
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (catId: string) => {
    setActiveCategory(catId);
    setActiveView('category');
    window.history.pushState({}, '', pathForView('category', catId));
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGlobalDropFile = async (file: File) => {
    try {
      const info = await detectFile(file);
      setDetectedFile(info);
      setActiveView('home');
      setIsMobileMenuOpen(false);
      toast.success('Archivo detectado', `${file.name} (${info.formattedSize})`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNavigate = (view: string, param?: any) => {
    setActiveView(view);
    if (view === 'auth') setAuthMode('login');
    if (view === 'category' && param) {
      setActiveCategory(param);
    }
    if (view === 'home') {
      setActiveTool(null);
      setActiveFile(undefined);
    }
    setIsMobileMenuOpen(false);
    const path = pathForView(view, typeof param === 'string' ? param : undefined);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateInternal = (path: string) => {
    applyRoute(path);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Opens the existing auth view and remembers a validated internal return
  // destination. Invalid/external targets are dropped by sanitizeReturnTo.
  const requestAuth = (target?: string) => {
    setReturnTo(sanitizeReturnTo(target));
    handleNavigate('auth');
  };

  const completeAuth = (user: { role: string }) => {
    if (returnTo) {
      const destination = returnTo;
      setReturnTo(null);
      navigateInternal(destination);
      return;
    }
    handleNavigate(user.role === 'ADMIN' ? 'admin' : 'account');
  };

  if (!bootstrapReady) return <AppLoader progress={progress} />;

  const authFallback = <AuthView initialMode="login" onAuthenticated={completeAuth} onBack={() => handleNavigate('home')} />;

  return (
    <div className="min-h-screen bg-[#08090D] text-[#F5F7FA] flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Global Drag and Drop Overlay */}
      <GlobalDropOverlay onDropFile={handleGlobalDropFile} />

      {/* Top Header */}
      <Header
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onNavigate={handleNavigate}
        activeView={activeView}
        favoritesCount={favorites.length}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        currentUser={currentUser}
        onLogout={async () => { await logout(); handleNavigate('auth'); }}
      />

      {/* Main App Body */}
      <div className="flex-1 flex w-full">
        {/* Responsive Sidebar */}
        <Sidebar
          activeView={activeView}
          activeCategory={activeCategory}
          onNavigate={handleNavigate}
          favoritesCount={favorites.length}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Workspace Container */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {activeView === 'home' && (
            <HomeView
              onSelectTool={handleSelectTool}
              onSelectCategory={handleSelectCategory}
              onOpenMediaDownloader={handleOpenMediaDownloader}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              detectedFile={detectedFile}
              onClearDetectedFile={() => setDetectedFile(null)}
              onFileDetected={(info) => setDetectedFile(info)}
            />
          )}

          {activeView === 'category' && (
            <CategoryView
              currentCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              onSelectTool={handleSelectTool}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onBack={() => handleNavigate('home')}
            />
          )}

          {activeView === 'tool' && activeTool && (
            <React.Suspense fallback={<div className="p-8 text-sm text-slate-400">Cargando herramienta…</div>}><ToolRunner
              tool={activeTool}
              initialFile={activeFile}
              onRequireAuth={requestAuth}
              onBack={() => {
                setActiveTool(null);
                setActiveFile(undefined);
                handleNavigate('home');
              }}
            /></React.Suspense>
          )}

          {activeView === 'media-downloader' && (
            <React.Suspense fallback={<div className="p-8 text-sm text-slate-400">Cargando herramienta…</div>}><MediaDownloaderView
              initialUrl={mediaUrl}
              onBack={() => handleNavigate('home')}
              onRequireAuth={requestAuth}
            /></React.Suspense>
          )}

          {activeView === 'favorites' && (
            <FavoritesView
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onSelectTool={handleSelectTool}
            />
          )}

          {activeView === 'history' && (
            <HistoryView authenticated={Boolean(currentUser)} onSelectTool={handleSelectTool} onBack={() => handleNavigate('home')} />
          )}

          {activeView === 'settings' && <SettingsView onBack={() => handleNavigate('home')} />}

          {activeView === 'auth' && <AuthView initialMode={authMode} onAuthenticated={completeAuth} onBack={() => handleNavigate('home')} />}
          {activeView === 'account' && <ProtectedRoute fallback={authFallback}><AccountView onBack={() => handleNavigate('home')} /></ProtectedRoute>}
          {activeView === 'admin' && <AdminRoute fallback={<section className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-[#101218] p-8"><h1 className="text-xl font-bold">Acceso denegado</h1><p className="mt-2 text-slate-400">Esta sección requiere una sesión administrativa.</p><button onClick={() => handleNavigate('home')} className="mt-5 min-h-11 text-indigo-400">Regresar</button></section>}><AdminView onBack={() => handleNavigate('account')} /></AdminRoute>}
          {activeView === 'complaints' && <FeedbackView kind="complaint" onBack={() => handleNavigate('home')} />}
          {activeView === 'suggestions' && <FeedbackView kind="suggestion" onBack={() => handleNavigate('home')} />}
          {activeView === 'short-link' && <ShortLinkView slug={shortSlug} onHome={() => handleNavigate('home')} />}
          {activeView === 'not-found' && <section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#101218] p-8 text-center"><h1 className="text-2xl font-bold">Página no encontrada</h1><p className="mt-2 text-sm text-slate-400">La ruta solicitada no existe en VELYXORA.</p><button onClick={() => handleNavigate('home')} className="mt-6 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm">Ir al inicio</button></section>}

          {activeView === 'support' && <SupportView onBack={() => handleNavigate('home')} />}

          {(activeView === 'about' || activeView === 'privacy' || activeView === 'terms') && (
            <LegalView page={activeView as any} onBack={() => handleNavigate('home')} />
          )}

          {/* Minimalist Footer */}
          <Footer onNavigate={handleNavigate} />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
      />

      {/* Command Palette Modal (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTool={handleSelectTool}
      />

      {/* Toast Notification Container */}
      <ToastContainer />
    </div>
  );
}
