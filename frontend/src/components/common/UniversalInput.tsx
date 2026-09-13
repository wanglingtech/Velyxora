import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { detectFile } from '../../services/detectionService';
import { DetectedFileInfo } from '../../types';
import { findMatchingMediaAdapter } from '../../services/mediaService';

interface UniversalInputProps {
  onFileDetected?: (info: DetectedFileInfo) => void;
  onUrlDetected?: (url: string) => void;
  onMultipleFiles?: (files: File[]) => void;
  className?: string;
  compact?: boolean;
}

export const UniversalInput: React.FC<UniversalInputProps> = ({
  onFileDetected,
  onUrlDetected,
  onMultipleFiles,
  className = '',
  compact = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedUrlPlatform, setDetectedUrlPlatform] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check URL input on typing
  useEffect(() => {
    if (urlInput.startsWith('http://') || urlInput.startsWith('https://')) {
      const adapter = findMatchingMediaAdapter(urlInput);
      setDetectedUrlPlatform(adapter ? adapter.name : null);
    } else {
      setDetectedUrlPlatform(null);
    }
  }, [urlInput]);

  // Handle Clipboard Paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // If user is focused on another input, do not hijack
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.clipboardData) {
        // Check for files (e.g. screenshot pasted)
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          e.preventDefault();
          const file = e.clipboardData.files[0];
          await processSingleFile(file);
          return;
        }

        // Check for text/URL
        const pastedText = e.clipboardData.getData('text');
        if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://'))) {
          e.preventDefault();
          setUrlInput(pastedText);
          handleAnalyzeUrl(pastedText);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processSingleFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const info = await detectFile(file);
      onFileDetected?.(info);
    } catch (err) {
      console.error('File detection error', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (files.length > 1 && onMultipleFiles) {
      onMultipleFiles(Array.from(files));
      // Also inspect the first file
      await processSingleFile(files[0]);
    } else {
      await processSingleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleAnalyzeUrl = (urlToAnalyze?: string) => {
    const target = urlToAnalyze || urlInput;
    if (!target.trim()) return;
    onUrlDetected?.(target.trim());
  };

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      {/* Dropzone Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center cursor-pointer transition-all duration-200 rounded-2xl border-2 border-dashed ${
          isDragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.005]'
            : 'border-white/[0.12] bg-[#101218]/90 hover:border-indigo-500/40 hover:bg-[#161922]'
        } ${compact ? 'py-6 px-4' : 'py-10 px-6'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-105 transition-transform">
            {isAnalyzing ? (
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-slate-100">
            {isAnalyzing ? 'Analizando archivo...' : 'Arrastra y suelta tus archivos aquí'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Imágenes, videos, audios, PDFs o documentos. Procesamiento privado local en tu navegador.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm">
              Seleccionar archivos
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">o pega desde el portapapeles</span>
          </div>
        </div>
      </div>

      {/* URL Input Row */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#101218] border border-white/[0.08] focus-within:border-indigo-500/50 transition-colors">
        <div className="pl-2.5 text-slate-500">
          <LinkIcon className="w-4 h-4" />
        </div>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAnalyzeUrl();
            }
          }}
          placeholder="O pega el enlace de YouTube, TikTok, Vimeo, Instagram, X..."
          className="flex-1 bg-transparent border-none text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none py-1.5 px-2 font-normal"
        />

        {detectedUrlPlatform && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 shrink-0 hidden sm:inline">
            {detectedUrlPlatform}
          </span>
        )}

        <button
          type="button"
          onClick={() => handleAnalyzeUrl()}
          disabled={!urlInput.trim()}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 disabled:hover:bg-slate-800 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
        >
          <span>Analizar</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
