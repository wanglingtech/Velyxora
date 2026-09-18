import { apiClient } from "./apiClient";

export interface DownloadedFile {
  blob: Blob;
  filename: string;
  contentType: string;
}

const clickBlob = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Keep the URL alive through the browser's click task, then always release it.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

export const downloadService = {
  downloadBlob(blob: Blob, filename: string): void {
    if (!blob.size) throw new Error("DOWNLOAD_FAILED: el archivo está vacío.");
    clickBlob(blob, filename);
  },

  async downloadFromUrl(url: string, filename?: string): Promise<DownloadedFile> {
    const result = await this.getFromUrl(url, filename);
    clickBlob(result.blob, result.filename);
    return result;
  },

  async getFromUrl(url: string, filename?: string): Promise<DownloadedFile> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`DOWNLOAD_FAILED: HTTP ${response.status}.`);
    const blob = await response.blob();
    return {
      blob,
      filename: filename || "descarga",
      contentType: response.headers.get("content-type") || blob.type || "application/octet-stream",
    };
  },

  async downloadBackendFile(fileId: string, filename?: string): Promise<DownloadedFile> {
    const result = await this.getBackendFile(fileId);
    clickBlob(result.blob, filename || result.filename);
    return result;
  },

  async getBackendFile(fileId: string): Promise<DownloadedFile> {
    return apiClient.downloadFile(fileId);
  },
};
