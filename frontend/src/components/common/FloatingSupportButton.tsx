import React from 'react';
import { Heart } from 'lucide-react';

interface FloatingSupportButtonProps {
  onClick: () => void;
}

/**
 * Persistent, unobtrusive entry point to voluntary support. On phones it sits
 * above the bottom navigation and respects the device safe areas; from large
 * screens it docks to the lower-right corner.
 */
export const FloatingSupportButton: React.FC<FloatingSupportButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Apoyar VELYXORA"
    title="Apoyar VELYXORA"
    className="fixed right-[calc(env(safe-area-inset-right,0px)+1rem)] bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-400/30 bg-[#101218]/95 px-3.5 text-xs font-semibold text-rose-200 shadow-xl shadow-black/40 backdrop-blur transition-colors hover:border-rose-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 lg:bottom-6 lg:right-6"
  >
    <Heart className="h-4 w-4" aria-hidden="true" />
    Apoyar
  </button>
);
