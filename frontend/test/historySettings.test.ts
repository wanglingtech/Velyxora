import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
const { settingsService } = await import("../src/services/settingsService");
const { historyService } = await import("../src/services/historyService");

test("settings usa defaults, persiste, recarga y restablece", () => {
  storage.clear();
  assert.equal(settingsService.getSettings().saveHistory, true);
  settingsService.updateSettings({ reducedMotion: true, confirmBeforeClearHistory: false });
  assert.equal(settingsService.getSettings().reducedMotion, true);
  assert.equal(settingsService.getSettings().confirmBeforeClearHistory, false);
  assert.equal(settingsService.resetSettings().reducedMotion, false);
});

test("settings recupera defaults ante datos corruptos", () => {
  localStorage.setItem("velyxora_settings_v2", "{bad-json");
  assert.equal(settingsService.getSettings().version, 2);
});

test("historial registra estados terminales, persiste, borra y limpia", () => {
  storage.clear(); settingsService.resetSettings();
  for (const status of ["COMPLETED", "FAILED", "CANCELLED"] as const) historyService.addItem({ toolId: `tool-${status}`, toolName: "Tool", inputName: `${status}.txt`, status });
  assert.deepEqual(historyService.getHistory().map((entry) => entry.status), ["CANCELLED", "FAILED", "COMPLETED"]);
  const id = historyService.getHistory()[0].id;
  historyService.deleteItem(id); assert.equal(historyService.getHistory().length, 2);
  historyService.clearHistory(); assert.equal(historyService.getHistory().length, 0);
});

test("historial ignora datos corruptos y respeta saveHistory=false", () => {
  storage.clear(); settingsService.resetSettings();
  localStorage.setItem("velyxora_history_v2", "not-json");
  assert.deepEqual(historyService.getHistory(), []);
  settingsService.updateSettings({ saveHistory: false });
  historyService.addItem({ toolId: "x", toolName: "X", inputName: "x.txt", status: "COMPLETED" });
  assert.equal(historyService.getHistory().length, 0);
});
