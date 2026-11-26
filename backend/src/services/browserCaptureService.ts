import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ENV } from "../config/env";
import { validateSafeUrl } from "../security/ssrfValidator";
import { logger } from "../utils/logger";
import { WebpageFetchError } from "./webpageSnapshotService";

/**
 * Full-page renderer for public webpages.
 *
 * The browser-independent snapshot only returns the HTML the server received,
 * so pages rendered entirely with JavaScript show an empty shell. This engine
 * drives a locally installed Chromium/Chrome through the DevTools protocol and
 * returns a real screenshot. It is fully optional: when no browser binary is
 * available the frontend falls back to the basic HTML capture.
 *
 * Every network request the page attempts is validated with the same SSRF
 * policy used by the server-side fetch, because an untrusted page could try to
 * reach loopback, private ranges or the cloud metadata endpoint.
 */

export const MAX_CAPTURE_WIDTH = 2400;
export const MIN_CAPTURE_WIDTH = 320;
export const MAX_CAPTURE_CSS_HEIGHT = 16_000;
export const MAX_CAPTURE_PIXEL_WIDTH = 4000;
export const MAX_CAPTURE_PIXEL_HEIGHT = 16_000;

const NAVIGATION_TIMEOUT_MS = 30_000;
// The load event is a secondary signal: rendering waits for network idle, so
// this only bounds how long a never-firing load event is kept pending.
const LOAD_EVENT_TIMEOUT_MS = 20_000;
const STABLE_LAYOUT_TRIES = 24;
const STABLE_LAYOUT_DELAY_MS = 250;
const CONNECT_TIMEOUT_MS = 15_000;

export interface BrowserCaptureRequest {
  url: string;
  width: number;
  scale: number;
}

export interface BrowserCaptureResult {
  buffer: Buffer;
  contentType: "image/png";
  pageWidth: number;
  pageHeight: number;
  effectiveScale: number;
  title?: string;
}

interface ClampedCapture {
  width: number;
  height: number;
  scale: number;
}

/**
 * Keeps the screenshot inside practical raster limits. The scale is reduced
 * before the page is rendered so the frontend still gets a coherent image.
 */
export const clampCaptureGeometry = (
  width: number,
  height: number,
  scale: number,
): ClampedCapture => {
  const safeWidth = Math.min(
    MAX_CAPTURE_WIDTH,
    Math.max(MIN_CAPTURE_WIDTH, Math.round(Number.isFinite(width) ? width : 1280)),
  );
  const safeHeight = Math.min(
    MAX_CAPTURE_CSS_HEIGHT,
    Math.max(200, Math.round(Number.isFinite(height) ? height : 900)),
  );
  const requestedScale = Math.min(3, Math.max(0.5, Number.isFinite(scale) ? scale : 1));
  const effectiveScale = Math.max(
    0.5,
    Math.min(
      requestedScale,
      MAX_CAPTURE_PIXEL_WIDTH / safeWidth,
      MAX_CAPTURE_PIXEL_HEIGHT / safeHeight,
    ),
  );
  return {
    width: safeWidth,
    height: safeHeight,
    scale: Math.round(effectiveScale * 100) / 100,
  };
};

const WINDOWS_CANDIDATES = [
  "Google\\Chrome\\Application\\chrome.exe",
  "Google\\Chrome Beta\\Application\\chrome.exe",
  "Microsoft\\Edge\\Application\\msedge.exe",
];

const POSIX_CANDIDATES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
  "microsoft-edge-stable",
];

const findInPath = (name: string): string | null => {
  const directories = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        // A malformed PATH entry must not break detection.
      }
    }
  }
  return null;
};

let cachedExecutable: string | null | undefined;

/** Locates Chrome/Chromium/Edge without downloading a bundled browser. */
export const findBrowserExecutable = (): string | null => {
  if (cachedExecutable !== undefined) return cachedExecutable;

  if (ENV.CAPTURE_BROWSER_PATH) {
    cachedExecutable = fs.existsSync(ENV.CAPTURE_BROWSER_PATH) ? ENV.CAPTURE_BROWSER_PATH : null;
    return cachedExecutable;
  }

  if (process.platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter((root): root is string => Boolean(root));
    for (const root of roots) {
      for (const relative of WINDOWS_CANDIDATES) {
        const candidate = path.join(root, relative);
        if (fs.existsSync(candidate)) {
          cachedExecutable = candidate;
          return cachedExecutable;
        }
      }
    }
  } else {
    for (const name of POSIX_CANDIDATES) {
      const found = findInPath(name);
      if (found) {
        cachedExecutable = found;
        return cachedExecutable;
      }
    }
    const macCandidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    for (const candidate of macCandidates) {
      if (fs.existsSync(candidate)) {
        cachedExecutable = candidate;
        return cachedExecutable;
      }
    }
  }

  cachedExecutable = null;
  return cachedExecutable;
};

export const isBrowserCaptureAvailable = (): boolean => Boolean(findBrowserExecutable());

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, any>;
  error?: { message?: string; code?: number };
  sessionId?: string;
}

type CdpHandler = (params: Record<string, any>, sessionId?: string) => void;

/** Minimal DevTools-protocol client built on Node's global WebSocket. */
class CdpConnection {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: Record<string, any>) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();
  private readonly handlers = new Map<string, Set<CdpHandler>>();

  private constructor(private readonly socket: WebSocket) {
    socket.onmessage = (event: MessageEvent) => {
      let message: CdpMessage;
      try {
        message = JSON.parse(String(event.data)) as CdpMessage;
      } catch {
        return;
      }

      if (typeof message.id === "number") {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error) entry.reject(new Error(message.error.message || "DevTools error"));
        else entry.resolve(message.result || {});
        return;
      }

      if (message.method) {
        const handlers = this.handlers.get(message.method);
        if (!handlers) return;
        for (const handler of handlers) {
          try {
            handler(message.params || {}, message.sessionId);
          } catch (error) {
            logger.debug("browser-capture handler failed", String(error));
          }
        }
      }
    };
    socket.onclose = () => {
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error("La conexión con el navegador se cerró."));
      }
      this.pending.clear();
    };
  }

  static connect(url: string): Promise<CdpConnection> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        try {
          socket.close();
        } catch {
          // ignore
        }
        reject(new Error("No se pudo conectar con el navegador."));
      }, CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        clearTimeout(timer);
        resolve(new CdpConnection(socket));
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("No se pudo conectar con el navegador."));
      };
    });
  }

  send<T extends Record<string, any> = Record<string, any>>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
    timeoutMs = 15_000,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`El navegador no respondió a ${method}.`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  on(method: string, handler: CdpHandler): () => void {
    const handlers = this.handlers.get(method) || new Set<CdpHandler>();
    handlers.add(handler);
    this.handlers.set(method, handlers);
    return () => handlers.delete(handler);
  }

  waitFor(method: string, sessionId: string, timeoutMs: number): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`El navegador no emitió ${method}.`));
      }, timeoutMs);
      const off = this.on(method, (params, eventSession) => {
        if (eventSession && eventSession !== sessionId) return;
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  close(): void {
    try {
      this.socket.close();
    } catch {
      // ignore
    }
  }
}

interface LaunchedBrowser {
  process: ChildProcess;
  cdp: CdpConnection;
  userDataDir: string;
}

const readDevToolsPort = async (file: string): Promise<string | null> => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const raw = await fsp.readFile(file, "utf8");
      const [port] = raw.trim().split(/\r?\n/);
      if (port) return port;
    } catch {
      // Chrome creates the file asynchronously and keeps a handle on Windows.
    }
    await sleep(100);
  }
  return null;
};

const browserArguments = (width: number, userDataDir: string): string[] => [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-sync",
  "--disable-features=Translate,MediaRouter,OptimizationHints",
  "--metrics-recording-only",
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  "--hide-scrollbars",
  "--force-color-profile=srgb",
  "--block-new-web-contents",
  "--remote-debugging-port=0",
  `--user-data-dir=${userDataDir}`,
  `--window-size=${Math.max(320, Math.round(width))},900`,
  ...(process.env.CAPTURE_BROWSER_NO_SANDBOX === "true" ? ["--no-sandbox"] : []),
  "about:blank",
];

const launchBrowser = async (width: number): Promise<LaunchedBrowser> => {
  const executable = findBrowserExecutable();
  if (!executable) {
    throw new WebpageFetchError(
      "BROWSER_UNAVAILABLE",
      "La captura completa no está disponible en este servidor. Se usará la vista básica.",
    );
  }

  const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "vely-capture-"));
  const child = spawn(executable, browserArguments(width, userDataDir), {
    stdio: "ignore",
    windowsHide: true,
  });

  const spawnError = new Promise<never>((_resolve, reject) => {
    child.once("error", () =>
      reject(
        new WebpageFetchError(
          "BROWSER_UNAVAILABLE",
          "No se pudo iniciar el navegador de captura en este servidor.",
        ),
      ),
    );
  });

  const port = await Promise.race([readDevToolsPort(path.join(userDataDir, "DevToolsActivePort")), spawnError]);
  if (!port) {
    child.kill();
    throw new WebpageFetchError("BROWSER_UNAVAILABLE", "El navegador de captura no respondió a tiempo.");
  }

  let websocketUrl: string;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(10_000),
    });
    const version = (await response.json()) as { webSocketDebuggerUrl?: string };
    if (!version.webSocketDebuggerUrl) throw new Error("missing websocket");
    websocketUrl = version.webSocketDebuggerUrl;
  } catch {
    child.kill();
    throw new WebpageFetchError("BROWSER_UNAVAILABLE", "El navegador de captura no se pudo inicializar.");
  }

  const cdp = await CdpConnection.connect(websocketUrl);
  return { process: child, cdp, userDataDir };
};

const stopBrowser = (browser: LaunchedBrowser): void => {
  try {
    browser.cdp.close();
  } catch {
    // ignore
  }
  try {
    if (!browser.process.killed) browser.process.kill();
  } catch {
    // ignore
  }
  // Windows keeps the profile locked until Chrome exits, and the response must
  // not wait on that: the temp directory is removed in the background.
  void browser.process.once("exit", () => {
    void fsp
      .rm(browser.userDataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
      .catch(() => undefined);
  });
};

const buildRequestGuard = () => {
  const hostVerdicts = new Map<string, boolean>();
  return async (rawUrl: string): Promise<boolean> => {
    const lower = rawUrl.toLowerCase();
    if (lower.startsWith("data:") || lower.startsWith("blob:") || lower.startsWith("about:")) return true;

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return false;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const key = `${parsed.protocol}//${parsed.host}`;
    const cached = hostVerdicts.get(key);
    if (cached !== undefined) return cached;

    const validation = await validateSafeUrl(`${parsed.protocol}//${parsed.host}/`);
    hostVerdicts.set(key, validation.valid);
    return validation.valid;
  };
};

const findContentSize = async (cdp: CdpConnection, sessionId: string): Promise<{ width: number; height: number }> => {
  const metrics = await cdp.send<{ cssContentSize?: { width: number; height: number } }>(
    "Page.getLayoutMetrics",
    {},
    sessionId,
  );
  return {
    width: Math.round(metrics.cssContentSize?.width || 0),
    height: Math.round(metrics.cssContentSize?.height || 0),
  };
};

/**
 * Waits until the page stops making requests. The `load` event fires only after
 * every tracked resource, which ad-heavy sites delay far beyond the point where
 * the real content is painted; request activity is the honest signal.
 *
 * Idle is measured by the absence of new network events instead of a pending
 * request count: beacons and long-lived connections never "finish" and would
 * otherwise force every capture to hit the timeout.
 */
const waitForNetworkIdle = async (
  cdp: CdpConnection,
  sessionId: string,
  options: { idleMs: number; timeoutMs: number; minWaitMs?: number },
): Promise<void> => {
  let lastActivity = Date.now();
  const earliestReturn = Date.now() + (options.minWaitMs ?? 0);
  const touch = () => {
    lastActivity = Date.now();
  };
  const offs = [
    cdp.on("Network.requestWillBeSent", (_params, eventSession) => {
      if (eventSession === sessionId) touch();
    }),
    cdp.on("Network.loadingFinished", (_params, eventSession) => {
      if (eventSession === sessionId) touch();
    }),
    cdp.on("Network.loadingFailed", (_params, eventSession) => {
      if (eventSession === sessionId) touch();
    }),
  ];

  const deadline = Date.now() + options.timeoutMs;

  try {
    while (Date.now() < deadline) {
      if (Date.now() >= earliestReturn && Date.now() - lastActivity >= options.idleMs) return;
      await sleep(120);
    }
  } finally {
    for (const off of offs) off();
  }
};

const waitForStableLayout = async (cdp: CdpConnection, sessionId: string): Promise<{ width: number; height: number }> => {
  let previous = -1;
  let stableRounds = 0;
  let size = { width: 0, height: 0 };

  for (let attempt = 0; attempt < STABLE_LAYOUT_TRIES; attempt += 1) {
    await sleep(STABLE_LAYOUT_DELAY_MS);
    size = await findContentSize(cdp, sessionId);
    if (size.height === previous) stableRounds += 1;
    else stableRounds = 0;
    previous = size.height;
    if (stableRounds >= 2 && attempt >= 2) break;
  }

  return size;
};

const preparePage = async (cdp: CdpConnection, sessionId: string): Promise<void> => {
  const scripts = [
    `(async () => {
      const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      try { await Promise.race([document.fonts && document.fonts.ready, pause(2000)]); } catch {}
      const step = Math.max(400, Math.floor(window.innerHeight * 0.85));
      const limit = Math.min(document.documentElement.scrollHeight || 0, 60000);
      // Lazy content needs a few scroll passes, but an ad-heavy page must not
      // keep the capture waiting: cap the work to a short time budget.
      let pauses = 0;
      for (let y = 0; y < limit && pauses < 20; y += step, pauses += 1) {
        window.scrollTo(0, y);
        await pause(70);
      }
      window.scrollTo(0, 0);
      await pause(200);
      return true;
    })()`,
    `(() => {
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;}';
      document.documentElement.appendChild(style);
      return true;
    })()`,
  ];

  for (const expression of scripts) {
    try {
      await cdp.send(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true, userGesture: false },
        sessionId,
        12_000,
      );
    } catch {
      // Cosmetic preparation must never block the screenshot.
    }
  }
};

/** Renders a public URL into a PNG that the browser client slices per screen. */
export const captureWebpageScreenshot = async (
  request: BrowserCaptureRequest,
): Promise<BrowserCaptureResult> => {
  const validation = await validateSafeUrl(request.url);
  if (!validation.valid) {
    throw new WebpageFetchError(
      "URL_NOT_ALLOWED",
      validation.error || "Ese enlace no se puede abrir por seguridad.",
    );
  }

  const requestedWidth = Math.min(
    MAX_CAPTURE_WIDTH,
    Math.max(MIN_CAPTURE_WIDTH, Math.round(request.width || 1280)),
  );
  const requestedScale = Math.min(3, Math.max(0.5, request.scale || 1));

  const startedAt = Date.now();
  const mark = (label: string) =>
    logger.info("capture-timing", `${label} ${Date.now() - startedAt}ms`);

  const browser = await launchBrowser(requestedWidth);
  mark("browser-launched");
  let targetId: string | null = null;

  try {
    const { targetId: createdTarget } = await browser.cdp.send<{ targetId: string }>(
      "Target.createTarget",
      { url: "about:blank" },
    );
    targetId = createdTarget;
    const { sessionId } = await browser.cdp.send<{ sessionId: string }>("Target.attachToTarget", {
      targetId,
      flatten: true,
    });

    await Promise.all([
      browser.cdp.send("Page.enable", {}, sessionId),
      browser.cdp.send("Runtime.enable", {}, sessionId),
      browser.cdp.send("Network.enable", {}, sessionId),
      browser.cdp.send("Emulation.setScrollbarsHidden", { hidden: true }, sessionId),
    ]);

    // Untrusted pages can spawn dialogs that freeze the renderer.
    const offDialog = browser.cdp.on("Page.javascriptDialogOpening", () => {
      void browser.cdp
        .send("Page.handleJavaScriptDialog", { accept: false }, sessionId)
        .catch(() => undefined);
    });
    const offCrash = browser.cdp.on("Inspector.targetCrashed", () => undefined);

    const isAllowedRequest = buildRequestGuard();
    const offRequest = browser.cdp.on("Fetch.requestPaused", (params, eventSession) => {
      if (eventSession !== sessionId) return;
      const requestId = params.requestId as string;
      const url = String(params.request?.url || "");
      void isAllowedRequest(url)
        .then((allowed) =>
          allowed
            ? browser.cdp.send("Fetch.continueRequest", { requestId }, sessionId).catch(() => undefined)
            : browser.cdp.send(
                "Fetch.failRequest",
                { requestId, errorReason: "BlockedByClient" },
                sessionId,
              ).catch(() => undefined),
        )
        .catch(() => undefined);
    });

    await browser.cdp.send(
      "Fetch.enable",
      { patterns: [{ urlPattern: "*", requestStage: "Request" }] },
      sessionId,
    );

    await browser.cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: requestedWidth, height: 900, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );

    const loadEvent = browser.cdp.waitFor("Page.loadEventFired", sessionId, LOAD_EVENT_TIMEOUT_MS).catch(() => null);
    // Listener starts before navigating so the first requests are observed.
    const idleWait = waitForNetworkIdle(browser.cdp, sessionId, {
      idleMs: 900,
      timeoutMs: 20_000,
      minWaitMs: 2_500,
    });
    const navigation = await browser.cdp.send<{ errorText?: string; frameId?: string }>(
      "Page.navigate",
      { url: request.url },
      sessionId,
      NAVIGATION_TIMEOUT_MS,
    );
    if (navigation.errorText) {
      throw new WebpageFetchError(
        "PAGE_UNAVAILABLE",
        "No se pudo abrir esa página. Comprueba el enlace e inténtalo de nuevo.",
      );
    }
    // Network idle covers both the initial paint and the async data that fills
    // in placeholders, which the load event can miss behind slow trackers.
    await Promise.all([loadEvent, idleWait]);
    mark("network-idle");

    await preparePage(browser.cdp, sessionId);
    mark("prepare-page");
    await waitForNetworkIdle(browser.cdp, sessionId, { idleMs: 500, timeoutMs: 4_000 });
    mark("lazy-settled");
    const sourceSize = await waitForStableLayout(browser.cdp, sessionId);
    mark("stable-layout");
    const geometry = clampCaptureGeometry(sourceSize.width || requestedWidth, sourceSize.height, requestedScale);

    await browser.cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: geometry.width, height: 900, deviceScaleFactor: geometry.scale, mobile: false },
      sessionId,
    );
    await sleep(250);

    const finalSize = await findContentSize(browser.cdp, sessionId);
    const capturedHeight = Math.min(
      MAX_CAPTURE_CSS_HEIGHT,
      Math.max(200, finalSize.height || geometry.height),
    );
    const capturedWidth = Math.min(
      geometry.width,
      Math.max(MIN_CAPTURE_WIDTH, finalSize.width || geometry.width),
    );

    const titleResult = await browser.cdp
      .send<{ result?: { value?: string } }>(
        "Runtime.evaluate",
        { expression: "document.title", returnByValue: true },
        sessionId,
        5_000,
      )
      .catch(() => ({ result: undefined }));
    const title = titleResult.result?.value?.trim().slice(0, 200) || undefined;

    const screenshot = await browser.cdp.send<{ data?: string }>(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
        optimizeForSpeed: false,
        clip: { x: 0, y: 0, width: capturedWidth, height: capturedHeight, scale: 1 },
      },
      sessionId,
      45_000,
    );

    if (!screenshot.data) {
      throw new WebpageFetchError(
        "CAPTURE_FAILED",
        "La página no se pudo convertir en imagen. Prueba con otra URL o con menos contenido.",
      );
    }
    mark("screenshot");

    offRequest();
    offDialog();
    offCrash();

    return {
      buffer: Buffer.from(screenshot.data, "base64"),
      contentType: "image/png",
      pageWidth: capturedWidth,
      pageHeight: capturedHeight,
      effectiveScale: geometry.scale,
      title,
    };
  } catch (error) {
    if (error instanceof WebpageFetchError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("browser capture failed", message);
    throw new WebpageFetchError(
      "CAPTURE_FAILED",
      "La página no se pudo capturar completa. Comprueba que sea pública e inténtalo de nuevo.",
    );
  } finally {
    if (targetId) {
      await browser.cdp.send("Target.closeTarget", { targetId }, undefined, 5_000).catch(() => undefined);
    }
    stopBrowser(browser);
    mark("cleanup");
  }
};
