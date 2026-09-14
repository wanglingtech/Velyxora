import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Download,
  Copy,
  Check,
  Pipette,
  Layers,
  Code,
  Image as ImageIcon,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { ToolDefinition } from '../../../types';
import {
  renderSvgToRaster,
  applyImageFilters,
  applyWatermark,
  extractDominantColors
} from '../../../services/conversionEngine';
import { toast } from '../../common/ToastContainer';
import { formatFileSize } from '../../../services/detectionService';

interface ImageAdvancedToolsProps {
  tool: ToolDefinition;
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
}

export const ImageAdvancedTools: React.FC<ImageAdvancedToolsProps> = ({
  tool,
  selectedFile,
  onFileSelect
}) => {
  // Common states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // SVG to Raster states
  const [svgScale, setSvgScale] = useState<number>(2);
  const [svgWidth, setSvgWidth] = useState(200);
  const [svgHeight, setSvgHeight] = useState(200);
  const [svgAspectLocked, setSvgAspectLocked] = useState(true);
  const [svgBackground, setSvgBackground] = useState('#FFFFFF');
  const [svgCode, setSvgCode] = useState<string>(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'
  );
  const [svgMode, setSvgMode] = useState<'file' | 'code'>('code');
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null);

  // Filters state
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);
  const [invert, setInvert] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);
  const [filterFormat, setFilterFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');

  // Watermark state
  const [wmText, setWmText] = useState<string>('© 2025 VELYXORA');
  const [wmOpacity, setWmOpacity] = useState<number>(0.75);
  const [wmColor, setWmColor] = useState<string>('#FFFFFF');
  const [wmPos, setWmPos] = useState<'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');

  // Dominant Colors state
  const [palette, setPalette] = useState<Array<{ hex: string; rgb: string; percentage: number }>>([]);
  const [pickedColor, setPickedColor] = useState<{ hex: string; rgb: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Base64 state
  const [base64Uri, setBase64Uri] = useState<string>('');
  const [base64Format, setBase64Format] = useState<'data-uri' | 'html' | 'css' | 'markdown'>('data-uri');

  // Preview URL for selected image
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewSrc(url);

      // If color picker tool, extract dominant colors
      if (tool.id === 'color-picker-image') {
        extractDominantColors(selectedFile, 8).then(setPalette).catch(() => {});
      }

      // If image-to-base64 tool, read file as Data URL
      if (tool.id === 'image-to-base64') {
        const reader = new FileReader();
        reader.onload = () => {
          setBase64Uri(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      }

      return () => URL.revokeObjectURL(url);
    }
  }, [selectedFile, tool.id]);

  useEffect(() => {
    if (!['svg-to-png', 'svg-to-jpg'].includes(tool.id)) return;
    let active = true;
    let objectUrl = '';
    const load = async () => {
      const source = svgMode === 'file' ? selectedFile : null;
      if (svgMode === 'file' && (!source || !/svg/i.test(source.type || source.name))) { setSvgPreviewUrl(null); return; }
      const blob = source || new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);
      if (active) setSvgPreviewUrl(objectUrl);
    };
    void load();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [selectedFile, svgCode, svgMode, tool.id]);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      toast.success('¡Copiado al portapapeles!');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  // SVG Export handler
  const handleExportSvg = async () => {
    try {
      setIsProcessing(true);
      const isJpg = tool.id === 'svg-to-jpg';
      const targetFormat = isJpg ? 'image/jpeg' : 'image/png';
      const source = svgMode === 'file' && selectedFile ? selectedFile : svgCode;

      const result = await renderSvgToRaster(source, targetFormat, svgScale, { width: svgWidth, height: svgHeight, background: isJpg ? svgBackground : undefined });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Imagen rasterizada y descargada en ${result.width}x${result.height}px`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al procesar SVG');
    } finally {
      setIsProcessing(false);
    }
  };

  // Image Filters Export handler
  const handleExportFiltered = async () => {
    if (!selectedFile) {
      toast.error('Selecciona una imagen primero');
      return;
    }
    try {
      setIsProcessing(true);
      const res = await applyImageFilters(selectedFile, {
        brightness,
        contrast,
        saturation,
        grayscale,
        sepia,
        invert,
        blur,
        format: filterFormat
      });

      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('¡Imagen procesada con filtros descargada!');
    } catch (err: any) {
      toast.error(err?.message || 'Error al aplicar filtros');
    } finally {
      setIsProcessing(false);
    }
  };

  // Watermark Export handler
  const handleExportWatermark = async () => {
    if (!selectedFile) {
      toast.error('Selecciona una imagen primero');
      return;
    }
    try {
      setIsProcessing(true);
      const res = await applyWatermark(selectedFile, {
        text: wmText,
        opacity: wmOpacity,
        color: wmColor,
        position: wmPos
      });

      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('¡Imagen con marca de agua exportada!');
    } catch (err: any) {
      toast.error(err?.message || 'Error al exportar');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
    setSepia(0);
    setInvert(0);
    setBlur(0);
  };

  return (
    <div className="space-y-6">
      {!['svg-to-png','svg-to-jpg'].includes(tool.id) && <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/10 bg-[#101218] p-6 text-center hover:border-indigo-500/50"><ImageIcon className="mx-auto mb-2 h-8 w-8 text-indigo-300"/><span className="block text-sm text-slate-200">{selectedFile ? selectedFile.name : 'Selecciona o arrastra una imagen'}</span>{selectedFile&&<span className="mt-1 block text-xs text-slate-500">{formatFileSize(selectedFile.size)}</span>}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e)=>e.target.files?.[0]&&onFileSelect(e.target.files[0])}/></label>}
      {/* ==================== SVG TO PNG / JPG ==================== */}
      {(tool.id === 'svg-to-png' || tool.id === 'svg-to-jpg') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
            <div className="flex gap-2 p-1 bg-[#08090D] rounded-xl border border-white/[0.06]">
              <button
                onClick={() => setSvgMode('code')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  svgMode === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Código SVG
              </button>
              <button
                onClick={() => setSvgMode('file')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  svgMode === 'file' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Subir Archivo .SVG
              </button>
            </div>

            {svgMode === 'code' ? (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Código XML/SVG</label>
                <textarea
                  rows={8}
                  value={svgCode}
                  onChange={(e) => setSvgCode(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-indigo-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            ) : (
              <div>
                <label className="block p-8 border-2 border-dashed border-white/10 rounded-xl text-center cursor-pointer hover:border-indigo-500/50 transition-colors">
                  <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <span className="text-xs text-slate-300 font-medium">
                    {selectedFile ? selectedFile.name : 'Haz clic para subir un archivo .svg'}
                  </span>
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Multiplicador de Resolución:</span>
                <span className="font-mono text-indigo-400 font-bold">{svgScale}x</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 8].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSvgScale(s)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      svgScale === s
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-[#08090D] text-slate-400 border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {s}x ({s >= 4 ? 'Ultra HD' : s === 2 ? 'HD' : 'Estándar'})
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">Ancho base (px)<input type="number" min={1} max={8192} value={svgWidth} onChange={(e) => { const width=Math.max(1, Number(e.target.value)); setSvgWidth(width); if (svgAspectLocked) setSvgHeight(width); }} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#08090D] p-2 text-white" /></label>
              <label className="text-xs text-slate-400">Alto base (px)<input type="number" min={1} max={8192} value={svgHeight} onChange={(e) => { const height=Math.max(1, Number(e.target.value)); setSvgHeight(height); if (svgAspectLocked) setSvgWidth(height); }} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#08090D] p-2 text-white" /></label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={svgAspectLocked} onChange={(e)=>setSvgAspectLocked(e.target.checked)} className="accent-indigo-500" />Bloquear proporción 1:1</label>
            {tool.id === 'svg-to-jpg' && <label className="text-xs text-slate-400">Fondo JPEG<input type="color" value={svgBackground} onChange={(e)=>setSvgBackground(e.target.value)} className="ml-3 h-8 w-14 align-middle" /></label>}

            <button
              onClick={handleExportSvg}
              disabled={isProcessing || (svgMode === 'file' && !selectedFile)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Renderizando...'
                  : `Exportar a ${tool.id === 'svg-to-jpg' ? 'JPEG' : 'PNG'}`}
              </span>
            </button>
          </div>

          {/* SVG Preview Card */}
          <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] flex flex-col items-center justify-center text-center">
            <h4 className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Previsualización Vectorial</h4>
            <div className="p-6 border border-white/[0.06] rounded-2xl w-full min-h-64 overflow-hidden flex items-center justify-center" style={{ backgroundColor: tool.id === 'svg-to-jpg' ? svgBackground : '#08090D' }}>
              {svgPreviewUrl ? <img src={svgPreviewUrl} alt="Previsualización SVG" className="max-h-[280px] max-w-full object-contain" onError={()=>setSvgPreviewUrl(null)} /> : <p className="text-xs text-rose-300">SVG inválido o no compatible.</p>}
            </div>
            <p className="mt-3 text-xs text-slate-400">Salida: {svgWidth * svgScale} × {svgHeight * svgScale} px</p>
          </div>
        </div>
      )}

      {/* ==================== IMAGE FILTERS ==================== */}
      {tool.id === 'image-filters' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Ajustes Cromáticos</h4>
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            </div>

            {/* Brightness */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Brillo</span>
                <span className="font-mono text-indigo-400">{brightness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Contrast */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Contraste</span>
                <span className="font-mono text-indigo-400">{contrast}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Saturation */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Saturación</span>
                <span className="font-mono text-indigo-400">{saturation}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={saturation}
                onChange={(e) => setSaturation(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Grayscale */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Escala de Grises</span>
                <span className="font-mono text-indigo-400">{grayscale}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={grayscale}
                onChange={(e) => setGrayscale(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sepia */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Efecto Sepia</span>
                <span className="font-mono text-indigo-400">{sepia}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sepia}
                onChange={(e) => setSepia(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Blur */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Desenfoque (Blur)</span>
                <span className="font-mono text-indigo-400">{blur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={blur}
                onChange={(e) => setBlur(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Format choice */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Formato de Salida</label>
              <div className="grid grid-cols-3 gap-2">
                {(['image/jpeg', 'image/png', 'image/webp'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFilterFormat(fmt)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border uppercase transition-colors ${
                      filterFormat === fmt
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-[#08090D] text-slate-400 border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {fmt.split('/')[1]}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleExportFiltered}
              disabled={isProcessing || !selectedFile}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isProcessing ? 'Procesando...' : 'Descargar con Filtros'}</span>
            </button>
          </div>

          {/* Live Filtered Preview (Right 2 cols) */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#101218] border border-white/[0.08] flex flex-col items-center justify-center">
            {previewSrc ? (
              <div className="max-w-full max-h-[440px] overflow-hidden rounded-xl border border-white/10">
                <img
                  src={previewSrc}
                  alt="Live Filter Preview"
                  style={{
                    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%) sepia(${sepia}%) invert(${invert}%) blur(${blur}px)`
                  }}
                  className="max-w-full max-h-[420px] object-contain transition-all duration-75"
                />
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Sliders className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sube o selecciona una foto arriba para ver los filtros en tiempo real.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== IMAGE WATERMARK ==================== */}
      {tool.id === 'image-watermark' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Texto de la Marca de Agua</label>
              <input
                type="text"
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                placeholder="© Tu Nombre / Marca"
                className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Posición en la Imagen</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'top-left', label: 'Arr. Izq.' },
                  { id: 'center', label: 'Centro' },
                  { id: 'top-right', label: 'Arr. Der.' },
                  { id: 'bottom-left', label: 'Abj. Izq.' },
                  { id: 'bottom-right', label: 'Abj. Der.' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setWmPos(p.id as any)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      wmPos === p.id
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-[#08090D] text-slate-400 border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Opacidad:</span>
                <span className="font-mono text-indigo-400">{Math.round(wmOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Color del Texto</label>
              <input
                type="color"
                value={wmColor}
                onChange={(e) => setWmColor(e.target.value)}
                className="w-full h-9 rounded-lg bg-transparent cursor-pointer"
              />
            </div>

            <button
              onClick={handleExportWatermark}
              disabled={isProcessing || !selectedFile}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isProcessing ? 'Procesando...' : 'Descargar con Marca de Agua'}</span>
            </button>
          </div>

          {/* Watermark Preview */}
          <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] flex items-center justify-center">
            {previewSrc ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10 max-h-[380px]">
                <img src={previewSrc} alt="Preview" className="max-h-[360px] object-contain" />
                <div
                  className={`absolute ${
                    wmPos === 'bottom-right'
                      ? 'bottom-3 right-3'
                      : wmPos === 'bottom-left'
                      ? 'bottom-3 left-3'
                      : wmPos === 'top-right'
                      ? 'top-3 right-3'
                      : wmPos === 'top-left'
                      ? 'top-3 left-3'
                      : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                  } font-bold text-sm select-none drop-shadow-md`}
                  style={{ color: wmColor, opacity: wmOpacity }}
                >
                  {wmText}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sube una foto arriba para previsualizar la marca de agua.</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== COLOR PICKER & PALETTE ==================== */}
      {tool.id === 'color-picker-image' && (
        <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Paleta Cromática Dominante
            </h4>
            <span className="text-[11px] text-slate-400">Haz clic en cualquier muestra para copiar su código HEX</span>
          </div>

          {/* Palette Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {palette.map((c, i) => (
              <button
                key={i}
                onClick={() => copyText(c.hex, `pal-${i}`)}
                className="p-3 rounded-xl bg-[#08090D] border border-white/[0.06] hover:border-indigo-500/40 text-left transition-all group"
              >
                <div
                  className="w-full h-12 rounded-lg mb-2 shadow-inner border border-white/10"
                  style={{ backgroundColor: c.hex }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white">{c.hex}</span>
                  <span className="text-[10px] font-mono text-slate-500">{c.percentage}%</span>
                </div>
                <span className="text-[10px] text-slate-400 block truncate">{c.rgb}</span>
              </button>
            ))}
          </div>

          {previewSrc && (
            <div className="pt-2 text-center">
              <p className="text-xs text-slate-400 mb-2">Imagen analizada:</p>
              <img src={previewSrc} alt="Analizada" className="max-h-56 mx-auto rounded-xl border border-white/10" />
            </div>
          )}
        </div>
      )}

      {/* ==================== IMAGE TO BASE64 ==================== */}
      {tool.id === 'image-to-base64' && (
        <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Código Base64 Generado
            </h4>
            <span className="text-xs font-mono text-slate-400">
              {base64Uri ? `${formatFileSize(base64Uri.length)} (URI)` : 'Esperando imagen'}
            </span>
          </div>

          <div className="flex gap-2 p-1 bg-[#08090D] rounded-xl border border-white/[0.06]">
            {(['data-uri', 'html', 'css', 'markdown'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setBase64Format(fmt)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors ${
                  base64Format === fmt ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <textarea
            readOnly
            rows={8}
            value={
              base64Format === 'data-uri'
                ? base64Uri
                : base64Format === 'html'
                ? `<img src="${base64Uri}" alt="Embedded Image" />`
                : base64Format === 'css'
                ? `background-image: url("${base64Uri}");`
                : `![Embedded Image](${base64Uri})`
            }
            placeholder="Sube una foto arriba para obtener su representación Base64..."
            className="w-full p-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-indigo-300 focus:outline-none select-all resize-y"
          />

          <div className="flex justify-end">
            <button
              onClick={() => {
                const val =
                  base64Format === 'data-uri'
                    ? base64Uri
                    : base64Format === 'html'
                    ? `<img src="${base64Uri}" alt="Embedded Image" />`
                    : base64Format === 'css'
                    ? `background-image: url("${base64Uri}");`
                    : `![Embedded Image](${base64Uri})`;
                copyText(val, 'b64');
              }}
              disabled={!base64Uri}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
            >
              {copiedKey === 'b64' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedKey === 'b64' ? '¡Copiado!' : 'Copiar al Portapapeles'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
