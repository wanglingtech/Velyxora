import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Upload,
  Download,
  Trash2,
  MoveUp,
  MoveDown,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ToolDefinition } from "../../../types";
import {
  createPdfFromImages,
  createPdfFromText,
} from "../../../services/pdfEngine";
import { historyService } from "../../../services/historyService";
import { toast } from "../../common/ToastContainer";
import { formatFileSize } from "../../../services/detectionService";

interface PdfToolRunnerProps {
  tool: ToolDefinition;
  initialFile?: File;
}

export const PdfToolRunner: React.FC<PdfToolRunnerProps> = ({
  tool,
  initialFile,
}) => {
  // Images to PDF state
  const [imageFiles, setImageFiles] = useState<File[]>(
    initialFile && initialFile.type.startsWith("image/") ? [initialFile] : [],
  );
  const [pageSize, setPageSize] = useState<"A4" | "Letter" | "Fit">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait",
  );
  const [margin, setMargin] = useState<number>(20);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>(
    "documento_compilado.pdf",
  );

  // Revoke object URL on unmount or URL replacement
  useEffect(() => {
    return () => {
      if (downloadUrl && downloadUrl.startsWith("blob:")) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  // Text to PDF state
  const [docTitle, setDocTitle] = useState<string>("Documento Oficial");
  const [docContent, setDocContent] = useState<string>(
    "Escribe o pega aquí el contenido de tu documento para compilarlo directamente a un PDF formal con saltos de línea y formateo de página estándar...",
  );

  // File addition handler
  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter((f: File) =>
        f.type.startsWith("image/"),
      );
      if (newFiles.length === 0) {
        toast.error(
          "Por favor selecciona archivos de imagen válidos (JPG, PNG, WebP)",
        );
        return;
      }
      setImageFiles((prev) => [...prev, ...newFiles]);
      setDownloadUrl(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setDownloadUrl(null);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === imageFiles.length - 1)
    )
      return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const newArr = [...imageFiles];
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setImageFiles(newArr);
    setDownloadUrl(null);
  };

  // Compile Images to PDF
  const handleCompileImagesToPdf = async () => {
    if (imageFiles.length === 0) {
      toast.error("Agrega al menos una imagen para compilar el PDF");
      return;
    }

    try {
      setIsProcessing(true);
      const pdfBlob = await createPdfFromImages(imageFiles, {
        pageSize,
        orientation,
        margin,
      });

      const url = URL.createObjectURL(pdfBlob);
      const filename = `velyxora_document_${Date.now()}.pdf`;
      setDownloadUrl(url);
      setDownloadFilename(filename);

      // Save to local history
      historyService.addItem({
        toolId: tool.id,
        toolName: tool.name,
        category: "pdf",
        inputName: `${imageFiles.length} imágenes`,
        inputSize: imageFiles.reduce((acc, f) => acc + f.size, 0),
        outputName: filename,
        outputSize: pdfBlob.size,
        processingMode: "CLIENT_SIDE",
        status: "COMPLETED",
      });

      toast.success("¡PDF compilado exitosamente!");
    } catch (err: any) {
      toast.error(err?.message || "Error al compilar el PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  // Compile Text to PDF
  const handleCompileTextToPdf = async () => {
    if (!docContent.trim()) {
      toast.error("El contenido del documento no puede estar vacío");
      return;
    }

    try {
      setIsProcessing(true);
      const pdfBlob = await createPdfFromText(docTitle, docContent);
      const url = URL.createObjectURL(pdfBlob);
      const filename = `${docTitle.toLowerCase().replace(/[^a-z0-9]/gi, "_") || "documento"}.pdf`;
      setDownloadUrl(url);
      setDownloadFilename(filename);

      historyService.addItem({
        toolId: tool.id,
        toolName: tool.name,
        category: "pdf",
        inputName: "texto.txt",
        inputSize: new Blob([docContent]).size,
        outputName: filename,
        outputSize: pdfBlob.size,
        processingMode: "CLIENT_SIDE",
        status: "COMPLETED",
      });

      toast.success("¡Documento PDF generado exitosamente!");
    } catch (err: any) {
      toast.error(err?.message || "Error al generar PDF desde texto");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {tool.id === "images-to-pdf" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Workspace (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Imágenes para el Documento
                  </h3>
                  <p className="text-xs text-slate-400">
                    Arrastra o selecciona las fotos. Cada imagen será colocada
                    en una página del PDF.
                  </p>
                </div>
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-md shadow-indigo-600/20">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Añadir Fotos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAddFiles}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Files List & Order */}
              {imageFiles.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-white/10 rounded-xl text-center space-y-3">
                  <FileSpreadsheet className="w-10 h-10 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No has agregado imágenes aún. Haz clic en{" "}
                    <strong>Añadir Fotos</strong> para comenzar.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {imageFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="p-3 rounded-xl bg-[#08090D] border border-white/[0.06] flex items-center justify-between gap-3 group hover:border-indigo-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-medium text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMove(idx, "up")}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-20 text-slate-300"
                          title="Mover arriba"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(idx, "down")}
                          disabled={idx === imageFiles.length - 1}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-20 text-slate-300"
                          title="Mover abajo"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Configuration Panel (Right Column) */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Parámetros del Documento
              </h4>

              {/* Page Size */}
              <div>
                <label className="text-xs text-slate-300 block mb-1.5">
                  Tamaño de Hoja
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["A4", "Letter", "Fit"] as const).map((ps) => (
                    <button
                      key={ps}
                      onClick={() => setPageSize(ps)}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors ${
                        pageSize === ps
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-[#08090D] text-slate-300 border-white/[0.06] hover:border-white/20"
                      }`}
                    >
                      {ps === "Fit" ? "Ajustar a foto" : ps}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation */}
              {pageSize !== "Fit" && (
                <div>
                  <label className="text-xs text-slate-300 block mb-1.5">
                    Orientación
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["portrait", "landscape"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => setOrientation(o)}
                        className={`py-2 px-2 rounded-xl text-xs font-medium border capitalize transition-colors ${
                          orientation === o
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-[#08090D] text-slate-300 border-white/[0.06] hover:border-white/20"
                        }`}
                      >
                        {o === "portrait" ? "Vertical" : "Horizontal"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Margins */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Margen de página:</span>
                  <span className="font-mono text-indigo-400">{margin} pt</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Compile Button */}
              <button
                onClick={handleCompileImagesToPdf}
                disabled={imageFiles.length === 0 || isProcessing}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isProcessing ? "Compilando PDF..." : "Compilar PDF"}
                </span>
              </button>

              {/* Download link when ready */}
              {downloadUrl && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Documento compilado con éxito!</span>
                  </div>
                  <a
                    href={downloadUrl}
                    download={downloadFilename}
                    className="block w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    Descargar {downloadFilename}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Text to PDF Interface */
        <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
          <div>
            <label className="text-xs text-slate-300 block mb-1.5">
              Título del Documento
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Ej: Reporte Ejecutivo 2025"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1.5">
              Cuerpo del Documento
            </label>
            <textarea
              rows={12}
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Escribe el texto aquí..."
              className="w-full p-3.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Cálculo automático de páginas según longitud del texto.
            </span>
            <button
              onClick={handleCompileTextToPdf}
              disabled={isProcessing || !docContent.trim()}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>{isProcessing ? "Generando..." : "Generar PDF"}</span>
            </button>
          </div>

          {downloadUrl && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Documento PDF generado y listo para descargar</span>
              </div>
              <a
                href={downloadUrl}
                download={downloadFilename}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
