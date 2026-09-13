import React from 'react';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';

interface FooterProps {
  onNavigate: (view: string, param?: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="w-full border-t border-white/[0.06] bg-[#08090D] py-8 px-4 sm:px-6 mt-16 pb-20 lg:pb-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <VelyxoraLogo variant="isotype" size="sm" />
          <span className="text-xs text-slate-400">
            VELYXORA © {new Date().getFullYear()} • Universal Conversion & Media Toolkit
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <button
            onClick={() => onNavigate('category', 'all')}
            className="hover:text-slate-300 transition-colors"
          >
            Herramientas
          </button>
          <button
            onClick={() => onNavigate('about')}
            className="hover:text-slate-300 transition-colors"
          >
            Acerca de
          </button>
          <button
            onClick={() => onNavigate('privacy')}
            className="hover:text-slate-300 transition-colors"
          >
            Privacidad
          </button>
          <button
            onClick={() => onNavigate('terms')}
            className="hover:text-slate-300 transition-colors"
          >
            Términos
          </button>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sistemas Operativos
          </span>
        </div>
      </div>
    </footer>
  );
};
