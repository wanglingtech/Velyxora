import React, { useState, useEffect } from 'react';
import {
  Ratio,
  Clock,
  HardDrive,
  Video,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Info,
  Calendar
} from 'lucide-react';
import { ToolDefinition } from '../../../types';
import { inspectVideoMetadata } from '../../../services/conversionEngine';
import { formatFileSize, formatDuration } from '../../../services/detectionService';
import { toast } from '../../common/ToastContainer';
import { apiClient } from '../../../services/apiClient';

interface UtilitiesToolRunnerProps {
  tool: ToolDefinition;
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
}

export const UtilitiesToolRunner: React.FC<UtilitiesToolRunnerProps> = ({
  tool,
  selectedFile,
  onFileSelect
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Aspect Ratio States
  const [arWidth, setArWidth] = useState<number>(1920);
  const [arHeight, setArHeight] = useState<number>(1080);
  const [ratioPreset, setRatioPreset] = useState<string>('16:9');

  // Timestamp States
  const [epochInput, setEpochInput] = useState<string>(Math.floor(Date.now() / 1000).toString());
  const [parsedDate, setParsedDate] = useState<Date>(new Date());
  const [customDateStr, setCustomDateStr] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  // Storage Unit Converter States
  const [unitVal, setUnitVal] = useState<number>(10);
  const [unitSource, setUnitSource] = useState<'B' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB'>('GB');
  const [isBinaryBase, setIsBinaryBase] = useState<boolean>(true); // true = 1024, false = 1000

  // Video Inspector States
  const [videoMeta, setVideoMeta] = useState<{
    duration: number;
    width: number;
    height: number;
    aspectRatio: string;
    aspectRatioDecimal: number;
    mimeType: string;
    size: number;
    estimatedBitrateKbps: number;
  } | null>(null);
  const [serverMeta, setServerMeta] = useState<any>(null);
  const [serverProbeStatus, setServerProbeStatus] = useState<'idle'|'loading'|'ready'|'unavailable'>('idle');

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      toast.success('¡Copiado!');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  // Calculate Aspect Ratio on preset click
  const handleRatioPresetChange = (r: string) => {
    setRatioPreset(r);
    const [rw, rh] = r.split(':').map(Number);
    if (rw && rh && arWidth) {
      setArHeight(Math.round((arWidth * rh) / rw));
    }
  };

  // Parse epoch input
  useEffect(() => {
    const num = Number(epochInput.trim());
    if (!isNaN(num) && num > 0) {
      // If seconds (length < 12), multiply by 1000
      const ms = epochInput.trim().length <= 10 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        setParsedDate(d);
      }
    }
  }, [epochInput]);

  // Inspect Video when file is loaded
  useEffect(() => {
    if (tool.id === 'video-metadata-inspector' && selectedFile && selectedFile.type.startsWith('video/')) {
      inspectVideoMetadata(selectedFile)
        .then(setVideoMeta)
        .catch((err) => toast.error(err.message || 'Error al inspeccionar video'));
      setServerMeta(null); setServerProbeStatus('loading');
      apiClient.uploadFile(selectedFile).then(({ fileId }) => apiClient.probeMedia(fileId)).then((data) => { setServerMeta(data); setServerProbeStatus('ready'); }).catch(() => setServerProbeStatus('unavailable'));
    }
  }, [tool.id, selectedFile]);

  // Unit converter multiplier
  const base = isBinaryBase ? 1024 : 1000;
  const unitPower: Record<string, number> = {
    B: 0,
    KB: 1,
    MB: 2,
    GB: 3,
    TB: 4,
    PB: 5
  };
  const totalBytes = (unitVal || 0) * Math.pow(base, unitPower[unitSource] || 0);

  return (
    <div className="space-y-6">
      {tool.id === 'video-metadata-inspector' && <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/10 bg-[#101218] p-6 text-center hover:border-indigo-500/50"><Video className="mx-auto mb-2 h-8 w-8 text-indigo-300"/><span className="text-sm text-slate-200">{selectedFile ? selectedFile.name : 'Selecciona un video para inspeccionarlo'}</span><input type="file" accept="video/*" className="hidden" onChange={(e)=>e.target.files?.[0]&&onFileSelect(e.target.files[0])}/></label>}
      {/* ==================== ASPECT RATIO CALCULATOR ==================== */}
      {tool.id === 'aspect-ratio-calculator' && (
        <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-6">
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
              Proporciones Populares
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { r: '16:9', label: '16:9 (Video HD / TV)' },
                { r: '4:3', label: '4:3 (Fotografía / iPad)' },
                { r: '1:1', label: '1:1 (Cuadrado / Post)' },
                { r: '9:16', label: '9:16 (Stories / Reels)' },
                { r: '21:9', label: '21:9 (UltraWide Cinema)' }
              ].map((item) => (
                <button
                  key={item.r}
                  onClick={() => handleRatioPresetChange(item.r)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    ratioPreset === item.r
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-[#08090D] text-slate-300 border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <span className="font-mono font-bold text-xs block">{item.r}</span>
                  <span className="text-[10px] text-slate-400 block truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Ancho (Width en px)</label>
              <input
                type="number"
                value={arWidth}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setArWidth(val);
                  const [rw, rh] = ratioPreset.split(':').map(Number);
                  if (rw && rh) setArHeight(Math.round((val * rh) / rw));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Alto (Height en px)</label>
              <input
                type="number"
                value={arHeight}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setArHeight(val);
                  const [rw, rh] = ratioPreset.split(':').map(Number);
                  if (rw && rh) setArWidth(Math.round((val * rw) / rh));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Visual Ratio Box */}
          <div className="p-8 bg-[#08090D] border border-white/[0.06] rounded-xl flex flex-col items-center justify-center">
            <div
              className="border-2 border-dashed border-indigo-500/60 bg-indigo-500/10 rounded-lg flex items-center justify-center text-center max-w-full transition-all"
              style={{
                width: Math.min(280, Math.round(arWidth / 6)),
                height: Math.min(220, Math.round(arHeight / 6))
              }}
            >
              <span className="text-xs font-mono font-bold text-indigo-300">
                {arWidth} × {arHeight}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-2 font-mono">
              Relación decimal: {(arWidth / (arHeight || 1)).toFixed(2)} : 1
            </span>
          </div>
        </div>
      )}

      {/* ==================== TIMESTAMP CONVERTER ==================== */}
      {tool.id === 'timestamp-converter' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white uppercase tracking-wider">
                Unix Timestamp (Epoch en segundos o ms)
              </label>
              <button
                onClick={() => setEpochInput(Math.floor(Date.now() / 1000).toString())}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Ahora mismo</span>
              </button>
            </div>

            <input
              type="text"
              value={epochInput}
              onChange={(e) => setEpochInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
            />

            {/* Formatted Date Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hora Local</span>
                  <span className="text-xs font-mono font-medium text-white">{parsedDate.toLocaleString()}</span>
                </div>
                <button
                  onClick={() => copyText(parsedDate.toLocaleString(), 'local')}
                  className="p-1.5 rounded text-slate-400 hover:text-white"
                >
                  {copiedKey === 'local' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hora UTC</span>
                  <span className="text-xs font-mono font-medium text-white">{parsedDate.toUTCString()}</span>
                </div>
                <button
                  onClick={() => copyText(parsedDate.toUTCString(), 'utc')}
                  className="p-1.5 rounded text-slate-400 hover:text-white"
                >
                  {copiedKey === 'utc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06] flex items-center justify-between sm:col-span-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Formato ISO 8601</span>
                  <span className="text-xs font-mono font-medium text-indigo-300">{parsedDate.toISOString()}</span>
                </div>
                <button
                  onClick={() => copyText(parsedDate.toISOString(), 'iso')}
                  className="p-1.5 rounded text-slate-400 hover:text-white"
                >
                  {copiedKey === 'iso' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DIGITAL STORAGE CONVERTER ==================== */}
      {tool.id === 'unit-converter' && (
        <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="number"
                value={unitVal}
                onChange={(e) => setUnitVal(Number(e.target.value))}
                className="w-32 px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-sm font-mono text-white focus:outline-none"
              />
              <select
                value={unitSource}
                onChange={(e) => setUnitSource(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-semibold text-white focus:outline-none"
              >
                {['B', 'KB', 'MB', 'GB', 'TB', 'PB'].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 p-1 bg-[#08090D] rounded-xl border border-white/[0.06]">
              <button
                onClick={() => setIsBinaryBase(true)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isBinaryBase ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Base 1024 (Binario)
              </button>
              <button
                onClick={() => setIsBinaryBase(false)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  !isBinaryBase ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Base 1000 (Decimal)
              </button>
            </div>
          </div>

          {/* Conversion Table Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const).map((unit) => {
              const p = unitPower[unit];
              const converted = totalBytes / Math.pow(base, p);
              const formatted =
                converted >= 1
                  ? converted.toLocaleString(undefined, { maximumFractionDigits: 4 })
                  : converted.toExponential(3);

              return (
                <div
                  key={unit}
                  className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06] flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">{unit}</span>
                    <span className="text-sm font-mono font-bold text-white">{formatted}</span>
                  </div>
                  <button
                    onClick={() => copyText(converted.toString(), unit)}
                    className="p-1 rounded text-slate-500 hover:text-white"
                  >
                    {copiedKey === unit ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== VIDEO METADATA INSPECTOR ==================== */}
      {tool.id === 'video-metadata-inspector' && (
        <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
          {!selectedFile ? (
            <div className="p-8 border-2 border-dashed border-white/10 rounded-xl text-center">
              <Video className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                Selecciona un archivo de video arriba para analizar sus metadatos técnicos en profundidad.
              </p>
            </div>
          ) : videoMeta ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Resolución</span>
                <p className="text-sm font-mono font-bold text-white">
                  {videoMeta.width} × {videoMeta.height}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Aspect Ratio</span>
                <p className="text-sm font-mono font-bold text-indigo-400">{videoMeta.aspectRatio}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Duración</span>
                <p className="text-sm font-mono font-bold text-white">{formatDuration(videoMeta.duration)}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Bitrate estimado local</span>
                <p className="text-sm font-mono font-bold text-emerald-400">
                  {videoMeta.estimatedBitrateKbps} kbps
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Tamaño de Archivo</span>
                <p className="text-sm font-mono font-bold text-white">{formatFileSize(videoMeta.size)}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090D] border border-white/[0.06] sm:col-span-3">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Tipo declarado por el archivo</span>
                <p className="text-xs font-mono font-medium text-slate-300">{videoMeta.mimeType} (no identifica el códec)</p>
              </div>
              {serverProbeStatus === 'loading' && <p className="col-span-full text-xs text-slate-400">Obteniendo datos técnicos exactos con FFprobe…</p>}
              {serverProbeStatus === 'unavailable' && <p className="col-span-full rounded-xl border border-amber-500/20 p-3 text-xs text-amber-200">Metadata local disponible. Inicia sesión y verifica que FFprobe esté activo para ver códecs y parámetros exactos.</p>}
              {serverMeta && (()=>{const video=serverMeta.streams.find((s:any)=>s.codecType==='video');const audio=serverMeta.streams.find((s:any)=>s.codecType==='audio');const fpsRaw=video?.avg_frame_rate||video?.r_frame_rate;const [n,d]=String(fpsRaw||'0/1').split('/').map(Number);const fps=d? n/d:0;return <><div className="col-span-full mt-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">FFprobe · datos técnicos</div><Meta label="Contenedor" value={serverMeta.format}/><Meta label="Códec de video" value={video?.codecName}/><Meta label="FPS" value={fps?fps.toFixed(3):undefined}/><Meta label="Bitrate total" value={serverMeta.bitRate?`${Math.round(serverMeta.bitRate/1000)} kbps`:undefined}/><Meta label="Códec de audio" value={audio?.codecName}/><Meta label="Sample rate" value={audio?.sampleRate?`${audio.sampleRate} Hz`:undefined}/><Meta label="Canales" value={audio?.channels}/></>})()}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center">Analizando flujo multimedia...</p>
          )}
        </div>
      )}
    </div>
  );
};

function Meta({label,value}:{label:string;value:React.ReactNode}) { return <div className="rounded-xl border border-white/[0.06] bg-[#08090D] p-3"><span className="block text-[10px] uppercase text-slate-400">{label}</span><strong className="font-mono text-sm text-white">{value ?? 'No informado'}</strong></div>; }
