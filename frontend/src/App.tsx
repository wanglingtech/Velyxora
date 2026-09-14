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

export default function App() {
  const [activeView, setActiveView] = useState<string>('home');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeTool, setActiveTool] = useState<ToolDefinition | null>(null);
  const [activeFile, setActiveFile] = useState<File | undefined>(undefined);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [detectedFile, setDetectedFile] = useState<DetectedFileInfo | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    setFavorites(favoritesService.getFavorites());
  }, []);

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
            <HistoryView onSelectTool={handleSelectTool} onBack={() => handleNavigate('home')} />
          )}

          {activeView === 'settings' && <SettingsView onBack={() => handleNavigate('home')} />}

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
