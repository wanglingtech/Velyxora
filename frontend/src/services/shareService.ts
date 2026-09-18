export type ShareTarget =
  | {
      kind: "file";
      title?: string;
      text?: string;
      getFile: () => Promise<File>;
      download: () => void | Promise<void>;
    }
  | {
      kind: "text";
      title?: string;
      text: string;
      copy: (text: string) => void | Promise<void>;
    }
  | {
      kind: "url";
      title?: string;
      text?: string;
      url: string;
      copy: (url: string) => void | Promise<void>;
    };

export type ShareOutcome =
  | { status: "shared" }
  | { status: "cancelled" }
  | { status: "fallback"; action: "download" | "copy-text" | "copy-url" };

type ShareNavigator = Pick<Navigator, "share" | "canShare">;

function isNonPublicIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127);
}

function parseIpv6(hostname: string): number[] | null {
  const halves = hostname.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const parts = [...left, ...Array(missing).fill("0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

function isNonPublicIpv6(hostname: string): boolean {
  const parts = parseIpv6(hostname);
  if (!parts) return false;
  if (parts.every((part) => part === 0)) return true;
  if (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) return true;
  if ((parts[0] & 0xfe00) === 0xfc00 || (parts[0] & 0xffc0) === 0xfe80) return true;

  const mapped = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  const compatible = parts.slice(0, 6).every((part) => part === 0);
  if (mapped || compatible) {
    const ipv4 = `${parts[6] >> 8}.${parts[6] & 0xff}.${parts[7] >> 8}.${parts[7] & 0xff}`;
    return isNonPublicIpv4(ipv4);
  }
  return false;
}

export function isPublicShareUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    if (isNonPublicIpv4(hostname) || isNonPublicIpv6(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isShareCancellation(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
}

async function runFallback(target: ShareTarget): Promise<ShareOutcome> {
  if (target.kind === "file") {
    await target.download();
    return { status: "fallback", action: "download" };
  }
  if (target.kind === "text") {
    await target.copy(target.text);
    return { status: "fallback", action: "copy-text" };
  }
  if (!isPublicShareUrl(target.url)) throw new Error("SHARE_PRIVATE_URL");
  await target.copy(target.url);
  return { status: "fallback", action: "copy-url" };
}

export async function shareResult(
  target: ShareTarget,
  shareNavigator: Partial<ShareNavigator> = navigator,
): Promise<ShareOutcome> {
  if (target.kind === "url" && !isPublicShareUrl(target.url)) {
    throw new Error("SHARE_PRIVATE_URL");
  }

  if (typeof shareNavigator.share !== "function") return runFallback(target);

  if (target.kind === "file") {
    if (typeof shareNavigator.canShare !== "function") return runFallback(target);
    const file = await target.getFile();
    let supported = false;
    try {
      supported = shareNavigator.canShare({ files: [file] });
    } catch {
      supported = false;
    }
    if (!supported) return runFallback(target);
    try {
      await shareNavigator.share({ title: target.title, text: target.text, files: [file] });
      return { status: "shared" };
    } catch (error) {
      if (isShareCancellation(error)) return { status: "cancelled" };
      throw error;
    }
  }

  const data = target.kind === "text"
    ? { title: target.title, text: target.text }
    : { title: target.title, text: target.text, url: target.url };
  try {
    await shareNavigator.share(data);
    return { status: "shared" };
  } catch (error) {
    if (isShareCancellation(error)) return { status: "cancelled" };
    throw error;
  }
}

export const shareService = { share: shareResult, isPublicShareUrl };
