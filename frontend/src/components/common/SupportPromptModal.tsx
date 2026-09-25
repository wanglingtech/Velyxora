import React, { useCallback, useEffect, useRef } from 'react';
import { X, Heart } from 'lucide-react';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';

interface SupportPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupport: () => void;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * First-visit voluntary support notice. It explains that support is optional
 * and routes the user to the existing Support view; it never processes a
 * transaction, never duplicates support identifiers and never blocks the app.
 */
export const SupportPromptModal: React.FC<SupportPromptModalProps> = ({ isOpen, onClose, onSupport }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-prompt-title"
        aria-describedby="support-prompt-description"
        onClick={(event) => event.stopPropagation()}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-white/10 bg-[#101218] p-5 text-left shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <VelyxoraLogo variant="full" size="sm" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-[10px] font-bold tracking-[.24em] text-rose-400">
          <Heart className="h-3.5 w-3.5" aria-hidden="true" /> APOYO VOLUNTARIO
        </p>
        <h2 id="support-prompt-title" className="mt-2 text-xl font-bold text-white">
          VELYXORA es gratuito
        </h2>
        <p id="support-prompt-description" className="mt-2 text-sm leading-relaxed text-slate-400">
          Si la plataforma te resulta útil, puedes apoyar voluntariamente su mantenimiento y
          ayudar a que siga disponible para todos.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          El apoyo es opcional: no desbloquea funciones, no otorga prioridad ni cambia tu
          acceso a las herramientas.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            Ahora no
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onSupport}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
          >
            <Heart className="h-4 w-4" aria-hidden="true" /> Apoyar VELYXORA
          </button>
        </div>
      </div>
    </div>
  );
};
