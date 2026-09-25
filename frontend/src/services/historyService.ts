import { HistoryItem } from "../types";
import { settingsService } from "./settingsService";
import { apiClient } from "./apiClient";

const HISTORY_KEY = "velyxora_history_v2";

export interface HistoryRepository { getAll(): HistoryItem[]; save(items: HistoryItem[]): void; }

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

export class ApiHistoryRepository {
  async getAll(): Promise<HistoryItem[]> {
    const { items } = await apiClient.history.list(50);
    return items.map((item) => ({
      id: item.id, toolId: item.toolId, toolName: item.toolId,
      inputName: item.inputFileName || "Tarea sin archivo",
      inputSize: item.inputSize == null ? undefined : Number(item.inputSize),
      outputName: item.outputFileName || undefined,
      outputSize: item.outputSize == null ? undefined : Number(item.outputSize),
      timestamp: new Date(item.createdAt).getTime(), status: item.status,
      processingLocation: String(item.processingType).toLowerCase(),
    })) as HistoryItem[];
  }
  async save(item: HistoryItem): Promise<void> {
    await apiClient.history.create({
      toolId: item.toolId, status: item.status, processingType: item.processingLocation.toUpperCase(),
      inputFileName: item.inputName, inputSize: item.inputSize, inputMime: item.inputMime,
      outputFileName: item.outputName, outputSize: item.outputSize,
      jobId: item.processingLocation === "local" ? undefined : item.id,
    });
  }
  async remove(id: string): Promise<void> { await apiClient.history.remove(id); }
}

const local = new LocalHistoryRepository();
const api = new ApiHistoryRepository();
let authenticated = false;

export const historyService = {
  setAuthenticated(value: boolean) { authenticated = value; },
  getHistory: () => local.getAll(),
  async getSyncedHistory() { return authenticated ? api.getAll() : local.getAll(); },
  addItem(item: Omit<HistoryItem, "id" | "timestamp" | "processingLocation" | "status"> & Partial<Pick<HistoryItem, "id" | "timestamp" | "processingLocation" | "status">>) {
    if (!settingsService.getSettings().saveHistory) return;
    const next: HistoryItem = { ...item, id: item.id || crypto.randomUUID(), timestamp: item.timestamp || Date.now(), status: item.status || "COMPLETED", processingLocation: item.processingLocation || ((item as any).processingMode === "EXTERNAL_PROVIDER" ? "external" : (item as any).processingMode === "SERVER_SIDE" ? "server" : "local") } as HistoryItem;
    if (authenticated) { void api.save(next); return; }
    const items = local.getAll().filter((old) => old.id !== next.id && !(old.toolId === next.toolId && old.inputName === next.inputName && old.status === next.status && Math.abs(old.timestamp - next.timestamp) < 5000));
    local.save([next, ...items].slice(0, 100));
  },
  async deleteItem(id: string) { if (authenticated) await api.remove(id); else local.save(local.getAll().filter((item) => item.id !== id)); },
  clearHistory() { local.save([]); },
};
