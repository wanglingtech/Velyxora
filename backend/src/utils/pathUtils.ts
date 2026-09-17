import path from 'path';
import fs from 'fs';

/**
 * Ensures that a target file path remains safely within an allowed base directory.
 * Throws an error if Path Traversal escape is attempted.
 */
export function assertSafePath(baseDir: string, targetPath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`Security Exception: Access denied to path outside boundary: ${targetPath}`);
  }

  return resolvedTarget;
}

/**
 * Ensures directory exists synchronously
 */
export function ensureDirSync(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
