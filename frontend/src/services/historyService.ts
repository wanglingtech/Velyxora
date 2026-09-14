import { HistoryItem } from "../types";
import { settingsService } from "./settingsService";

const HISTORY_KEY = "velyxora_history_v2";

export interface HistoryRepository {
  getAll(): HistoryItem[];
  save(items: HistoryItem[]): void;
}

export class LocalHistoryRepository implements HistoryRepository {
  getAll(): HistoryItem[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is HistoryItem => item && typeof item.id === "string" && typeof item.toolId === "string" && ["COMPLETED", "FAILED", "CANCELLED"].includes(item.status));
    } catch { return []; }
  }
  save(items: HistoryItem[]): void { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch { /* unavailable */ } }
}

const repository: HistoryRepository = new LocalHistoryRepository();

export const historyService = {
  getHistory: () => repository.getAll(),
  addItem(item: Omit<HistoryItem, "id" | "timestamp" | "processingLocation" | "status"> & Partial<Pick<HistoryItem, "id" | "timestamp" | "processingLocation" | "status">>) {
    if (!settingsService.getSettings().saveHistory) return;
    const now = Date.now();
    const next: HistoryItem = {
      ...item, id: item.id || crypto.randomUUID(), timestamp: item.timestamp || now,
      status: item.status || "COMPLETED", processingLocation: item.processingLocation || ((item as any).processingMode === "SERVER_SIDE" ? "server" : "local"),
    } as HistoryItem;
    const items = repository.getAll().filter((old) => old.id !== next.id && !(old.toolId === next.toolId && old.inputName === next.inputName && old.status === next.status && Math.abs(old.timestamp - next.timestamp) < 5000));
    repository.save([next, ...items].slice(0, 100));
  },
  deleteItem(id: string) { repository.save(repository.getAll().filter((item) => item.id !== id)); },
  clearHistory() { repository.save([]); },
};
