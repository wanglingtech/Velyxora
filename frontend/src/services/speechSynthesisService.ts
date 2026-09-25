// Client-only Text-to-Speech helpers built on the browser SpeechSynthesis API.
// Playback happens in the user's browser; VELYXORA never receives the text or
// the generated speech, and no downloadable audio file is produced.

export const SPEECH_TEXT_MAX_LENGTH = 5000;
export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 2;
export const SPEECH_PITCH_MIN = 0;
export const SPEECH_PITCH_MAX = 2;

export function clampSpeechText(text: string, maxLength = SPEECH_TEXT_MAX_LENGTH): string {
  return text.slice(0, Math.max(0, maxLength));
}

export function isSpeechTextWithinLimit(text: string, maxLength = SPEECH_TEXT_MAX_LENGTH): boolean {
  return text.length <= maxLength;
}

export function normalizeSpeechRate(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, value));
}

export function normalizeSpeechPitch(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(SPEECH_PITCH_MAX, Math.max(SPEECH_PITCH_MIN, value));
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { speechSynthesis?: unknown }).speechSynthesis !== "undefined" &&
    typeof (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Best-effort classification of where a voice is produced. Browsers only
 * guarantee `localService` on some voices; `undefined` stays "unknown".
 */
export function describeVoiceSource(localService?: boolean): "local" | "network" | "unknown" {
  if (localService === true) return "local";
  if (localService === false) return "network";
  return "unknown";
}
