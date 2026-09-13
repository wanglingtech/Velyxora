import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  FileCode,
  Table,
  FileSpreadsheet,
  Palette,
  GitCompare,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ToolDefinition } from '../../../types';
import {
  csvToJson,
  jsonToCsv,
  markdownToHtml,
  htmlToMarkdown,
  parseColorToAll,
  computeTextDiff,
  DiffLine,
  ColorDetails
} from '../../../services/dataConverterService';
import { toast } from '../../common/ToastContainer';

interface DataAndCodeToolsProps {
  tool: ToolDefinition;
}

export const DataAndCodeTools: React.FC<DataAndCodeToolsProps> = ({ tool }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // CSV <-> JSON States
  const [csvInput, setCsvInput] = useState<string>(
    'nombre,email,rol,activo\nCarlos Mendoza,carlos@velyxora.app,Admin,true\nSofia Valenzuela,sofia@velyxora.app,Editor,true\nMateo Gomez,mateo@velyxora.app,Viewer,false'
  );
  const [csvDelimiter, setCsvDelimiter] = useState<string>('auto');
  const [jsonOutput, setJsonOutput] = useState<string>('');

  const [jsonInput, setJsonInput] = useState<string>(
    JSON.stringify(
      [
        { id: 1, item: 'Licencia Velyxora', precio: 49.99, disponible: true },
        { id: 2, item: 'Servidor Dedicado', precio: 129.00, disponible: true },
        { id: 3, item: 'Soporte Premium', precio: 19.50, disponible: false }
      ],
      null,
      2
    )
  );
  const [csvOutput, setCsvOutput] = useState<string>('');

  // Markdown State
  const [mdInput, setMdInput] = useState<string>(
    '# Bienvenido a VELYXORA\n\nEste es un conversor **Markdown** de alto rendimiento.\n\n### Características:\n- Procesamiento 100% *cliente-side*\n- Soporte para `código inline` y bloques\n- Compatible con [enlaces](https://velyxora.app)\n\n> La privacidad y la velocidad son la prioridad absoluta.'
  );
  const [mdTab, setMdTab] = useState<'preview' | 'code'>('preview');

  // Color Converter State
  const [colorInput, setColorInput] = useState<string>('#6366F1');
  const [colorDetails, setColorDetails] = useState<ColorDetails | null>(
    parseColorToAll('#6366F1')
  );

  // Diff Checker State
  const [diffTextA, setDiffTextA] = useState<string>(
    'function calcularTotal(items) {\n  let total = 0;\n  for (let item of items) {\n    total += item.precio;\n  }\n  return total;\n}'
  );
  const [diffTextB, setDiffTextB] = useState<string>(
    'function calcularTotal(items) {\n  let total = 0;\n  for (let item of items) {\n    if (item.activo) {\n      total += item.precio * 1.16;\n    }\n  }\n  return Math.round(total * 100) / 100;\n}'
  );

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

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Archivo ${filename} descargado`);
  };

  // Run CSV to JSON
  const handleCsvToJson = (pretty: boolean = true) => {
    const res = csvToJson(csvInput, csvDelimiter);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setJsonOutput(JSON.stringify(res.json, null, pretty ? 2 : undefined));
    toast.success(`Convertidas ${res.json.length} filas a JSON`);
  };

  // Run JSON to CSV
  const handleJsonToCsv = () => {
    try {
      const res = jsonToCsv(jsonInput, ',');
      setCsvOutput(res);
      toast.success('JSON transformado a CSV correctamente');
    } catch (err: any) {
      toast.error(err?.message || 'Error al procesar JSON');
    }
  };

  // Run Color Converter
  const handleColorChange = (val: string) => {
    setColorInput(val);
    const parsed = parseColorToAll(val);
    if (parsed) {
      setColorDetails(parsed);
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================== CSV TO JSON ==================== */}
      {tool.id === 'csv-to-json' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-white">Entrada CSV</span>
                <div className="flex items-center gap-1">
                  <span>Delimitador:</span>
                  <select
                    value={csvDelimiter}
                    onChange={(e) => setCsvDelimiter(e.target.value)}
                    className="bg-[#08090D] text-slate-200 border border-white/10 rounded px-1.5 py-0.5 text-[11px]"
                  >
                    <option value="auto">Automático</option>
                    <option value=",">Coma (,)</option>
                    <option value=";">Punto y coma (;)</option>
                    <option value="&#9;">Tabulación (\t)</option>
                  </select>
                </div>
              </div>
              <textarea
                rows={10}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-[#101218] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-white">Salida JSON</span>
                {jsonOutput && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(jsonOutput, 'json-out')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedKey === 'json-out' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'json-out' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                    <button
                      onClick={() => downloadFile(jsonOutput, 'datos_convertidos.json', 'application/json')}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar .JSON</span>
                    </button>
                  </div>
                )}
              </div>
              <textarea
                readOnly
                rows={10}
                value={jsonOutput}
                placeholder="Presiona 'Convertir a JSON' para ver el resultado formateado..."
                className="w-full p-3.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-indigo-300 focus:outline-none select-all"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleCsvToJson(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Convertir a JSON (Pretty)</span>
            </button>
            <button
              onClick={() => handleCsvToJson(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Minificar JSON
            </button>
          </div>
        </div>
      )}

      {/* ==================== JSON TO CSV ==================== */}
      {tool.id === 'json-to-csv' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-white block">Entrada JSON</span>
              <textarea
                rows={10}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-[#101218] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-white">Salida CSV</span>
                {csvOutput && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(csvOutput, 'csv-out')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedKey === 'csv-out' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'csv-out' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                    <button
                      onClick={() => downloadFile(csvOutput, 'datos_exportados.csv', 'text/csv')}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar .CSV</span>
                    </button>
                  </div>
                )}
              </div>
              <textarea
                readOnly
                rows={10}
                value={csvOutput}
                placeholder="Presiona 'Convertir a CSV' para generar la tabla..."
                className="w-full p-3.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-emerald-300 focus:outline-none select-all"
              />
            </div>
          </div>

          <button
            onClick={handleJsonToCsv}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Table className="w-4 h-4" />
            <span>Convertir a CSV</span>
          </button>
        </div>
      )}

      {/* ==================== MARKDOWN TO HTML ==================== */}
      {tool.id === 'markdown-to-html' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-white block">Entrada Markdown (.md)</span>
              <textarea
                rows={12}
                value={mdInput}
                onChange={(e) => setMdInput(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-[#101218] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-1 p-0.5 bg-[#08090D] rounded-lg border border-white/[0.06]">
                  <button
                    onClick={() => setMdTab('preview')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      mdTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Vista Previa
                  </button>
                  <button
                    onClick={() => setMdTab('code')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      mdTab === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Código HTML
                  </button>
                </div>

                <button
                  onClick={() => copyText(markdownToHtml(mdInput), 'md-html')}
                  className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1"
                >
                  {copiedKey === 'md-html' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'md-html' ? 'Copiado' : 'Copiar HTML'}</span>
                </button>
              </div>

              {mdTab === 'preview' ? (
                <div
                  className="w-full h-[280px] p-4 rounded-xl bg-[#08090D] border border-white/[0.08] overflow-y-auto text-xs"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(mdInput) }}
                />
              ) : (
                <textarea
                  readOnly
                  rows={12}
                  value={markdownToHtml(mdInput)}
                  className="w-full p-3.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-indigo-300 focus:outline-none select-all"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== COLOR CONVERTER ==================== */}
      {tool.id === 'color-converter' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Ingresa un valor de color (HEX o RGB)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={colorInput}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#6366F1 o rgb(99, 102, 241)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="color"
                  value={colorDetails ? colorDetails.hex : '#6366F1'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-12 h-10 rounded-xl bg-transparent cursor-pointer p-0.5"
                />
              </div>
            </div>

            {colorDetails && (
              <div className="p-6 rounded-xl border border-white/10 shadow-lg flex items-center justify-center text-center transition-colors"
                style={{ backgroundColor: colorDetails.hex }}
              >
                <span className="px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-white font-mono font-bold text-sm select-all">
                  {colorDetails.hex}
                </span>
              </div>
            )}
          </div>

          {/* Color Values breakdown cards */}
          {colorDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* HEX */}
              <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">HEX</span>
                  <span className="text-sm font-mono font-bold text-white">{colorDetails.hex}</span>
                </div>
                <button
                  onClick={() => copyText(colorDetails.hex, 'hex')}
                  className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
                  title="Copiar HEX"
                >
                  {copiedKey === 'hex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* RGB */}
              <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">RGB</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {`rgb(${colorDetails.rgb.r}, ${colorDetails.rgb.g}, ${colorDetails.rgb.b})`}
                  </span>
                </div>
                <button
                  onClick={() =>
                    copyText(`rgb(${colorDetails.rgb.r}, ${colorDetails.rgb.g}, ${colorDetails.rgb.b})`, 'rgb')
                  }
                  className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
                  title="Copiar RGB"
                >
                  {copiedKey === 'rgb' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* HSL */}
              <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">HSL</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {`hsl(${colorDetails.hsl.h}, ${colorDetails.hsl.s}%, ${colorDetails.hsl.l}%)`}
                  </span>
                </div>
                <button
                  onClick={() =>
                    copyText(
                      `hsl(${colorDetails.hsl.h}, ${colorDetails.hsl.s}%, ${colorDetails.hsl.l}%)`,
                      'hsl'
                    )
                  }
                  className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
                  title="Copiar HSL"
                >
                  {copiedKey === 'hsl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* CMYK */}
              <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">CMYK</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {`${colorDetails.cmyk.c}%, ${colorDetails.cmyk.m}%, ${colorDetails.cmyk.y}%, ${colorDetails.cmyk.k}%`}
                  </span>
                </div>
                <button
                  onClick={() =>
                    copyText(
                      `cmyk(${colorDetails.cmyk.c}%, ${colorDetails.cmyk.m}%, ${colorDetails.cmyk.y}%, ${colorDetails.cmyk.k}%)`,
                      'cmyk'
                    )
                  }
                  className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
                  title="Copiar CMYK"
                >
                  {copiedKey === 'cmyk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== DIFF CHECKER ==================== */}
      {tool.id === 'diff-checker' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-300">Texto Original (A)</span>
              <textarea
                rows={8}
                value={diffTextA}
                onChange={(e) => setDiffTextA(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#101218] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-300">Texto Modificado (B)</span>
              <textarea
                rows={8}
                value={diffTextB}
                onChange={(e) => setDiffTextB(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#101218] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Diff Output Viewer */}
          <div className="p-4 rounded-xl bg-[#08090D] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-xs">
              <span className="font-semibold text-white">Líneas de Diferencia</span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-emerald-400">+ Adiciones</span>
                <span className="text-rose-400">- Eliminaciones</span>
              </div>
            </div>

            <div className="font-mono text-xs max-h-[360px] overflow-y-auto space-y-0.5">
              {computeTextDiff(diffTextA, diffTextB).map((line, idx) => (
                <div
                  key={idx}
                  className={`px-2.5 py-1 rounded flex items-start gap-2 ${
                    line.type === 'added'
                      ? 'bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500'
                      : line.type === 'removed'
                      ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500'
                      : 'text-slate-400'
                  }`}
                >
                  <span className="select-none w-4 text-center shrink-0 opacity-50">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
