export interface BackendHealth {
  status: "ok" | "degraded" | "error";
  version: string;
  uptimeSeconds: number;
  services: {
    ffmpeg: boolean;
    libreoffice: boolean;
    storage: boolean;
  };
}

export interface UploadResponse {
  fileId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  expiresInMinutes: number;
}

export interface ConversionJobResponse {
  id: string;
  toolId: string;
  status:
    | "IDLE"
    | "QUEUED"
    | "UPLOADING"
    | "ANALYZING"
    | "PROCESSING"
    | "FINALIZING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  progress: number;
  progressMessage?: string;
  output?: {
    filename: string;
    mimeType: string;
    size: number;
    downloadUrl: string;
  };
  error?: string;
}

export interface MediaAnalysisResponse {
  url: string;
  platform: string;
  title: string;
  author: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  embedHtml?: string;
  formats: Array<{
    formatId: string;
    extension: string;
    resolution?: string;
    qualityLabel?: string;
    hasVideo: boolean;
    hasAudio: boolean;
    url?: string;
  }>;
  isDirectDownloadPossible: boolean;
  requiresExternalExtractor: boolean;
  notice?: string;
}

class ApiClient {
  private baseUrl: string;
  private cachedHealth: { data: BackendHealth | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };

  constructor() {
    // In browser, relative path '/api' works with Vite proxy/Express middleware.
    // Falls back to import.meta.env.VITE_API_URL or ''
    const envUrl = (import.meta as any).env?.VITE_API_URL || "";
    this.baseUrl = envUrl ? envUrl.replace(/\/+$/, "") : "";
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = 8000,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: init.signal || controller.signal,
      });
      const text = await response.text();
      let payload: {
        success?: boolean;
        data?: T;
        error?: { message?: string };
      } = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("El backend devolvió una respuesta no válida.");
      }
      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.error?.message || `La solicitud falló (${response.status}).`,
        );
      }
      return payload.data === undefined ? (payload as T) : payload.data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          "Backend no disponible: la solicitud agotó el tiempo de espera.",
        );
      }
      if (error instanceof TypeError) {
        throw new Error(
          "Backend no disponible: no se pudo establecer conexión.",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Safe health check with short timeout to prevent blocking UI
   */
  async checkHealth(force = false): Promise<BackendHealth | null> {
    const now = Date.now();
    if (
      !force &&
      this.cachedHealth.data &&
      now - this.cachedHealth.timestamp < 10000
    ) {
      return this.cachedHealth.data;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.baseUrl}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.cachedHealth = { data: null, timestamp: now };
        return null;
      }

      const data = (await res.json()) as BackendHealth;
      this.cachedHealth = { data, timestamp: now };
      return data;
    } catch {
      this.cachedHealth = { data: null, timestamp: now };
      return null;
    }
  }

  async isBackendAvailable(): Promise<boolean> {
    const health = await this.checkHealth();
    return health !== null && health.status === "ok";
  }

  /**
   * Uploads a file to backend temp storage with progress support
   */
  async uploadFile(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.success && json.data) {
              resolve(json.data);
            } else {
              reject(new Error(json.error?.message || "Upload failed"));
            }
          } catch (err: any) {
            reject(new Error("Invalid JSON response from server"));
          }
        } else {
          try {
            const json = JSON.parse(xhr.responseText);
            reject(
              new Error(
                json.error?.message ||
                  `Upload failed with status ${xhr.status}`,
              ),
            );
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () =>
        reject(new Error("Network error during file upload")),
      );
      xhr.addEventListener("abort", () =>
        reject(new Error("File upload was cancelled")),
      );

      xhr.open("POST", `${this.baseUrl}/api/uploads`);
      xhr.send(formData);
    });
  }

  /**
   * Requests a server-side conversion job
   */
  async startConversion(params: {
    fileId: string;
    toolId: string;
    targetFormat: string;
    options?: Record<string, any>;
  }): Promise<ConversionJobResponse> {
    return this.request<ConversionJobResponse>("/api/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /**
   * Polls job status
   */
  async getJobStatus(jobId: string): Promise<ConversionJobResponse> {
    return this.request<ConversionJobResponse>(
      `/api/jobs/${encodeURIComponent(jobId)}`,
    );
  }

  /**
   * Cancels a job
   */
  async cancelJob(jobId: string): Promise<void> {
    await this.request<unknown>(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });
  }

  /**
   * Safe media URL analysis
   */
  async analyzeMediaUrl(url: string): Promise<MediaAnalysisResponse> {
    return this.request<MediaAnalysisResponse>("/api/media/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  }
}

export const apiClient = new ApiClient();
