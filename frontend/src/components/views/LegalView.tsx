import React from 'react';
import { ShieldCheck, FileText, Lock, Server, Cpu } from 'lucide-react';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';

interface LegalViewProps {
  page: 'privacy' | 'terms' | 'about';
}

export const LegalView: React.FC<LegalViewProps> = ({ page }) => {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 py-2">
      <div className="text-center space-y-3 pb-4 border-b border-white/[0.08]">
        <VelyxoraLogo variant="full" size="lg" className="justify-center" showTagline />
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {page === 'privacy'
            ? 'Política de Privacidad & Procesamiento de Datos'
            : page === 'terms'
            ? 'Términos de Servicio & Cumplimiento Legal'
            : 'Acerca de VELYXORA'}
        </h2>
      </div>

      {page === 'about' && (
        <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-300 space-y-4 leading-relaxed">
          <p>
            <strong className="text-white">VELYXORA</strong> es una plataforma universal y moderna de conversión, procesamiento multimedia y utilidades digitales concebida como un entorno unificado de trabajo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 not-prose">
            <div className="p-4 rounded-xl bg-[#101218] border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <Lock className="w-4 h-4" />
                <span>CLIENT_SIDE (Navegador)</span>
              </div>
              <p className="text-xs text-slate-400">
                Las tareas de imágenes, recortado de audio, formateo de código, hash criptográfico y códigos QR se ejecutan directamente en la memoria de tu navegador mediante HTML5 Canvas, Web Audio y Web Crypto. Tus datos nunca salen de tu equipo.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#101218] border border-sky-500/20 space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                <Server className="w-4 h-4" />
                <span>SERVER_SIDE / HYBRID</span>
              </div>
              <p className="text-xs text-slate-400">
                Para tareas de alta demanda computacional (como transcodificación FFmpeg de video pesado o conversión con LibreOffice), la plataforma cuenta con contratos y adapters listos para enlazar con microservicios en VS Code.
              </p>
            </div>
          </div>
        </div>
      )}

      {page === 'privacy' && (
        <div className="text-xs sm:text-sm text-slate-300 space-y-4 leading-relaxed">
          <h3 className="text-sm sm:text-base font-semibold text-white">1. Principio Fundamental: Procesamiento Local</h3>
          <p>
            VELYXORA no requiere registro obligatorio para el uso de herramientas base. Toda conversión identificada como <span className="text-emerald-400 font-mono">LOCAL</span> se procesa en la RAM de tu navegador.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">2. Almacenamiento Local (LocalStorage)</h3>
          <p>
            El historial de conversiones almacena únicamente metadatos mínimos (nombre de archivo, peso en KB y fecha) para tu conveniencia. Nunca se guardan copias binarias de tus fotos o videos en el almacenamiento persistente.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">3. Telemetría y Analíticas</h3>
          <p>
            No transmitimos nombres de archivos privados ni parámetros sensibles a redes de publicidad o rastreadores de terceros.
          </p>
        </div>
      )}

      {page === 'terms' && (
        <div className="text-xs sm:text-sm text-slate-300 space-y-4 leading-relaxed">
          <h3 className="text-sm sm:text-base font-semibold text-white">1. Uso Aceptable</h3>
          <p>
            Al utilizar las herramientas de VELYXORA te comprometes a procesar únicamente archivos y medios digitales sobre los cuales posees los derechos de autor legítimos o las autorizaciones pertinentes.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">2. Media Downloader & Restricciones</h3>
          <p>
            El analizador de URLs de video no evade mecanismos de gestión de derechos digitales (DRM), ni intenta descifrar transmisiones privadas o protegidas por suscripciones de pago. Respeta de forma irrestricta los términos de servicio de los proveedores de contenido.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">3. Responsabilidad</h3>
          <p>
            El software se proporciona «tal cual», garantizando máxima precisión y apego a los estándares web y criptográficos del W3C.
          </p>
        </div>
      )}
    </div>
  );
};
