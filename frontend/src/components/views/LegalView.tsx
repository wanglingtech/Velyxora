import React from "react";
import { Lock, Server, ArrowLeft } from "lucide-react";
import { VelyxoraLogo } from "../logo/VelyxoraLogo";

interface LegalViewProps {
  page: "privacy" | "terms" | "about";
  onBack: () => void;
}

export const LegalView: React.FC<LegalViewProps> = ({ page, onBack }) => {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 py-2">
      <button
        onClick={onBack}
        className="min-h-11 px-3 rounded-xl border border-white/10 text-sm text-slate-300 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-indigo-400"
      >
        <ArrowLeft className="w-4 h-4" />
        Regresar
      </button>
      <div className="text-center space-y-3 pb-4 border-b border-white/[0.08]">
        <VelyxoraLogo
          variant="full"
          size="lg"
          className="justify-center"
          showTagline
        />
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {page === "privacy"
            ? "Política de Privacidad & Procesamiento de Datos"
            : page === "terms"
              ? "Términos de Servicio & Cumplimiento Legal"
              : "Acerca de VELYXORA"}
        </h2>
      </div>

      {page === "about" && (
        <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-300 space-y-4 leading-relaxed">
          <p>
            <strong className="text-white">VELYXORA</strong> es una plataforma
            universal y moderna de conversión, procesamiento multimedia y
            utilidades digitales concebida como un entorno unificado de trabajo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 not-prose">
            <div className="p-4 rounded-xl bg-[#101218] border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <Lock className="w-4 h-4" />
                <span>CLIENT_SIDE (Navegador)</span>
              </div>
              <p className="text-xs text-slate-400">
                Las tareas de imágenes, recortado de audio, formateo de código,
                hash criptográfico y códigos QR se ejecutan directamente en la
                memoria de tu navegador mediante HTML5 Canvas, Web Audio y Web
                Crypto. En estas herramientas LOCAL, el archivo se procesa en
                tu dispositivo y no se envía para ejecutar la operación.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#101218] border border-sky-500/20 space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                <Server className="w-4 h-4" />
                <span>SERVER_SIDE / HYBRID</span>
              </div>
              <p className="text-xs text-slate-400">
                Las operaciones SERVER envían el archivo al backend para
                procesarlo temporalmente con FFmpeg, LibreOffice u otros motores
                disponibles. El almacenamiento temporal se limpia conforme a la
                configuración técnica del servidor.
              </p>
            </div>
          </div>
        </div>
      )}

      {page === "privacy" && (
        <div className="text-xs sm:text-sm text-slate-300 space-y-4 leading-relaxed">
          <h3 className="text-sm sm:text-base font-semibold text-white">
            1. Principio Fundamental: Procesamiento Local
          </h3>
          <p>
            Las herramientas{" "}
            <span className="text-emerald-400 font-mono">LOCAL</span> se
            procesan en el navegador y el archivo no se envía al backend para
            realizar la operación. Las herramientas{" "}
            <span className="text-sky-400 font-mono">SERVER</span> requieren
            cuenta cuando aplican créditos: el archivo se transmite
            temporalmente al backend, junto con metadata mínima del job, y se
            elimina según la política técnica de retención. Las herramientas{" "}
            <span className="text-amber-400 font-mono">EXTERNAL</span> dependen
            de proveedores externos y su disponibilidad puede cambiar.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            2. Almacenamiento Local (LocalStorage)
          </h3>
          <p>
            El historial local almacena metadatos mínimos para tu conveniencia y
            no guarda copias binarias. La sincronización de historial en cuenta
            solo debe conservar metadata necesaria; los blobs, rutas internas y
            contenido de archivos no forman parte de ese historial.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            3. Telemetría y Analíticas
          </h3>
          <p>
            No transmitimos nombres de archivos privados ni parámetros sensibles
            a redes de publicidad o rastreadores de terceros.
          </p>
          <p>
            Las herramientas LOCAL pueden utilizarse sin cuenta. Al iniciar
            sesión no se migra automáticamente el historial que ya exista en
            el dispositivo; permanece local salvo una decisión futura explícita.
          </p>
          <h3 className="text-sm sm:text-base font-semibold text-white">
            4. Cuenta, créditos y pagos beta
          </h3>
          <p>
            Podemos guardar email normalizado, display name si se proporciona,
            hash de contraseña, sesiones, estado y rol, plan, ledger de
            créditos, metadata mínima de jobs e historial sincronizado, órdenes
            y pagos manuales beta, y
            logs administrativos mínimos. Las referencias de operación quedan
            pendientes de revisión hasta su aprobación. No almacenamos
            contraseñas en texto plano, tarjetas, CVV, cookies sociales ni
            credenciales de proveedores. Este texto es informativo y requiere
            revisión legal profesional.
          </p>
        </div>
      )}

      {page === "terms" && (
        <div className="text-xs sm:text-sm text-slate-300 space-y-4 leading-relaxed">
          <h3 className="text-sm sm:text-base font-semibold text-white">
            1. Uso Aceptable
          </h3>
          <p>
            Al utilizar las herramientas de VELYXORA te comprometes a procesar
            únicamente archivos y medios digitales sobre los cuales posees los
            derechos de autor legítimos o las autorizaciones pertinentes.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            2. Media Downloader & Restricciones
          </h3>
          <p>
            VELYXORA es una herramienta técnica de conversión y procesamiento.
            El usuario debe tener autorización para descargar o procesar el
            contenido, respetar los derechos de autor y los términos del
            proveedor original. No debe utilizarse para acceder a contenido
            privado, protegido o restringido.
          </p>
          <p>
            No se almacenan credenciales, cookies ni sesiones de terceros. No se
            evade DRM, autenticación ni paywalls. La compatibilidad no es
            permanente: los proveedores externos pueden cambiar sus sistemas.
          </p>
          <p>
            La beta pública solo admite YouTube, TikTok, Instagram, Facebook,
            X/Twitter, Vimeo, Reddit, Twitch y SoundCloud. Otros proveedores se
            rechazan antes de ejecutar el extractor.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            3. Pagos manuales beta
          </h3>
          <p>
            VELYXORA no verifica Yape automáticamente. Una referencia enviada
            queda pendiente de revisión administrativa; solo su aprobación
            manual acredita el ledger. No existe todavía una pasarela
            automática.
          </p>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            4. Responsabilidad
          </h3>
          <p>
            El servicio se proporciona «tal cual» y puede estar en desarrollo o
            beta. No se garantiza disponibilidad, compatibilidad permanente con
            proveedores externos ni ausencia de fallos en motores de conversión.
            Este texto no constituye asesoría legal y queda marcado como
            revisión legal requerida.
          </p>
        </div>
      )}
    </div>
  );
};
