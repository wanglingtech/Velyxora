import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { HomeView } from './components/views/HomeView';
import { CategoryView } from './components/views/CategoryView';
import { ToolRunner } from './components/tools/ToolRunner';
import { MediaDownloaderView } from './components/tools/MediaDownloaderView';
import { HistoryView } from './components/views/HistoryView';
import { FavoritesView } from './components/views/FavoritesView';
import { SettingsView } from './components/views/SettingsView';
import { LegalView } from './components/views/LegalView';
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

export default function App() {
  const { user: currentUser, isLoading: authLoading, logout } = useAuth();
  const [activeView, setActiveView] = useState<string>('home');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeTool, setActiveTool] = useState<ToolDefinition | null>(null);
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
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMediaDownloader = (url?: string) => {
    if (url) setMediaUrl(url);
    setActiveView('media-downloader');
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (catId: string) => {
    setActiveCategory(catId);
    setActiveView('category');
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
    if (view === 'category' && param) {
      setActiveCategory(param);
    }
    if (view === 'home') {
      setActiveTool(null);
      setActiveFile(undefined);
    }
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!bootstrapReady) return <AppLoader progress={progress} />;

  const authFallback = <AuthView onAuthenticated={(user) => handleNavigate(user.role === 'ADMIN' ? 'admin' : 'account')} onBack={() => handleNavigate('home')} />;

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
            <ToolRunner
              tool={activeTool}
              initialFile={activeFile}
              onBack={() => {
                setActiveTool(null);
                setActiveFile(undefined);
                setActiveView('home');
              }}
            />
          )}

          {activeView === 'media-downloader' && (
            <MediaDownloaderView
              initialUrl={mediaUrl}
              onBack={() => setActiveView('home')}
            />
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

          {activeView === 'auth' && <AuthView onAuthenticated={(user) => handleNavigate(user.role === 'ADMIN' ? 'admin' : 'account')} onBack={() => handleNavigate('home')} />}
          {activeView === 'account' && <ProtectedRoute fallback={authFallback}><AccountView onBack={() => handleNavigate('home')} /></ProtectedRoute>}
          {activeView === 'admin' && <AdminRoute fallback={<section className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-[#101218] p-8"><h1 className="text-xl font-bold">Acceso denegado</h1><p className="mt-2 text-slate-400">Esta sección requiere una sesión administrativa.</p><button onClick={() => handleNavigate('home')} className="mt-5 min-h-11 text-indigo-400">Regresar</button></section>}><AdminView onBack={() => handleNavigate('account')} /></AdminRoute>}
          {activeView === 'complaints' && <FeedbackView kind="complaint" onBack={() => handleNavigate('home')} />}
          {activeView === 'suggestions' && <FeedbackView kind="suggestion" onBack={() => handleNavigate('home')} />}

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
