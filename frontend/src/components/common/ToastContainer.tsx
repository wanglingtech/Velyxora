import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribeToasts, type ToastMessage } from './toast';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToasts((newToast) => {
      setToasts((prev) => [...prev, newToast]);

      if (newToast.duration) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.duration);
      }
    });
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-24 z-50 flex w-full max-w-sm flex-col gap-2 pointer-events-none px-4 sm:top-20 sm:px-0">
      {toasts.map((t) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        };

        const borderColors = {
          success: 'border-emerald-500/30',
          error: 'border-rose-500/30',
          warning: 'border-amber-500/30',
          info: 'border-indigo-500/30'
        };

        return (
          <div
            key={t.id}
            id={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl bg-[#161922] border ${borderColors[t.type]} shadow-xl shadow-black/40 text-slate-100 transition-all duration-200 animate-in fade-in slide-in-from-top-2`}
            role="alert"
          >
            <div className="flex items-start gap-3">
              {icons[t.type]}
              <div>
                <p className="text-xs font-semibold text-white tracking-wide">{t.title}</p>
                {t.message && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.message}</p>}
              </div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
