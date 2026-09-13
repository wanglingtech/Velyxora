import React, { useState, useEffect, useRef } from 'react';
import { Download, Copy, Check, Barcode as BarcodeIcon, Sparkles } from 'lucide-react';
import { ToolDefinition } from '../../../types';
import { renderCode128ToCanvas, generateBarcode } from '../../../services/barcodeEngine';
import { toast } from '../../common/ToastContainer';

interface BarcodeToolRunnerProps {
  tool: ToolDefinition;
}

export const BarcodeToolRunner: React.FC<BarcodeToolRunnerProps> = ({ tool }) => {
  const [barcodeText, setBarcodeText] = useState<string>('VELYX-8942-PRO');
  const [barWidth, setBarWidth] = useState<number>(2);
  const [barHeight, setBarHeight] = useState<number>(90);
  const [includeText, setIncludeText] = useState<boolean>(true);
  const [barColor, setBarColor] = useState<string>('#000000');
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Redraw canvas whenever parameters change
  useEffect(() => {
    if (!canvasRef.current || !barcodeText.trim()) return;

    try {
      setErrorMsg(null);
      renderCode128ToCanvas(canvasRef.current, barcodeText.trim(), {
        width: barWidth,
        height: barHeight,
        includeText,
        color: barColor,
        bgColor
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al generar el código de barras');
    }
  }, [barcodeText, barWidth, barHeight, includeText, barColor, bgColor]);

  const handleDownload = async () => {
    try {
      const { blob } = await generateBarcode(barcodeText.trim(), {
        width: barWidth,
        height: barHeight,
        includeText,
        color: barColor,
        bgColor
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode_${barcodeText.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Código de barras descargado en PNG');
    } catch (err: any) {
      toast.error(err?.message || 'Error al descargar');
    }
  };

  const handleCopy = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('¡Imagen copiada al portapapeles!');
      });
    } catch (err) {
      toast.error('No se pudo copiar la imagen directamente');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Settings Form */}
      <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
        <div>
          <label className="text-xs text-slate-300 block mb-1 font-medium">Texto / Código a Codificar (Code 128)</label>
          <input
            type="text"
            value={barcodeText}
            onChange={(e) => setBarcodeText(e.target.value)}
            placeholder="Ej: PRODUCT-12345"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
          />
          {errorMsg && <p className="text-[11px] text-rose-400 mt-1">{errorMsg}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Grosor de barra:</span>
              <span className="font-mono text-indigo-400">{barWidth}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              value={barWidth}
              onChange={(e) => setBarWidth(Number(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Altura de barras:</span>
              <span className="font-mono text-indigo-400">{barHeight}px</span>
            </div>
            <input
              type="range"
              min={40}
              max={160}
              step={10}
              value={barHeight}
              onChange={(e) => setBarHeight(Number(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Color de Barras</label>
            <input
              type="color"
              value={barColor}
              onChange={(e) => setBarColor(e.target.value)}
              className="w-full h-9 rounded-lg bg-transparent cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Color de Fondo</label>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-full h-9 rounded-lg bg-transparent cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeText}
              onChange={(e) => setIncludeText(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            <span>Mostrar texto legible por humanos debajo de las barras</span>
          </label>
        </div>
      </div>

      {/* Barcode Live Preview & Download */}
      <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-4 bg-white rounded-2xl shadow-xl max-w-full overflow-x-auto">
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Copiado!' : 'Copiar Imagen'}</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={!barcodeText.trim() || !!errorMsg}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Descargar PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
