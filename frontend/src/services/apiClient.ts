export interface BackendHealth {
  status: "ok" | "degraded" | "error";
  version: string;
  uptimeSeconds: number;
  services: {
    ffmpeg: boolean;
    ffprobe: boolean;
    libreOffice: boolean;
    storage: boolean;
    ytDlp: boolean;
    database: boolean;
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
    | "READY"
    | "DOWNLOADING"
    | "PROCESSING"
    | "FINALIZING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  progress: number;
  progressMessage?: string;
  output?: {
    fileId: string;
    filename: string;
    mimeType: string;
    size: number;
    downloadUrl?: string;
    duration?: number;
    width?: number;
    height?: number;
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
  contentType?: string;
  embedHtml?: string;
  formats: Array<{
    formatId: string;
    type: "video" | "audio";
    container: string;
    extension: string;
    resolution?: string;
    qualityLabel?: string;
    hasVideo: boolean;
    hasAudio: boolean;
    fps?: number;
    bitrate?: number;
    estimatedSize?: number;
    codec?: string;
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
    // VITE_API_URL is the complete API base. Accepting a bare origin here keeps
    // older local environments safe while canonical configuration ends in /api.
    const envUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3000/api";
    const normalized = envUrl ? envUrl.replace(/\/+$/, "") : "/api";
    this.baseUrl = normalized.endsWith("/api") ? normalized : `${normalized}/api`;
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
        credentials: "include",
        headers: {
          ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...(this.csrfToken() ? { "X-CSRF-Token": this.csrfToken() } : {}),
          ...init.headers,
        },
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
        const friendly: Record<number, string> = {
          401: "Tu sesión terminó o necesitas iniciar sesión.", 403: "No tienes permiso para realizar esta acción.",
          404: "El recurso solicitado no existe o ya expiró.", 409: "La operación entra en conflicto con el estado actual.",
          413: "El archivo supera el tamaño permitido.", 429: "Hay demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
          500: "Ocurrió un problema en el servidor. Inténtalo de nuevo más tarde.", 503: "El servicio está temporalmente no disponible.",
        };
        throw new Error(payload.error?.message || friendly[response.status] || "No se pudo completar la solicitud.");
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

  private csrfToken(): string {
    return document.cookie.split('; ').find((part) => part.startsWith('velyxora_csrf='))?.split('=')[1] || '';
  }

  auth = {
    register: (email: string, password: string, displayName?: string) => this.request<any>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),
    login: (email: string, password: string) => this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => this.request<any>('/auth/me'),
    logout: () => this.request<void>('/auth/logout', { method: 'POST' }),
    account: () => this.request<any>('/account'),
    adminDashboard: () => this.request<any>('/admin/dashboard'),
    adminUsers: () => this.request<any[]>('/admin/users'),
    adminPayments: () => this.request<any[]>('/admin/payments'),
    reviewPayment: (orderId: string, decision: 'APPROVE' | 'REJECT', reason: string) => this.request<any>(`/admin/payments/${encodeURIComponent(orderId)}/review`, { method: 'POST', body: JSON.stringify({ decision, reason }) }),
  };

  history = {
    list: (limit = 50) => this.request<{ items: any[]; nextCursor: string | null }>(`/history?limit=${limit}`),
    create: (item: Record<string, unknown>) => this.request<any>('/history', { method: 'POST', body: JSON.stringify(item) }),
    remove: (id: string) => this.request<void>(`/history/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };

  payments = {
    config: () => this.request<any>('/payments/config'),
    orders: () => this.request<any[]>('/payments/orders'),
    createOrder: (packageId: string, idempotencyKey: string) => this.request<any>('/payments/orders', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ packageId }) }),
    submitReference: (orderId: string, reference: string) => this.request<any>(`/payments/orders/${encodeURIComponent(orderId)}/reference`, { method: 'POST', body: JSON.stringify({ reference }) }),
  };

  estimateCredits(toolId: string, inputBytes: number, options: Record<string, unknown> = {}) {
    return this.request<{ estimatedCredits: number; currentBalance: number; balanceAfter: number; processingClass: string }>('/credits/estimate', { method: 'POST', body: JSON.stringify({ toolId, inputBytes, options }) });
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

      const res = await fetch(`${this.baseUrl}/health`, {
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

      xhr.open("POST", `${this.baseUrl}/uploads`);
      xhr.withCredentials = true;
      const csrf = this.csrfToken();
      if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);
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
    return this.request<ConversionJobResponse>("/conversions", {
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
      `/jobs/${encodeURIComponent(jobId)}`,
    );
  }

  /**
   * Cancels a job
   */
  async cancelJob(jobId: string): Promise<void> {
    await this.request<unknown>(`/conversions/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });
  }

  /**
   * Safe media URL analysis
   */
  async analyzeMediaUrl(url: string): Promise<MediaAnalysisResponse> {
    return this.request<MediaAnalysisResponse>("/media/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  }

  async startMediaDownload(params: { url: string; formatId: string; container: string; type: "video" | "audio"; title: string }): Promise<ConversionJobResponse> {
    return this.request<ConversionJobResponse>("/media/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async downloadFile(fileId: string): Promise<{ blob: Blob; filename: string; contentType: string }> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/download/${encodeURIComponent(fileId)}`, { credentials: 'include' });
    } catch {
      throw new Error("Backend no disponible: no se pudo establecer conexión.");
    }
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!response.ok) {
      let message = `DOWNLOAD_FAILED: HTTP ${response.status}.`;
      if (contentType.includes("application/json")) {
        const payload = await response.json().catch(() => null);
        message = payload?.error?.message || message;
      }
      throw new Error(message);
    }
    if (contentType.includes("application/json")) {
      throw new Error("DOWNLOAD_FAILED: el backend devolvió JSON en lugar de un archivo.");
    }
    const disposition = response.headers.get("content-disposition") || "";
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quoted = disposition.match(/filename="([^"]+)"/i)?.[1];
    const filename = encoded ? decodeURIComponent(encoded) : quoted || `download-${fileId}`;
    const blob = await response.blob();
    if (!blob.size) throw new Error("DOWNLOAD_FAILED: el archivo descargado está vacío.");
    return { blob, filename, contentType };
  }
}

export const apiClient = new ApiClient();
