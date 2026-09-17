import { useEffect, useState } from 'react';
import { ExternalLink, Link2Off } from 'lucide-react';
import { ApiError, apiClient } from '../../services/apiClient';

export function ShortLinkView({ slug, onHome }: { slug: string; onHome: () => void }) {
  const [state, setState] = useState<'loading' | 'missing' | 'expired' | 'unsafe' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    apiClient.links.resolve(slug).then(({ targetUrl }) => {
      if (!active) return;
      const target = new URL(targetUrl);
      if (target.protocol !== 'http:' && target.protocol !== 'https:') { setState('unsafe'); return; }
      window.location.replace(target.toString());
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.code === 'SHORT_LINK_NOT_FOUND') setState('missing');
      else if (error instanceof ApiError && error.code === 'SHORT_LINK_EXPIRED') setState('expired');
      else if (error instanceof ApiError && error.code === 'SHORT_LINK_UNSAFE') setState('unsafe');
      else setState('error');
    });
    return () => { active = false; };
  }, [slug]);

  const copy = state === 'expired'
    ? ['Este enlace expiró', 'La fecha de vigencia terminó y el destino ya no está disponible.']
    : state === 'missing'
      ? ['Enlace no encontrado', 'El código no existe o fue escrito incorrectamente.']
      : state === 'unsafe'
        ? ['Destino bloqueado', 'El enlace no cumple las reglas de seguridad de VELYXORA.']
        : state === 'error'
          ? ['No pudimos resolver el enlace', 'Inténtalo nuevamente en unos momentos.']
          : ['Abriendo enlace seguro…', 'Estamos comprobando el código antes de redirigirte.'];

  return <section className="mx-auto grid min-h-[55vh] max-w-xl place-items-center px-4 text-center">
    <div className="w-full rounded-3xl border border-white/10 bg-[#101218] p-7 sm:p-10">
      {state === 'loading' ? <ExternalLink className="mx-auto h-10 w-10 animate-pulse text-indigo-400"/> : <Link2Off className="mx-auto h-10 w-10 text-slate-500"/>}
      <h1 className="mt-5 text-2xl font-bold">{copy[0]}</h1><p className="mt-2 text-sm text-slate-400">{copy[1]}</p>
      {state !== 'loading' && <button onClick={onHome} className="mt-6 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold">Ir al inicio</button>}
    </div>
  </section>;
}
