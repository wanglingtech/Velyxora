// Voluntary support notice: client-side frequency policy only.
//
// The key is versioned so a future copy/design change can intentionally reset
// the notice by bumping the suffix. After the notice is shown we record the
// timestamp and do not surface it again automatically until the cooldown has
// elapsed (a conservative 14 days). No backend, no database, no analytics.

export const SUPPORT_PROMPT_KEY = "velyxora_support_prompt_v1";

/** Minimum time between two automatic showings of the support notice. */
export const SUPPORT_PROMPT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export interface SupportPromptRecord {
  lastShownAt: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const getStorage = (): StorageLike | null => {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
};

export function readSupportPromptRecord(): SupportPromptRecord | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SUPPORT_PROMPT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as SupportPromptRecord).lastShownAt === "number" &&
      Number.isFinite((parsed as SupportPromptRecord).lastShownAt)
    ) {
      return { lastShownAt: (parsed as SupportPromptRecord).lastShownAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function isSupportPromptDue(
  lastShownAt: number | null,
  now: number,
  cooldownMs: number = SUPPORT_PROMPT_COOLDOWN_MS,
): boolean {
  if (lastShownAt === null) return true;
  return now - lastShownAt >= cooldownMs;
}

export function shouldShowSupportPrompt(now: number = Date.now()): boolean {
  const record = readSupportPromptRecord();
  return isSupportPromptDue(record?.lastShownAt ?? null, now);
}

export function markSupportPromptShown(now: number = Date.now()): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SUPPORT_PROMPT_KEY, JSON.stringify({ lastShownAt: now }));
  } catch {
    // Storage may be unavailable in private browsing or restricted environments.
  }
}
