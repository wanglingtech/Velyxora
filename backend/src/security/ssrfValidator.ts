import { URL } from "url";
import dns from "dns/promises";
import net from "net";

// Blocked private IPv4 ranges & loopback
const PRIVATE_IPV4_REGEX =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)$/;

// Blocked hostnames
const FORBIDDEN_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "169.254.169.254",
  "instance-data",
]);

function parseIPv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part)))
    return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function expandIPv6(address: string): number[] | null {
  const normalized = address.split("%")[0].toLowerCase();
  if (normalized.includes(".")) {
    const separator = normalized.lastIndexOf(":");
    const ipv4 = parseIPv4(normalized.slice(separator + 1));
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    return expandIPv6(`${normalized.slice(0, separator)}:${high}:${low}`);
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0]
    ? halves[0]
        .split(":")
        .filter(Boolean)
        .map((part) => parseInt(part, 16))
    : [];
  const right =
    halves.length === 2 && halves[1]
      ? halves[1]
          .split(":")
          .filter(Boolean)
          .map((part) => parseInt(part, 16))
      : [];
  if (
    [...left, ...right].some(
      (group) => !Number.isInteger(group) || group < 0 || group > 0xffff,
    )
  )
    return null;
  const missing = 8 - left.length - right.length;
  if (
    (halves.length === 1 && missing !== 0) ||
    (halves.length === 2 && missing < 1)
  )
    return null;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

function isRestrictedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (net.isIPv4(normalized)) {
    const octets = parseIPv4(normalized);
    if (!octets) return true;
    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }

  if (!net.isIPv6(normalized)) return false;
  const groups = expandIPv6(normalized);
  if (!groups) return true;
  const first = groups[0];
  const isMappedIPv4 =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMappedIPv4) {
    const octets = [
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff,
    ];
    return isRestrictedAddress(octets.join("."));
  }
  return (
    groups.every((group) => group === 0) ||
    (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80
  );
}

/**
 * Validates a target URL against SSRF threats:
 * - Only http: and https: allowed
 * - Blocks loopback, private ranges, link-local, cloud metadata services
 * - Performs DNS resolution to verify destination IP before accepting
 */
export async function validateSafeUrl(
  rawUrl: string,
): Promise<{ valid: boolean; error?: string; parsedUrl?: URL }> {
  try {
    const parsed = new URL(rawUrl);

    // Protocol check
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        error: `Invalid protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check against forbidden hostnames
    if (
      FORBIDDEN_HOSTS.has(hostname) ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return {
        valid: false,
        error: `Host '${hostname}' is restricted for security reasons.`,
      };
    }

    // Direct IP pattern check
    if (PRIVATE_IPV4_REGEX.test(hostname) || isRestrictedAddress(hostname)) {
      return {
        valid: false,
        error: `Private IP ranges (${hostname}) are blocked to prevent SSRF.`,
      };
    }

    // Resolve DNS to verify actual IP
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (isRestrictedAddress(addr.address)) {
          return {
            valid: false,
            error: `Host '${hostname}' resolves to restricted IP ${addr.address}.`,
          };
        }
      }
    } catch (dnsErr: any) {
      return {
        valid: false,
        error: `Unable to resolve host '${hostname}': ${dnsErr.message}`,
      };
    }

    return { valid: true, parsedUrl: parsed };
  } catch (err: any) {
    return { valid: false, error: `Malformed URL: ${err.message}` };
  }
}
