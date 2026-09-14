import { Zap } from 'lucide-react';

export function AppLoader({ progress }: { progress: number }) {
  return <div className="velyxora-loader" role="status" aria-live="polite" aria-label="Inicializando VELYXORA">
    <div className="loader-grid" aria-hidden="true" />
    <div className="loader-orb loader-orb-one" aria-hidden="true" /><div className="loader-orb loader-orb-two" aria-hidden="true" />
    <div className="loader-content">
      <div className="loader-logo"><Zap aria-hidden="true" /></div>
      <p className="loader-kicker">WORKSPACE INTELIGENTE</p><h1>VELYXORA</h1>
      <p className="loader-status">Optimizando tu experiencia<span className="loader-dots" aria-hidden="true">...</span></p>
      <div className="loader-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <div className="loader-meta"><span>Potencia tus herramientas. Simplifica tu flujo.</span><strong>{progress}%</strong></div>
    </div>
  </div>;
}
