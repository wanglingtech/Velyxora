import path from "path";

/**
 * Sanitizes an incoming filename to prevent Path Traversal, OS injection,
 * and invalid filesystem characters across Linux, Windows, and macOS.
 */
export function sanitizeFilename(
  rawName: string,
  defaultName: string = "file",
): string {
  if (!rawName || typeof rawName !== "string") return defaultName;

  // Extract basename to eliminate directory traversal sequences like ../ or ..\
  let clean = path.basename(rawName.trim());

  // Strip null bytes and control characters
  clean = Array.from(clean)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && (code < 0x80 || code > 0x9f);
    })
    .join("");

  // Strip characters forbidden in common filesystems: < > : " / \ | ? *
  clean = clean.replace(/[<>:"/\\|?*]/g, "_");

  // Prevent dotfiles and multiple consecutive dots
  clean = clean.replace(/^\.+/, "");
  clean = clean.replace(/\.{2,}/g, ".");

  // Truncate to reasonable length (max 200 chars)
  if (clean.length > 200) {
    const ext = path.extname(clean);
    const base = path.basename(clean, ext);
    clean = `${base.substring(0, 190)}${ext}`;
  }

  return clean || defaultName;
}

/**
 * Escapes characters for safe usage in CLI arguments
 */
export function escapeCliArg(arg: string): string {
  return arg.replace(/(["\s'$`\\])/g, "\\$1");
}
