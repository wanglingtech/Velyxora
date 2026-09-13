import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Settings,
  Sparkles,
  Download,
  AlertTriangle,
  Play,
  Scissors,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Layers,
} from "lucide-react";
import { ToolDefinition, ProcessingJob } from "../../types";
import { jobService } from "../../services/jobService";
import { historyService } from "../../services/historyService";
import {
  convertImage,
  cropImage,
  extractVideoFrame,
  trimAndExportWav,
  generateFaviconPackage,
  generateBatchZip,
  generateQrCode,
} from "../../services/conversionEngine";
import { JobProgressView } from "../common/JobProgressView";
import { CapabilityBadge } from "../common/Badge";
import { toast } from "../common/ToastContainer";
import { apiClient } from "../../services/apiClient";
import { uploadAndStartConversion } from "../../services/backendConversionService";
import {
  formatFileSize,
  formatDuration,
} from "../../services/detectionService";
import { PdfToolRunner } from "./subtools/PdfToolRunner";
import { BarcodeToolRunner } from "./subtools/BarcodeToolRunner";
import { ImageAdvancedTools } from "./subtools/ImageAdvancedTools";
import { DataAndCodeTools } from "./subtools/DataAndCodeTools";
import { UtilitiesToolRunner } from "./subtools/UtilitiesToolRunner";

interface ToolRunnerProps {
  tool: ToolDefinition;
  initialFile?: File;
  onBack: () => void;
}

export const ToolRunner: React.FC<ToolRunnerProps> = ({
  tool,
  initialFile,
  onBack,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(
    initialFile || null,
  );
  const [activeJob, setActiveJob] = useState<ProcessingJob | null>(null);
  const backendJobIdRef = useRef<string | null>(null);
  const pollingCancelledRef = useRef(false);

  // Common Options
  const [quality, setQuality] = useState<number>(90);
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [originalAspect, setOriginalAspect] = useState<number>(1);

  // Video Frame Extractor Options
  const [videoTimestamp, setVideoTimestamp] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>("");

  // Audio Trimmer Options
  const [audioStart, setAudioStart] = useState<number>(0);
  const [audioEnd, setAudioEnd] = useState<number>(10);
  const [audioDuration, setAudioDuration] = useState<number>(10);
  const [forceMono, setForceMono] = useState<boolean>(false);
  const [serverBitrate, setServerBitrate] = useState("192k");
  const [serverTrimStart, setServerTrimStart] = useState(0);
  const [serverTrimEnd, setServerTrimEnd] = useState(3);
  const [serverSpeed, setServerSpeed] = useState(1.5);
  const [gifWidth, setGifWidth] = useState(320);
  const [gifFps, setGifFps] = useState(15);
  const [videoResolution, setVideoResolution] = useState("1280x720");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>("");

  // Developer & Text Tools states
  const [textInput, setTextInput] = useState<string>("");
  const [textOutput, setTextOutput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // QR Code States
  const [qrType, setQrType] = useState<"url" | "text" | "wifi" | "email">(
    "url",
  );
  const [qrValue, setQrValue] = useState<string>("https://velyxora.app");
  const [wifiSsid, setWifiSsid] = useState<string>("");
  const [wifiPass, setWifiPass] = useState<string>("");
  const [qrColor, setQrColor] = useState<string>("#6366F1");
  const [qrBgColor, setQrBgColor] = useState<string>("#FFFFFF");
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>("");

  // Password Generator
  const [passLength, setPassLength] = useState<number>(16);
  const [useUpper, setUseUpper] = useState<boolean>(true);
  const [useNumbers, setUseNumbers] = useState<boolean>(true);
  const [useSymbols, setUseSymbols] = useState<boolean>(true);
  const [generatedPass, setGeneratedPass] = useState<string>("");

  // Batch Files
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);

  // Subscribe to job events
  useEffect(() => {
    const unsub = jobService.subscribe((updated) => {
      if (activeJob && updated.id === activeJob.id) {
        setActiveJob(updated);
      }
    });
    return unsub;
  }, [activeJob]);

  // Load preview and natural dimensions for file
  useEffect(() => {
    if (!selectedFile) return;

    if (selectedFile.type.startsWith("video/")) {
      const url = URL.createObjectURL(selectedFile);
      setVideoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    if (selectedFile.type.startsWith("audio/")) {
      const url = URL.createObjectURL(selectedFile);
      setAudioPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    if (selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      const img = new Image();
      img.onload = () => {
        setTargetWidth(img.naturalWidth);
        setTargetHeight(img.naturalHeight);
        setOriginalAspect(img.naturalWidth / img.naturalHeight);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }, [selectedFile]);

  // Generate QR on parameter changes
  useEffect(() => {
    if (tool.id === "qr-generator") {
      let payload = qrValue;
      if (qrType === "wifi") {
        payload = `WIFI:T:WPA;S:${wifiSsid};P:${wifiPass};;`;
      } else if (qrType === "email") {
        payload = `mailto:${qrValue}`;
      }

      if (payload.trim()) {
        generateQrCode(payload, { color: qrColor, bgColor: qrBgColor })
          .then((res) => setQrPreviewUrl(res.dataUrl))
          .catch(() => {});
      }
    }
  }, [qrValue, qrType, wifiSsid, wifiPass, qrColor, qrBgColor, tool.id]);

  // Generate initial password
  useEffect(() => {
    if (tool.id === "password-generator") {
      generateSecurePassword();
    }
  }, [tool.id]);

  const generateSecurePassword = () => {
    let charset = "abcdefghijklmnopqrstuvwxyz";
    if (useUpper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (useNumbers) charset += "0123456789";
    if (useSymbols) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

    const array = new Uint32Array(passLength);
    window.crypto.getRandomValues(array);
    let pass = "";
    for (let i = 0; i < passLength; i++) {
      pass += charset[array[i] % charset.length];
    }
    setGeneratedPass(pass);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  // Dimension scaling handlers
  const handleWidthChange = (w: number) => {
    setTargetWidth(w);
    if (maintainAspect && originalAspect > 0) {
      setTargetHeight(Math.round(w / originalAspect));
    }
  };

  const handleHeightChange = (h: number) => {
    setTargetHeight(h);
    if (maintainAspect && originalAspect > 0) {
      setTargetWidth(Math.round(h * originalAspect));
    }
  };

  // Social presets
  const applySocialPreset = (w: number, h: number) => {
    setTargetWidth(w);
    setTargetHeight(h);
    setMaintainAspect(false);
  };

  // ==================== REAL PROCESSING EXECUTION ====================
  const handleExecute = async () => {
    if (tool.id === "video-trimmer" && (serverTrimStart < 0 || serverTrimEnd <= serverTrimStart || (videoDuration > 0 && serverTrimEnd > videoDuration))) {
      toast.error("Intervalo inválido", "El final debe ser posterior al inicio y no superar la duración del video.");
      return;
    }
    const job = jobService.createJob(
      tool.id,
      tool.name,
      selectedFile
        ? {
            name: selectedFile.name,
            size: selectedFile.size,
            mimeType: selectedFile.type,
          }
        : undefined,
    );
    setActiveJob(job);

    try {
      if ((tool.requiresServer || tool.id === "video-to-mp3") && selectedFile) {
        const health = await apiClient.checkHealth(true);
        if (!health) throw new Error("Backend no disponible");
        if (tool.engine === "server-ffmpeg" && !health.services.ffmpeg) {
          throw new Error("FFMPEG_NOT_AVAILABLE: FFmpeg no está disponible en el backend.");
        }
        jobService.updateStatus(job.id, "UPLOADING", "Subiendo archivo al backend...", 0);
        const mime = tool.id === "video-to-mp3"
          ? "audio/mpeg"
          : tool.id === "audio-format-converter" && selectedFile.type === "audio/mpeg"
            ? "audio/wav"
            : String(tool.outputTypes[0] || "");
        const targetFormat = mime.split("/").pop()!.replace("mpeg", "mp3").replace("jpeg", "jpg");
        const options: Record<string, unknown> = { quality };
        if (["video-to-mp3", "wav-to-mp3", "audio-bitrate", "audio-normalize"].includes(tool.id)) options.bitrate = serverBitrate;
        if (tool.id === "video-trimmer") { options.trimStart = serverTrimStart; options.trimEnd = serverTrimEnd; }
        if (tool.id === "video-mute") options.muteAudio = true;
        if (tool.id === "video-speed") options.speedMultiplier = serverSpeed;
        if (tool.id === "video-to-gif") { options.gifWidth = gifWidth; options.fps = gifFps; }
        if (tool.id === "audio-normalize") options.normalizeAudio = true;
        if (tool.id === "video-resize") options.resolution = videoResolution;
        const remote = await uploadAndStartConversion(
          selectedFile,
          { toolId: tool.id, targetFormat, options },
          (progress) => jobService.updateStatus(job.id, "UPLOADING", "Subiendo archivo al backend...", progress),
        );
        backendJobIdRef.current = remote.id;
        pollingCancelledRef.current = false;
        for (let attempt = 0; attempt < 300 && !pollingCancelledRef.current; attempt += 1) {
          const state = await apiClient.getJobStatus(remote.id);
          jobService.updateStatus(job.id, state.status, state.progressMessage || "Procesando en backend...", state.progress);
          if (state.status === "COMPLETED" && state.output) {
            jobService.completeJob(job.id, { ...state.output });
            return;
          }
          if (state.status === "FAILED" || state.status === "CANCELLED") throw new Error(state.error || `Trabajo ${state.status}.`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        if (pollingCancelledRef.current) return;
        throw new Error("PROCESSING_FAILED: se agotó el tiempo de espera del trabajo.");
      }

      jobService.updateStatus(
        job.id,
        "PROCESSING",
        "Procesando archivo con motor local...",
        -1,
      );

      // --- Image Conversions ---
      if (tool.id === "png-to-jpg" && selectedFile) {
        const res = await convertImage(selectedFile, {
          format: "image/jpeg",
          quality: quality / 100,
        });
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: res.filename,
          mimeType: "image/jpeg",
          size: res.blob.size,
        });
        historyService.addItem({
          toolId: tool.id,
          toolName: tool.name,
          category: tool.category,
          inputName: selectedFile.name,
          inputSize: selectedFile.size,
          outputName: res.filename,
          outputSize: res.blob.size,
          processingMode: "CLIENT_SIDE",
          status: "COMPLETED",
        });
        return;
      }

      if (tool.id === "jpg-to-png" && selectedFile) {
        const res = await convertImage(selectedFile, {
          format: "image/png",
        });
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: res.filename,
          mimeType: "image/png",
          size: res.blob.size,
        });
        historyService.addItem({
          toolId: tool.id,
          toolName: tool.name,
          category: tool.category,
          inputName: selectedFile.name,
          inputSize: selectedFile.size,
          outputName: res.filename,
          outputSize: res.blob.size,
          processingMode: "CLIENT_SIDE",
          status: "COMPLETED",
        });
        return;
      }

      if (
        (tool.id === "png-to-webp" ||
          tool.id === "jpg-to-webp" ||
          tool.id === "image-compressor") &&
        selectedFile
      ) {
        const res = await convertImage(selectedFile, {
          format: "image/webp",
          quality: quality / 100,
          width: targetWidth > 0 ? targetWidth : undefined,
          height: targetHeight > 0 ? targetHeight : undefined,
        });
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: res.filename,
          mimeType: "image/webp",
          size: res.blob.size,
        });
        historyService.addItem({
          toolId: tool.id,
          toolName: tool.name,
          category: tool.category,
          inputName: selectedFile.name,
          inputSize: selectedFile.size,
          outputName: res.filename,
          outputSize: res.blob.size,
          processingMode: "CLIENT_SIDE",
          status: "COMPLETED",
        });
        return;
      }

      if (tool.id === "image-resizer" && selectedFile) {
        const res = await convertImage(selectedFile, {
          format: (selectedFile.type as any) || "image/png",
          width: targetWidth,
          height: targetHeight,
          quality: 0.95,
        });
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: `resized_${selectedFile.name}`,
          mimeType: selectedFile.type,
          size: res.blob.size,
        });
        return;
      }

      if (tool.id === "favicon-generator" && selectedFile) {
        jobService.updateStatus(
          job.id,
          "PROCESSING",
          "Compilando paquete ZIP con favicons de 16, 32, 48 y 180px...",
          -1,
        );
        const res = await generateFaviconPackage(selectedFile);
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: res.filename,
          mimeType: "application/zip",
          size: res.blob.size,
        });
        return;
      }

      // --- Video Frame Extractor ---
      if (tool.id === "video-frame-extractor" && selectedFile) {
        jobService.updateStatus(
          job.id,
          "PROCESSING",
          `Buscando fotograma a los ${videoTimestamp}s...`,
          -1,
        );
        const res = await extractVideoFrame(
          selectedFile,
          videoTimestamp,
          "image/png",
        );
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: res.filename,
          mimeType: "image/png",
          size: res.blob.size,
        });
        return;
      }

      // --- Audio Trimmer ---
      if (tool.id === "audio-trimmer" && selectedFile) {
        jobService.updateStatus(
          job.id,
          "PROCESSING",
          "Decodificando muestras de audio y reempaquetando WAV PCM...",
          -1,
        );
        const res = await trimAndExportWav(
          selectedFile,
          audioStart,
          audioEnd,
          forceMono,
        );
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: res.filename,
          mimeType: "audio/wav",
          size: res.blob.size,
        });
        return;
      }

      // --- QR Code Download ---
      if (tool.id === "qr-generator") {
        let payload = qrValue;
        if (qrType === "wifi")
          payload = `WIFI:T:WPA;S:${wifiSsid};P:${wifiPass};;`;
        else if (qrType === "email") payload = `mailto:${qrValue}`;

        const res = await generateQrCode(payload, {
          color: qrColor,
          bgColor: qrBgColor,
        });
        jobService.completeJob(job.id, {
          blob: res.blob,
          filename: "velyxora_qr.png",
          mimeType: "image/png",
          size: res.blob.size,
        });
        return;
      }

      // --- Batch Processing with real ZIP ---
      if (isBatchMode && batchFiles.length > 0) {
        jobService.updateStatus(
          job.id,
          "PROCESSING",
          `Procesando lote de ${batchFiles.length} imágenes...`,
          10,
        );
        const processedResults: Array<{ blob: Blob; filename: string }> = [];

        for (let i = 0; i < batchFiles.length; i++) {
          const file = batchFiles[i];
          const conv = await convertImage(file, {
            format: "image/webp",
            quality: quality / 100,
          });
          processedResults.push({ blob: conv.blob, filename: conv.filename });
          jobService.updateStatus(
            job.id,
            "PROCESSING",
            `Procesando ${i + 1} de ${batchFiles.length}...`,
            Math.round(((i + 1) / batchFiles.length) * 100),
          );
        }

        const zipBlob = await generateBatchZip(processedResults);
        jobService.completeJob(job.id, {
          blob: zipBlob,
          filename: `velyxora_batch_${Date.now()}.zip`,
          mimeType: "application/zip",
          size: zipBlob.size,
        });
        return;
      }

      // Fallback
      jobService.failJob(job.id, {
        code: "UNHANDLED_ENGINE",
        message:
          "No se pudo iniciar el motor para esta combinación de entrada.",
      });
    } catch (err: any) {
      console.error(err);
      jobService.failJob(job.id, {
        code: "EXECUTION_ERROR",
        message:
          err?.message || "Fallo durante el procesamiento en el navegador.",
      });
    }
  };

  // ==================== DEVELOPER TOOLS LOGIC ====================
  const handleFormatJson = (minify: boolean = false) => {
    try {
      const parsed = JSON.parse(textInput);
      const res = minify
        ? JSON.stringify(parsed)
        : JSON.stringify(parsed, null, 2);
      setTextOutput(res);
      toast.success(
        minify ? "JSON minificado con éxito" : "JSON formateado y válido",
      );
    } catch (err: any) {
      toast.error("Error de sintaxis JSON", err.message);
    }
  };

  const handleDecodeJwt = () => {
    try {
      const parts = textInput.trim().split(".");
      if (parts.length < 2)
        throw new Error(
          "Un JWT válido debe tener cabecera, payload y firma separados por puntos.",
        );

      const decodePart = (str: string) => {
        const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        );
        return JSON.parse(jsonPayload);
      };

      const header = decodePart(parts[0]);
      const payload = decodePart(parts[1]);

      let expirationNotice = "";
      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const isExpired = Date.now() > payload.exp * 1000;
        expirationNotice = isExpired
          ? `[EXPIRADO el ${expDate.toLocaleString()}]`
          : `[Válido hasta ${expDate.toLocaleString()}]`;
      }

      const result = {
        _status: expirationNotice || "Sin campo exp",
        header,
        payload,
      };

      setTextOutput(JSON.stringify(result, null, 2));
      toast.success("JWT decodificado de forma segura y local");
    } catch (err: any) {
      toast.error("Error al decodificar JWT", err.message);
    }
  };

  const handleGenerateHash = async (algo: "SHA-256" | "SHA-512" | "SHA-1") => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(textInput);
      const hashBuffer = await window.crypto.subtle.digest(algo, data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setTextOutput(hashHex);
      toast.success(`Hash ${algo} generado`);
    } catch (err: any) {
      toast.error("Error criptográfico", err.message);
    }
  };

  const handleGenerateUuids = (count: number = 5) => {
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.push(crypto.randomUUID());
    }
    setTextOutput(list.join("\n"));
    toast.success(`${count} UUIDs generados`);
  };

  const handleConvertTextCase = (mode: string) => {
    let res = textInput;
    if (mode === "upper") res = textInput.toUpperCase();
    if (mode === "lower") res = textInput.toLowerCase();
    if (mode === "title") {
      res = textInput.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
      );
    }
    if (mode === "camel") {
      res = textInput
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase(),
        )
        .replace(/\s+/g, "");
    }
    if (mode === "snake") {
      res = textInput.toLowerCase().trim().replace(/\s+/g, "_");
    }
    if (mode === "kebab") {
      res = textInput.toLowerCase().trim().replace(/\s+/g, "-");
    }
    setTextOutput(res);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-[#101218] border border-white/[0.08] hover:bg-[#161922] text-slate-300 hover:text-white transition-colors"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {tool.name}
              </h2>
              <CapabilityBadge mode={tool.processingMode} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{tool.description}</p>
          </div>
        </div>

        {tool.processingMode === "CLIENT_SIDE" && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>100% Privado en tu navegador</span>
          </div>
        )}
      </div>

      {/* Backend Required Warning if applicable */}
      {tool.requiresServer && !tool.isClientReady && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-200">
              Microservicio Backend Requerido
            </p>
            <p className="text-amber-300/90 mt-0.5 leading-relaxed">
              {tool.serverEngineNotice ||
                "Esta herramienta requiere un contenedor con FFmpeg o LibreOffice compilado."}
            </p>
            <p className="text-[11px] text-amber-400/80 mt-1 font-mono">
              Endpoint asignado: POST /api/conversions (preparado en VS Code)
            </p>
          </div>
        </div>
      )}

      {/* Active Job State */}
      {activeJob && (
        <JobProgressView
          job={activeJob}
          onCancel={() => {
            pollingCancelledRef.current = true;
            if (backendJobIdRef.current) void apiClient.cancelJob(backendJobIdRef.current);
            if (activeJob) jobService.cancelJob(activeJob.id);
          }}
          onReset={() => setActiveJob(null)}
        />
      )}

      {/* Main Tool Workspace */}
      {!activeJob && (
        <div className="space-y-6">
          {/* ==================== PDF TOOLS (Client-Side & Server) ==================== */}
          {(tool.category === "pdf" || tool.id === "text-to-pdf") && (
            <PdfToolRunner
              tool={tool}
              initialFile={selectedFile || undefined}
            />
          )}

          {/* ==================== BARCODE GENERATOR ==================== */}
          {tool.id === "barcode-generator" && <BarcodeToolRunner tool={tool} />}

          {/* ==================== ADVANCED IMAGE TOOLS ==================== */}
          {(tool.id === "svg-to-png" ||
            tool.id === "svg-to-jpg" ||
            tool.id === "image-filters" ||
            tool.id === "image-watermark" ||
            tool.id === "color-picker-image" ||
            tool.id === "image-to-base64") && (
            <ImageAdvancedTools
              tool={tool}
              selectedFile={selectedFile}
              onFileSelect={(file) => setSelectedFile(file)}
            />
          )}

          {/* ==================== DATA & CODE TOOLS ==================== */}
          {(tool.id === "csv-to-json" ||
            tool.id === "json-to-csv" ||
            tool.id === "markdown-to-html" ||
            tool.id === "color-converter" ||
            tool.id === "diff-checker") && <DataAndCodeTools tool={tool} />}

          {/* ==================== UTILITIES TOOLS ==================== */}
          {(tool.category === "utilities" ||
            tool.id === "video-metadata-inspector") &&
            tool.id !== "barcode-generator" &&
            tool.id !== "color-converter" && (
              <UtilitiesToolRunner
                tool={tool}
                selectedFile={selectedFile}
                onFileSelect={(file) => setSelectedFile(file)}
              />
            )}

          {/* ==================== STANDARD FILE INPUT TOOLS ==================== */}
          {(tool.category === "audio" ||
            (tool.category === "video" &&
              tool.id !== "video-metadata-inspector") ||
            (tool.category === "image" &&
              ![
                "svg-to-png",
                "svg-to-jpg",
                "image-filters",
                "image-watermark",
                "color-picker-image",
                "image-to-base64",
              ].includes(tool.id))) &&
          tool.id !== "text-to-pdf" ? (
            <div className="space-y-5">
              {/* File Selection Card */}
              {!selectedFile ? (
                <div className="p-8 rounded-2xl bg-[#101218] border border-dashed border-white/[0.12] text-center flex flex-col items-center">
                  <input
                    type="file"
                    id="tool-file-input"
                    className="hidden"
                    accept={tool.inputTypes.join(",")}
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        setSelectedFile(e.target.files[0]);
                    }}
                  />
                  <label
                    htmlFor="tool-file-input"
                    className="cursor-pointer px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    Seleccionar archivo ({tool.inputTypes.join(", ")})
                  </label>
                  <p className="text-xs text-slate-500 mt-2">
                    o arrastra el archivo aquí
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-mono text-xs uppercase font-bold">
                      {selectedFile.name.split(".").pop()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-slate-400 hover:text-rose-400 transition-colors p-1"
                  >
                    Cambiar archivo
                  </button>
                </div>
              )}

              {/* SPECIFIC CONTROLS */}
              {/* Image Compression & Quality Controls */}
              {(tool.id === "png-to-jpg" ||
                tool.id === "png-to-webp" ||
                tool.id === "jpg-to-webp" ||
                tool.id === "image-compressor") &&
                selectedFile && (
                  <div className="p-5 rounded-xl bg-[#101218] border border-white/[0.08] space-y-4">
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Settings className="w-3.5 h-3.5" /> Ajustes de compresión
                    </h3>

                    <div>
                      <div className="flex justify-between text-xs font-mono text-slate-300 mb-1.5">
                        <span>Calidad de compresión</span>
                        <span className="text-indigo-400 font-bold">
                          {quality}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}

              {/* Image Resizer Controls */}
              {tool.id === "image-resizer" && selectedFile && (
                <div className="p-5 rounded-xl bg-[#101218] border border-white/[0.08] space-y-4">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" /> Dimensiones de salida
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Ancho (px)
                      </label>
                      <input
                        type="number"
                        value={targetWidth}
                        onChange={(e) =>
                          handleWidthChange(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#08090D] border border-white/[0.08] text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Alto (px)
                      </label>
                      <input
                        type="number"
                        value={targetHeight}
                        onChange={(e) =>
                          handleHeightChange(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#08090D] border border-white/[0.08] text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintainAspect}
                      onChange={(e) => setMaintainAspect(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <span>
                      Mantener relación de aspecto ({originalAspect.toFixed(2)}
                      :1)
                    </span>
                  </label>

                  {/* Social Presets */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-2 font-mono uppercase">
                      Presets de Redes Sociales:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => applySocialPreset(1080, 1080)}
                        className="px-2.5 py-1 rounded-md bg-[#161922] hover:bg-slate-800 text-[11px] text-slate-300 border border-white/[0.05]"
                      >
                        Instagram Post (1080×1080)
                      </button>
                      <button
                        onClick={() => applySocialPreset(1080, 1920)}
                        className="px-2.5 py-1 rounded-md bg-[#161922] hover:bg-slate-800 text-[11px] text-slate-300 border border-white/[0.05]"
                      >
                        Instagram Story/Reel (1080×1920)
                      </button>
                      <button
                        onClick={() => applySocialPreset(1280, 720)}
                        className="px-2.5 py-1 rounded-md bg-[#161922] hover:bg-slate-800 text-[11px] text-slate-300 border border-white/[0.05]"
                      >
                        YouTube Thumbnail (1280×720)
                      </button>
                      <button
                        onClick={() => applySocialPreset(1200, 675)}
                        className="px-2.5 py-1 rounded-md bg-[#161922] hover:bg-slate-800 text-[11px] text-slate-300 border border-white/[0.05]"
                      >
                        X / Twitter Post (1200×675)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Frame Extractor Controls */}
              {tool.id === "video-frame-extractor" && selectedFile && (
                <div className="p-5 rounded-xl bg-[#101218] border border-white/[0.08] space-y-4">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Play className="w-3.5 h-3.5" /> Selector de Fotograma
                  </h3>

                  {videoPreviewUrl && (
                    <div className="rounded-xl overflow-hidden bg-black max-h-64 flex justify-center">
                      <video
                        ref={videoRef}
                        src={videoPreviewUrl}
                        controls
                        className="max-h-64 object-contain"
                        onLoadedMetadata={(e) => {
                          const target = e.currentTarget;
                          setVideoDuration(target.duration);
                        }}
                        onTimeUpdate={(e) => {
                          setVideoTimestamp(e.currentTarget.currentTime);
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                      <span>Momento seleccionado:</span>
                      <span className="text-indigo-400 font-bold">
                        {formatDuration(videoTimestamp)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={videoDuration || 100}
                      step={0.1}
                      value={videoTimestamp}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVideoTimestamp(val);
                        if (videoRef.current)
                          videoRef.current.currentTime = val;
                      }}
                      className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Audio Trimmer Controls */}
              {tool.id === "audio-trimmer" && selectedFile && (
                <div className="p-5 rounded-xl bg-[#101218] border border-white/[0.08] space-y-4">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Scissors className="w-3.5 h-3.5" /> Recorte de Audio
                  </h3>

                  {audioPreviewUrl && (
                    <audio
                      ref={audioRef}
                      src={audioPreviewUrl}
                      controls
                      className="w-full"
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        setAudioDuration(d);
                        setAudioEnd(Math.min(30, d));
                      }}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Punto de inicio (segundos)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={audioEnd}
                        step={0.1}
                        value={audioStart}
                        onChange={(e) => setAudioStart(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-[#08090D] border border-white/[0.08] text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Punto final (segundos)
                      </label>
                      <input
                        type="number"
                        min={audioStart}
                        max={audioDuration}
                        step={0.1}
                        value={audioEnd}
                        onChange={(e) => setAudioEnd(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-[#08090D] border border-white/[0.08] text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceMono}
                      onChange={(e) => setForceMono(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <span>Convertir a pista monofónica balanceada</span>
                  </label>
                </div>
              )}

              {tool.engine === "server-ffmpeg" && selectedFile && (
                <div className="p-5 rounded-xl bg-[#101218] border border-white/[0.08] space-y-4">
                  {selectedFile.type.startsWith("video/") && videoPreviewUrl && (
                    <video src={videoPreviewUrl} controls className="w-full max-h-56 rounded-lg bg-black" onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)} />
                  )}
                  {videoDuration > 0 && <p className="text-xs text-slate-400">Duración original: <span className="font-mono text-slate-200">{formatDuration(videoDuration)}</span></p>}

                  {["video-to-mp3", "wav-to-mp3", "audio-bitrate", "audio-normalize"].includes(tool.id) && (
                    <label className="block text-xs text-slate-300">Bitrate de salida
                      <select value={serverBitrate} onChange={(e) => setServerBitrate(e.target.value)} className="mt-1 w-full p-2 rounded-lg bg-[#08090D] border border-white/[0.08]">
                        {[96,128,192,256,320].map((rate) => <option key={rate} value={`${rate}k`}>{rate} kbps</option>)}
                      </select>
                    </label>
                  )}

                  {tool.id === "video-trimmer" && <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-slate-300">Inicio (segundos)<input type="number" min={0} step={0.1} value={serverTrimStart} onChange={(e) => setServerTrimStart(Number(e.target.value))} className="mt-1 w-full p-2 rounded-lg bg-[#08090D] border border-white/[0.08]" /></label>
                    <label className="text-xs text-slate-300">Fin (segundos)<input type="number" min={0.1} step={0.1} value={serverTrimEnd} onChange={(e) => setServerTrimEnd(Number(e.target.value))} className="mt-1 w-full p-2 rounded-lg bg-[#08090D] border border-white/[0.08]" /></label>
                  </div>}

                  {tool.id === "video-speed" && <label className="block text-xs text-slate-300">Velocidad
                    <select value={serverSpeed} onChange={(e) => setServerSpeed(Number(e.target.value))} className="mt-1 w-full p-2 rounded-lg bg-[#08090D] border border-white/[0.08]">
                      {[0.5,0.75,1.25,1.5,2].map((speed) => <option key={speed} value={speed}>{speed}× — {speed < 1 ? "más lento" : "más rápido"}</option>)}
                    </select>
                  </label>}

                  {tool.id === "video-to-gif" && <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-slate-300">Ancho<select value={gifWidth} onChange={(e) => setGifWidth(Number(e.target.value))} className="mt-1 w-full p-2 rounded-lg bg-[#08090D] border border-white/[0.08]">{[240,320,480,640].map((width) => <option key={width} value={width}>{width} px</option>)}</select></label>
                    <label className="text-xs text-slate-300">Fotogramas/segundo<select value={gifFps} onChange={(e) => setGifFps(Number(e.target.value))} className="mt-1 w-full p-2 rounded-lg bg-[#08090D] border border-white/[0.08]">{[10,15,20,24].map((fps) => <option key={fps} value={fps}>{fps} FPS</option>)}</select></label>
                  </div>}

                  {tool.id === "video-compressor" && <div><p className="text-xs text-slate-300 mb-2">Nivel de compresión</p><div className="grid grid-cols-3 gap-2">{[[90,"Alta calidad"],[70,"Equilibrada"],[35,"Compresión alta"]].map(([value,label]) => <button type="button" key={value} onClick={() => setQuality(Number(value))} className={`p-2 rounded-lg text-xs border ${quality === value ? "bg-indigo-600 border-indigo-500 text-white" : "bg-[#08090D] border-white/[0.08] text-slate-300"}`}>{label}</button>)}</div><p className="mt-2 text-[11px] text-slate-500">El tamaño final depende del contenido y del archivo original.</p></div>}
                  {tool.id === "video-resize" && <label className="block text-xs text-slate-300">Resolución de salida<select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value)} className="mt-1 w-full p-2 rounded-lg bg-[#08090D] border border-white/[0.08]"><option value="854x480">480p</option><option value="1280x720">720p</option><option value="1920x1080">1080p</option></select></label>}

                  {tool.id === "video-mute" && <p className="text-xs text-amber-200">El video conservará la imagen, pero se eliminará completamente el audio.</p>}
                  {tool.id === "audio-bitrate" && <p className="text-[11px] text-slate-500">Un bitrate más alto suele conservar más calidad, pero genera archivos mayores. No recupera calidad ya perdida.</p>}
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExecute}
                  disabled={!selectedFile}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Procesar {tool.name}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* ==================== QR CODE GENERATOR ==================== */}
          {tool.id === "qr-generator" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
                <div className="flex gap-2 p-1 bg-[#08090D] rounded-xl border border-white/[0.06]">
                  {(["url", "text", "wifi", "email"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setQrType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                        qrType === t
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {qrType === "wifi" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Nombre de Red WiFi (SSID)
                      </label>
                      <input
                        type="text"
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        placeholder="MiWiFi_5G"
                        className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Contraseña WPA/WPA2
                      </label>
                      <input
                        type="password"
                        value={wifiPass}
                        onChange={(e) => setWifiPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {qrType === "url"
                        ? "URL de destino"
                        : qrType === "email"
                          ? "Correo electrónico"
                          : "Texto a codificar"}
                    </label>
                    <textarea
                      rows={3}
                      value={qrValue}
                      onChange={(e) => setQrValue(e.target.value)}
                      placeholder="Escribe el contenido..."
                      className="w-full p-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none resize-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Color del QR
                    </label>
                    <input
                      type="color"
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value)}
                      className="w-full h-9 rounded-lg bg-transparent cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Fondo
                    </label>
                    <input
                      type="color"
                      value={qrBgColor}
                      onChange={(e) => setQrBgColor(e.target.value)}
                      className="w-full h-9 rounded-lg bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* QR Preview & Download */}
              <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] flex flex-col items-center justify-center text-center">
                {qrPreviewUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img
                      src={qrPreviewUrl}
                      alt="QR Code Preview"
                      className="w-48 h-48"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-2xl bg-[#161922] flex items-center justify-center text-slate-600">
                    Generando QR...
                  </div>
                )}

                <button
                  onClick={handleExecute}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar PNG en Alta Resolución</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== DEVELOPER TEXT / JSON / JWT / HASH TOOLS ==================== */}
          {(tool.category === "developer" ||
            tool.category === "text" ||
            tool.id === "password-generator") &&
            tool.id !== "qr-generator" &&
            tool.id !== "diff-checker" &&
            tool.id !== "markdown-to-html" &&
            tool.id !== "text-to-pdf" &&
            tool.category !== "pdf" && (
              <div className="space-y-4">
                {/* Password Generator specific */}
                {tool.id === "password-generator" ? (
                  <div className="p-6 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-5">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[#08090D] border border-white/[0.08]">
                      <span className="text-sm sm:text-base font-mono font-bold text-indigo-400 select-all break-all">
                        {generatedPass}
                      </span>
                      <button
                        onClick={() => copyToClipboard(generatedPass)}
                        className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 ml-3 transition-colors"
                        title="Copiar contraseña"
                      >
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                        <span>Longitud:</span>
                        <span className="text-indigo-400 font-bold">
                          {passLength} caracteres
                        </span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={64}
                        value={passLength}
                        onChange={(e) => {
                          setPassLength(Number(e.target.value));
                          generateSecurePassword();
                        }}
                        className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useUpper}
                          onChange={(e) => setUseUpper(e.target.checked)}
                          className="rounded accent-indigo-500"
                        />
                        <span>Mayúsculas (A-Z)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useNumbers}
                          onChange={(e) => setUseNumbers(e.target.checked)}
                          className="rounded accent-indigo-500"
                        />
                        <span>Números (0-9)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSymbols}
                          onChange={(e) => setUseSymbols(e.target.checked)}
                          className="rounded accent-indigo-500"
                        />
                        <span>Símbolos especiales (!@#$)</span>
                      </label>
                    </div>

                    <button
                      onClick={generateSecurePassword}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerar con nueva entropía</span>
                    </button>
                  </div>
                ) : (
                  /* Text & Code input / output workspace */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Input Editor */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold">Entrada:</span>
                          <span className="font-mono">
                            {textInput.length} caracteres
                          </span>
                        </div>
                        <textarea
                          rows={10}
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="Pega o escribe tu texto o código aquí..."
                          className="w-full p-3.5 rounded-xl bg-[#101218] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50 resize-y"
                        />
                      </div>

                      {/* Output Viewer */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold">Salida:</span>
                          {textOutput && (
                            <button
                              onClick={() => copyToClipboard(textOutput)}
                              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              {copied ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copied ? "Copiado" : "Copiar"}</span>
                            </button>
                          )}
                        </div>
                        <textarea
                          readOnly
                          rows={10}
                          value={textOutput}
                          placeholder="El resultado transformado aparecerá aquí..."
                          className="w-full p-3.5 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none resize-y"
                        />
                      </div>
                    </div>

                    {/* Actions Bar for Dev Tools */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {tool.id === "json-formatter" && (
                        <>
                          <button
                            onClick={() => handleFormatJson(false)}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                          >
                            Formatear JSON
                          </button>
                          <button
                            onClick={() => handleFormatJson(true)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                          >
                            Minificar JSON
                          </button>
                        </>
                      )}

                      {tool.id === "jwt-decoder" && (
                        <button
                          onClick={handleDecodeJwt}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                        >
                          Decodificar Claims JWT
                        </button>
                      )}

                      {tool.id === "hash-generator" && (
                        <>
                          <button
                            onClick={() => handleGenerateHash("SHA-256")}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                          >
                            SHA-256
                          </button>
                          <button
                            onClick={() => handleGenerateHash("SHA-512")}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                          >
                            SHA-512
                          </button>
                          <button
                            onClick={() => handleGenerateHash("SHA-1")}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                          >
                            SHA-1
                          </button>
                        </>
                      )}

                      {tool.id === "uuid-generator" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGenerateUuids(1)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                          >
                            Generar 1 UUID
                          </button>
                          <button
                            onClick={() => handleGenerateUuids(10)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                          >
                            Lote de 10 UUIDs
                          </button>
                        </div>
                      )}

                      {tool.id === "case-converter" && (
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              "upper",
                              "lower",
                              "title",
                              "camel",
                              "snake",
                              "kebab",
                            ] as const
                          ).map((m) => (
                            <button
                              key={m}
                              onClick={() => handleConvertTextCase(m)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 text-xs font-mono uppercase transition-colors"
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}

                      {tool.id === "word-counter" && (
                        <div className="p-4 rounded-xl bg-[#101218] border border-white/[0.08] w-full grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div>
                            <span className="text-[11px] text-slate-400 uppercase">
                              Palabras
                            </span>
                            <p className="text-base font-bold text-white font-mono">
                              {textInput.trim()
                                ? textInput.trim().split(/\s+/).length
                                : 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 uppercase">
                              Caracteres
                            </span>
                            <p className="text-base font-bold text-white font-mono">
                              {textInput.length}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 uppercase">
                              Líneas
                            </span>
                            <p className="text-base font-bold text-white font-mono">
                              {textInput ? textInput.split("\n").length : 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 uppercase">
                              Tiempo Lectura
                            </span>
                            <p className="text-base font-bold text-indigo-400 font-mono">
                              ~
                              {Math.ceil(
                                (textInput.trim().split(/\s+/).length || 1) /
                                  200,
                              )}{" "}
                              min
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
};
