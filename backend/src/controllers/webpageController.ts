import { Request, Response } from "express";
import { HTTP_STATUS } from "../config/constants";
import {
  WebpageFetchError,
  fetchWebpageAsset,
  fetchWebpageSnapshot,
} from "../services/webpageSnapshotService";

const errorResponse = (res: Response, error: unknown, fallback: string): void => {
  const webpageError = error instanceof WebpageFetchError ? error : null;
  res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
    success: false,
    error: {
      code: webpageError?.code || "PAGE_FETCH_FAILED",
      message: webpageError?.message || fallback,
    },
    timestamp: new Date().toISOString(),
  });
};

const readUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

export async function snapshotWebpage(req: Request, res: Response): Promise<void> {
  const url = readUrl(req.body?.url);
  if (!url) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: { code: "INVALID_URL", message: "La URL debe ser una dirección HTTP o HTTPS válida." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const snapshot = await fetchWebpageSnapshot(url);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: snapshot,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    errorResponse(res, error, "No se pudo abrir esa página.");
  }
}

export async function webpageAsset(req: Request, res: Response): Promise<void> {
  const url = readUrl(req.query.url);
  if (!url) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: { code: "INVALID_URL", message: "El recurso solicitado no es válido." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const asset = await fetchWebpageAsset(url);
    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(HTTP_STATUS.OK).send(asset.buffer);
  } catch (error) {
    errorResponse(res, error, "No se pudo cargar un recurso de la página.");
  }
}
