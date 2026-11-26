import { validateSafeUrl } from "../security/ssrfValidator";

/**
 * Fetches a public webpage so the browser can render a snapshot without being
 * blocked by cross-origin rules. Every hop is SSRF-validated, responses are
 * bounded and only HTML/images are accepted.
 */

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export class WebpageFetchError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "WebpageFetchError";
  }
}

export interface WebpageSnapshot {
  html: string;
  finalUrl: string;
  title?: string;
}

interface SafeResponse {
  response: Response;
  finalUrl: string;
}

const fetchWithSafeRedirects = async (
  rawUrl: string,
  accept: string,
): Promise<SafeResponse> => {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validation = await validateSafeUrl(current);
    if (!validation.valid || !validation.parsedUrl) {
      throw new WebpageFetchError(
        "URL_NOT_ALLOWED",
        validation.error || "Ese enlace no se puede abrir por seguridad.",
      );
    }

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept,
          "user-agent": "Velyxora/1.0 (webpage snapshot)",
        },
      });
    } catch {
      throw new WebpageFetchError(
        "PAGE_UNAVAILABLE",
        "No se pudo abrir esa página. Comprueba el enlace e inténtalo de nuevo.",
      );
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) {
        throw new WebpageFetchError("PAGE_UNAVAILABLE", "La página redirige a una dirección no válida.");
      }
      current = new URL(location, current).toString();
      continue;
    }

    return { response, finalUrl: current };
  }

  throw new WebpageFetchError("TOO_MANY_REDIRECTS", "La página redirige demasiadas veces.");
};

const readLimited = async (response: Response, maxBytes: number): Promise<Buffer> => {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new WebpageFetchError("PAGE_TOO_LARGE", "La página es demasiado grande para procesarla aquí.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Removes elements that could navigate away or execute code inside the preview. */
export const sanitizeSnapshotHtml = (html: string, finalUrl: string): string => {
  let output = html
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    // Remove script tags to prevent console noise in sandboxed preview
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  const baseTag = `<base href="${escapeAttribute(finalUrl)}">`;
  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else {
    output = `${baseTag}${output}`;
  }
  return output;
};

export const fetchWebpageSnapshot = async (rawUrl: string): Promise<WebpageSnapshot> => {
  const { response, finalUrl } = await fetchWithSafeRedirects(
    rawUrl,
    "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
  );
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    await response.body?.cancel();
    throw new WebpageFetchError(
      "NOT_HTML",
      "Ese enlace no devuelve una página web (HTML). Prueba con la dirección de la página, no con un archivo.",
    );
  }
  const buffer = await readLimited(response, MAX_HTML_BYTES);
  const html = buffer.toString("utf8");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  return {
    html: sanitizeSnapshotHtml(html, finalUrl),
    finalUrl,
    title: title ? title.slice(0, 200) : undefined,
  };
};

export const fetchWebpageAsset = async (
  rawUrl: string,
): Promise<{ buffer: Buffer; contentType: string }> => {
  const { response } = await fetchWithSafeRedirects(rawUrl, "image/*,*/*;q=0.1");
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    await response.body?.cancel();
    throw new WebpageFetchError("NOT_IMAGE", "Un recurso de la página no es una imagen válida.");
  }
  const buffer = await readLimited(response, MAX_ASSET_BYTES);
  return { buffer, contentType: contentType.split(";")[0] || "application/octet-stream" };
};
