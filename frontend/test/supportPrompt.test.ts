import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SUPPORT_PROMPT_KEY,
  SUPPORT_PROMPT_COOLDOWN_MS,
  isSupportPromptDue,
  shouldShowSupportPrompt,
  markSupportPromptShown,
  readSupportPromptRecord,
} from "../src/services/supportPromptService";

const readSrc = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const withStorage = <T>(run: () => T): T => {
  const original = (globalThis as any).localStorage;
  (globalThis as any).localStorage = new MemoryStorage();
  try {
    return run();
  } finally {
    if (original === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = original;
  }
};

test("la frecuencia usa una clave versionada y un cooldown conservador", () => {
  assert.equal(SUPPORT_PROMPT_KEY, "velyxora_support_prompt_v1");
  assert.ok(SUPPORT_PROMPT_COOLDOWN_MS >= 7 * 24 * 60 * 60 * 1000, "el cooldown debe ser de al menos una semana");
});

test("isSupportPromptDue muestra en la primera visita y respeta el cooldown", () => {
  const now = 1_000_000_000_000;
  assert.equal(isSupportPromptDue(null, now), true, "sin registro previo debe mostrarse");
  assert.equal(isSupportPromptDue(now - SUPPORT_PROMPT_COOLDOWN_MS + 1, now), false, "dentro del cooldown no debe mostrarse");
  assert.equal(isSupportPromptDue(now - SUPPORT_PROMPT_COOLDOWN_MS, now), true, "al cumplirse el cooldown vuelve a mostrarse");
  assert.equal(isSupportPromptDue(now - SUPPORT_PROMPT_COOLDOWN_MS - 1, now), true);
});

test("marcar como mostrado persiste y evita repeticiones durante el cooldown", () => {
  withStorage(() => {
    assert.equal(shouldShowSupportPrompt(1_000), true);
    markSupportPromptShown(1_000);
    assert.deepEqual(readSupportPromptRecord(), { lastShownAt: 1_000 });
    assert.equal(shouldShowSupportPrompt(1_000 + 60_000), false, "no debe repetirse en una navegación normal");
    assert.equal(shouldShowSupportPrompt(1_000 + SUPPORT_PROMPT_COOLDOWN_MS), true, "tras el cooldown vuelve a estar disponible");
  });
});

test("un registro corrupto se trata como pendiente sin romper la app", () => {
  withStorage(() => {
    (globalThis as any).localStorage.setItem(SUPPORT_PROMPT_KEY, "{no-es-json");
    assert.equal(shouldShowSupportPrompt(5_000), true);
    assert.equal(readSupportPromptRecord(), null);
  });
});

test("sin almacenamiento disponible el aviso sigue siendo mostrable y no lanza", () => {
  const original = (globalThis as any).localStorage;
  delete (globalThis as any).localStorage;
  try {
    assert.equal(shouldShowSupportPrompt(1), true);
    assert.doesNotThrow(() => markSupportPromptShown(1));
    assert.equal(readSupportPromptRecord(), null);
  } finally {
    if (original !== undefined) (globalThis as any).localStorage = original;
  }
});

test("el modal de apoyo es opcional, accesible y no duplica identificadores de apoyo", () => {
  const modal = readSrc("../src/components/common/SupportPromptModal.tsx");
  for (const required of [
    'role="dialog"',
    'aria-modal="true"',
    'aria-labelledby="support-prompt-title"',
    'aria-describedby="support-prompt-description"',
    "Apoyar VELYXORA",
    "Ahora no",
    "Escape",
    "safe-area-inset-bottom",
    "max-h-[calc(100dvh",
  ]) {
    assert.ok(modal.includes(required), `el modal debe incluir "${required}"`);
  }
  // Un solo origen de verdad: el modal no duplica datos de apoyo ni procesa pagos.
  for (const forbidden of ["968555200", "paypal.me", "ko-fi.com", "chat.whatsapp", "discord.gg", "supportMethods", "SUPPORT_METHODS"]) {
    assert.equal(modal.includes(forbidden), false, `el modal no debe incluir "${forbidden}"`);
  }
  for (const legacy of [/cr[eé]dito/i, /payment/i, /\bpago\b/i, /\bplan\b/i]) {
    assert.doesNotMatch(modal, legacy, "el modal no debe reintroducir terminología comercial");
  }
});