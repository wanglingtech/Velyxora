import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, Link as LinkIcon, Lock, MessageCircle } from 'lucide-react';
import { ToolDefinition } from '../../../types';
import { generateQrCode } from '../../../services/conversionEngine';
import {
  buildWhatsAppLink,
  encodeWhatsAppMessage,
  isSafeWhatsAppLink,
  normalizeWhatsAppPhone,
  validateWhatsAppMessage,
  WHATSAPP_MESSAGE_MAX_LENGTH,
} from '../../../services/whatsappService';
import { toast } from '../../common/ToastContainer';

interface WhatsappToolsProps {
  tool: ToolDefinition;
}

export const WhatsappTools: React.FC<WhatsappToolsProps> = ({ tool }) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrBusy, setQrBusy] = useState(false);

  const phoneResult = useMemo(() => (phone.trim() ? normalizeWhatsAppPhone(phone) : null), [phone]);
  const messageError = validateWhatsAppMessage(message);
  const trimmedMessage = message.trim();

  const link = useMemo(() => {
    if (!phone.trim() || !phoneResult?.ok || messageError) return '';
    try {
      return buildWhatsAppLink(phone, message);
    } catch {
      return '';
    }
  }, [phone, message, phoneResult, messageError]);

  const encodedMessage = encodeWhatsAppMessage(message);

  useEffect(() => {
    if (tool.id !== 'whatsapp-qr-generator') return;
    let active = true;
    if (!link) {
      setQrDataUrl('');
      return;
    }
    setQrBusy(true);
    generateQrCode(link, { width: 320, color: '#111827', bgColor: '#FFFFFF' })
      .then((res) => { if (active) setQrDataUrl(res.dataUrl); })
      .catch(() => { if (active) { setQrDataUrl(''); toast.error('No se pudo generar el QR.'); } })
      .finally(() => { if (active) setQrBusy(false); });
    return () => { active = false; };
  }, [link, tool.id]);

  const copy = async (value: string, label = 'Copiado al portapapeles') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  };

  const openLink = (value: string) => {
    if (!isSafeWhatsAppLink(value)) return;
    window.open(value, '_blank', 'noopener,noreferrer');
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = 'velyxora-whatsapp-qr.png';
    anchor.click();
  };

  const fields = (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-300">
          Número con código de país
        </label>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+51 968 555 200"
          className="w-full rounded-xl border border-white/[0.08] bg-[#08090D] px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
        {phoneResult && !phoneResult.ok && (
          <p className="mt-1 text-[11px] text-rose-400">{phoneResult.error}</p>
        )}
        {phoneResult?.ok && (
          <p className="mt-1 text-[11px] text-slate-500">Se usará: {phoneResult.e164}</p>
        )}
        {!phone.trim() && (
          <p className="mt-1 text-[11px] text-slate-500">
            Incluye el código de país. VELYXORA no agrega ninguno automáticamente.
          </p>
        )}
      </div>

      {tool.id !== 'whatsapp-qr-generator' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">
            Mensaje (opcional)
          </label>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hola, quería consultar por…"
            className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#08090D] px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
          <p className={`mt-1 text-[11px] ${messageError ? 'text-rose-400' : 'text-slate-500'}`}>
            {messageError || `${message.length}/${WHATSAPP_MESSAGE_MAX_LENGTH} caracteres`}
          </p>
        </div>
      )}
    </div>
  );

  const privacyNote = (
    <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
      <Lock className="h-3 w-3" />
      Todo se procesa en tu navegador. No se envía nada a VELYXORA ni a WhatsApp.
    </p>
  );

  const shell = (children: React.ReactNode) => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#101218] p-6">
        {fields}
        {privacyNote}
      </div>
      {children}
    </div>
  );

  const outputBox = (children: React.ReactNode) => (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#101218] p-6">
      {children}
    </div>
  );

  if (tool.id === 'whatsapp-link-generator') {
    return shell(outputBox(
      <>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <LinkIcon className="h-4 w-4 text-indigo-400" /> Enlace generado
        </h3>
        {link ? (
          <>
            <input
              readOnly
              value={link}
              className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-xs text-slate-200"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void copy(link, 'Enlace copiado')} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700">
                <Copy className="h-4 w-4" /> Copiar
              </button>
              <button onClick={() => openLink(link)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500">
                <ExternalLink className="h-4 w-4" /> Abrir
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">Ingresa un número válido para generar el enlace.</p>
        )}
      </>
    ));
  }

  if (tool.id === 'whatsapp-message-builder') {
    return shell(outputBox(
      <>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <MessageCircle className="h-4 w-4 text-indigo-400" /> Mensaje codificado
        </h3>
        {trimmedMessage ? (
          <>
            <textarea
              readOnly
              rows={3}
              value={encodedMessage}
              className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-xs text-slate-200"
            />
            <button onClick={() => void copy(encodedMessage, 'Mensaje codificado copiado')} className="inline-flex w-fit min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700">
              <Copy className="h-4 w-4" /> Copiar codificado
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-400">Escribe un mensaje para ver su versión codificada.</p>
        )}

        {link ? (
          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            <p className="text-xs font-medium text-slate-300">Enlace con número</p>
            <input
              readOnly
              value={link}
              className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-xs text-slate-200"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void copy(link, 'Enlace copiado')} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700">
                <Copy className="h-4 w-4" /> Copiar enlace
              </button>
              <button onClick={() => openLink(link)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500">
                <ExternalLink className="h-4 w-4" /> Abrir
              </button>
            </div>
          </div>
        ) : (
          <p className="border-t border-white/[0.06] pt-4 text-xs text-slate-500">
            Agrega un número válido para combinar el mensaje con un enlace de WhatsApp.
          </p>
        )}
      </>
    ));
  }

  return shell(outputBox(
    <>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <MessageCircle className="h-4 w-4 text-indigo-400" /> Código QR de WhatsApp
      </h3>
      {qrDataUrl ? (
        <>
          <div className="grid place-items-center rounded-xl bg-white p-4">
            <img src={qrDataUrl} alt="Código QR del enlace de WhatsApp" className="h-60 w-60" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadQr} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500">
              <Download className="h-4 w-4" /> Descargar PNG
            </button>
            <button onClick={() => void copy(link, 'Enlace copiado')} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700">
              <Copy className="h-4 w-4" /> Copiar enlace
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">
          {qrBusy ? 'Generando QR…' : 'Ingresa un número válido para generar el código QR.'}
        </p>
      )}
      {phone.trim() && phoneResult?.ok && (
        <p className="text-[11px] text-slate-500">El QR solo contiene el enlace generado, sin datos adicionales.</p>
      )}
    </>
  ));
};
