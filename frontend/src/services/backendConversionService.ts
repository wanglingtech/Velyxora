import {
  apiClient,
  type ConversionJobResponse,
  type UploadResponse,
} from "./apiClient";

export interface StartBackendConversionParams {
  toolId: string;
  targetFormat: string;
  options?: Record<string, unknown>;
}

interface BackendConversionApi {
  uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResponse>;
  startConversion(params: {
    fileId: string;
    toolId: string;
    targetFormat: string;
    options?: Record<string, unknown>;
  }): Promise<ConversionJobResponse>;
}

export async function uploadAndStartConversion(
  file: File,
  params: StartBackendConversionParams,
  onProgress?: (percent: number) => void,
  client: BackendConversionApi = apiClient,
): Promise<ConversionJobResponse> {
  const upload = await client.uploadFile(file, onProgress);
  const fileId = upload?.fileId?.trim();

  if (!fileId) {
    throw new Error("UPLOAD_INVALID_RESPONSE: el backend no devolvió data.fileId.");
  }

  return client.startConversion({
    fileId,
    toolId: params.toolId,
    targetFormat: params.targetFormat,
    options: params.options,
  });
}
