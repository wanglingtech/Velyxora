import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Heart, Globe, Server, HardDrive, Code2, ShieldCheck, ExternalLink, QrCode, X, Copy } from 'lucide-react';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';
import { IconRenderer } from '../common/IconRenderer';
import { toast } from '../common/ToastContainer';
import {
  SUPPORT_REGIONS,
  getSupportMethods,
  isMethodAvailable,
  type SupportMethodConfig,
} from '../../config/supportMethods';

interface SupportViewProps {
  onBack: () => void;
}

const FUND_USES = [
  { icon: <Server />, title: 'Hosting', text: 'Servidores que procesan tus conversiones.' },
  { icon: <Globe />, title: 'Dominio', text: 'Dominio y certificados del sitio.' },
  { icon: <HardDrive />, title: 'Infraestructura', text: 'Almacenamiento temporal y ancho de banda.' },
  { icon: <Code2 />, title: 'Desarrollo', text: 'Mantenimiento y nuevas herramientas.' },
];

export const SupportView: React.FC<SupportViewProps> = ({ onBack }) => {
  const [activeQr, setActiveQr] = useState<SupportMethodConfig | null>(null);

  const closeQr = useCallback(() => setActiveQr(null), []);

  useEffect(() => {
    if (!activeQr) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeQr();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeQr, closeQr]);

  const copyPublicId = async (method: SupportMethodConfig) => {
    if (!method.publicId) return;
    try {
      await navigator.clipboard.writeText(method.publicId);
      toast.success('Número copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar', 'El portapapeles no está disponible en este navegador.');
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-8 py-2 text-sm leading-relaxed text-slate-300">
      <button
        onClick={onBack}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Regresar
      </button>

      <header className="border-b border-white/10 pb-6 text-center">
        <VelyxoraLogo variant="full" size="lg" className="justify-center" />
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-bold tracking-[.24em] text-rose-400">
          <Heart className="h-3.5 w-3.5" /> APOYO VOLUNTARIO
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white">Apoyar a VELYXORA</h1>
        <p className="mx-auto mt-3 max-w-xl text-xs sm:text-sm text-slate-400">
          VELYXORA seguirá siendo gratuito. Si el proyecto te resulta útil, puedes
          ayudar voluntariamente a mantener su infraestructura y desarrollo.
        </p>
      </header>

      {/* Main support card with animated gradient border */}
      <div className="support-border">
        <div className="support-border-inner space-y-3 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-300">
            <Heart className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">Apoyar VELYXORA</h2>
          <p className="mx-auto max-w-md text-sm text-slate-400">
            Ayuda a mantener gratuito el proyecto. Es totalmente opcional y no
            cambia tu acceso a las herramientas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] font-mono uppercase tracking-wider">
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">Gratuito</span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-400">Sin créditos</span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-400">Sin prioridad</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-[#101218] p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Heart className="h-4 w-4" />
            <h2 className="font-mono font-bold text-white">GRATUITO</h2>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Puedes usar todas las herramientas sin donar. Apoyar no desbloquea
            funciones, no añade créditos ni aumenta la prioridad de proceso.
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-[#101218] p-4">
          <div className="flex items-center gap-2 text-sky-400">
            <Globe className="h-4 w-4" />
            <h2 className="font-mono font-bold text-white">SEPARADO DEL PRODUCTO</h2>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            El apoyo es distinto de cualquier compra o crédito. Esta página no
            procesa pagos ni recopila datos financieros.
          </p>
        </article>
      </div>

      <div className="space-y-6">
        {SUPPORT_REGIONS.map((region) => (
          <div key={region.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-base leading-none">{region.flag}</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{region.name}</h2>
            </div>
            <p className="text-xs text-slate-500">{region.blurb}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {getSupportMethods(region.id).map((method) => {
                const available = isMethodAvailable(method);

                if (available && method.mode === 'public-identifier') {
                  return (
                    <div
                      key={method.id}
                      className="flex flex-col justify-between rounded-2xl border border-rose-400/30 bg-[#101218] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-rose-300 [&>svg]:h-5 [&>svg]:w-5">
                            <IconRenderer name={method.icon} size={20} />
                          </span>
                          <h3 className="font-semibold text-white">{method.name}</h3>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-md border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-rose-300">
                          Disponible
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">Número para apoyar</p>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                          <code className="min-w-0 flex-1 break-all text-sm text-white">{method.publicId}</code>
                          <button
                            type="button"
                            onClick={() => copyPublicId(method)}
                            aria-label={`Copiar número de ${method.name}`}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-rose-400"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (available && method.mode === 'qr-display') {
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setActiveQr(method)}
                      className="group flex flex-col justify-between rounded-2xl border border-rose-400/30 bg-[#101218] p-4 text-left transition-colors hover:border-rose-400/60 focus-visible:outline-2 focus-visible:outline-rose-400"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-rose-300 [&>svg]:h-5 [&>svg]:w-5">
                            <IconRenderer name={method.icon} size={20} />
                          </span>
                          <h3 className="font-semibold text-white">{method.name}</h3>
                        </div>
                        <QrCode className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-rose-300" />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{method.description}</p>
                      <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-rose-300">
                        Disponible · Ver QR
                      </span>
                    </button>
                  );
                }

                if (available && method.mode === 'external-link') {
                  return (
                    <a
                      key={method.id}
                      href={method.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col justify-between rounded-2xl border border-rose-400/30 bg-[#101218] p-4 transition-colors hover:border-rose-400/60 focus-visible:outline-2 focus-visible:outline-rose-400"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-rose-300 [&>svg]:h-5 [&>svg]:w-5">
                            <IconRenderer name={method.icon} size={20} />
                          </span>
                          <h3 className="font-semibold text-white">{method.name}</h3>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-rose-300" />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{method.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex w-fit items-center rounded-md border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-rose-300">
                          Disponible
                        </span>
                        <span className="text-[11px] font-medium text-rose-300 group-hover:text-rose-200">
                          Apoyar con {method.name} →
                        </span>
                      </div>
                    </a>
                  );
                }

                return (
                  <div
                    key={method.id}
                    aria-disabled="true"
                    className="flex cursor-default flex-col justify-between rounded-2xl border border-dashed border-white/10 bg-[#101218]/60 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-slate-500 [&>svg]:h-5 [&>svg]:w-5">
                        <IconRenderer name={method.icon} size={20} />
                      </span>
                      <h3 className="font-semibold text-slate-300">{method.name}</h3>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{method.description}</p>
                    <span className="mt-3 inline-flex w-fit items-center rounded-md border border-slate-600/40 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400">
                      Próximamente
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tu apoyo ayuda con
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FUND_USES.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-[#101218] p-4">
              <span className="text-indigo-400 [&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
              <h3 className="mt-3 text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#101218] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div className="space-y-1 text-xs text-slate-400">
          <h2 className="text-sm font-semibold text-white">Transparencia y privacidad</h2>
          <p>
            VELYXORA no recibe números de tarjeta, CVV, contraseñas bancarias ni
            credenciales de pago. Al elegir un proveedor externo serás redirigido
            a su sitio oficial, donde se aplican sus propios términos y su
            política de privacidad.
          </p>
          <p>
            Los números de Yape y Plin son identificadores públicos para copiar y
            usar manualmente en tu aplicación. VELYXORA no procesa el pago, no lo
            verifica y no recibe información financiera.
          </p>
          <p>Ningún apoyo modifica las herramientas, los límites técnicos ni la seguridad.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.04] p-6 text-center">
        <Heart className="mx-auto h-5 w-5 text-rose-400" />
        <p className="mt-2 text-sm font-semibold text-white">Gracias por acompañar a VELYXORA</p>
        <p className="mt-1 text-xs text-slate-400">
          Usar y compartir las herramientas también es una forma valiosa de apoyar.
        </p>
      </div>

      {activeQr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-qr-title"
          onClick={closeQr}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101218] p-5 text-center"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="support-qr-title" className="text-sm font-semibold text-white">
                {activeQr.name}
              </h2>
              <button
                type="button"
                onClick={closeQr}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <img
              src={activeQr.qrImageUrl}
              alt={`Código QR de ${activeQr.name}`}
              className="mx-auto mt-4 h-56 w-56 rounded-xl bg-white object-contain p-2"
            />

            {activeQr.publicId && (
              <div className="mt-4 space-y-2 text-left">
                <p className="text-xs text-slate-400">Identificador público</p>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <code className="min-w-0 flex-1 break-all text-xs text-slate-200">{activeQr.publicId}</code>
                  <button
                    type="button"
                    onClick={() => copyPublicId(activeQr)}
                    aria-label={`Copiar número de ${activeQr.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-rose-400"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Escanea el código desde tu aplicación de pagos. VELYXORA no procesa
              el pago ni recibe tus credenciales financieras.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
