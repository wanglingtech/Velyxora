import React from 'react';
import { ArrowLeft, Heart, Globe, Smartphone, Coffee, Github } from 'lucide-react';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';

interface SupportViewProps {
  onBack: () => void;
}

interface SupportMethod {
  id: string;
  name: string;
  scope: string;
  description: string;
  icon: React.ReactNode;
}

// Planned support methods. None of them are enabled in this phase and no
// payment is processed, collected or stored by VELYXORA here.
const PLANNED_METHODS: SupportMethod[] = [
  { id: 'github-sponsors', name: 'GitHub Sponsors', scope: 'Internacional', description: 'Apoyo puntual o recurrente desde GitHub.', icon: <Github /> },
  { id: 'kofi', name: 'Ko-fi', scope: 'Internacional', description: 'Apoyo puntual o recurrente con tarjeta.', icon: <Coffee /> },
  { id: 'yape', name: 'Yape', scope: 'Perú', description: 'Apoyo puntual mediante Yape.', icon: <Smartphone /> },
  { id: 'plin', name: 'Plin', scope: 'Perú', description: 'Apoyo puntual mediante Plin.', icon: <Smartphone /> },
];

export const SupportView: React.FC<SupportViewProps> = ({ onBack }) => {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-7 py-2 text-sm leading-relaxed text-slate-300">
      <button
        onClick={onBack}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Regresar
      </button>

      <header className="border-b border-white/10 pb-6 text-center">
        <VelyxoraLogo variant="full" size="lg" className="justify-center" />
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-bold tracking-[.24em] text-rose-400">
          <Heart className="h-3.5 w-3.5" /> APOYO VOLUNTARIO
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">Apoyar a VELYXORA</h1>
        <p className="mx-auto mt-3 max-w-xl text-xs text-slate-400">
          VELYXORA es y seguirá siendo gratuito. Las herramientas y utilidades no
          están condicionadas a ningún pago.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-[#101218] p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Heart className="h-4 w-4" />
            <h2 className="font-mono font-bold text-white">GRATUITO</h2>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Puedes usar todas las herramientas sin donar. Apoyar es totalmente
            opcional y no otorga acceso, créditos ni prioridad.
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

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Métodos previstos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLANNED_METHODS.map((method) => (
            <div
              key={method.id}
              aria-disabled="true"
              className="flex flex-col justify-between rounded-2xl border border-dashed border-white/10 bg-[#101218]/60 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-slate-400 [&>svg]:h-5 [&>svg]:w-5">{method.icon}</span>
                <div>
                  <h3 className="font-semibold text-slate-200">{method.name}</h3>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    {method.scope}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{method.description}</p>
              <span className="mt-3 inline-flex w-fit items-center rounded-md border border-slate-600/40 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400">
                No disponible aún
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Los métodos de apoyo se integrarán en una tarea posterior mediante
        proveedores oficiales. VELYXORA no almacenará números de tarjeta, CVV ni
        credenciales bancarias.
      </p>
    </section>
  );
};
