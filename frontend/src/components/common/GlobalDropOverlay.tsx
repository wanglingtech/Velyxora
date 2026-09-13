import React, { useState, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';

interface GlobalDropOverlayProps {
  onDropFile: (file: File) => void;
}

export const GlobalDropOverlay: React.FC<GlobalDropOverlayProps> = ({ onDropFile }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = React.useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current += 1;
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setIsDragActive(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        setIsDragActive(false);
        dragCounter.current = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onDropFile(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onDropFile]);

  if (!isDragActive) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="flex flex-col items-center p-8 rounded-3xl bg-[#101218] border-2 border-dashed border-indigo-500 shadow-2xl shadow-indigo-600/30 text-center max-w-sm mx-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 animate-bounce">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight">
          Suelta el archivo para analizarlo
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          VELYXORA detectará el formato, dimensiones y sugerirá las mejores herramientas.
        </p>
      </div>
    </div>
  );
};
