import { HistoryItem } from "../types";

const HISTORY_KEY = "velyxora_history_v1";
const read = (): HistoryItem[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
};
const write = (items: HistoryItem[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
};

export const historyService = {
  getHistory: read,
  addItem(
    item: Omit<HistoryItem, "id" | "timestamp"> &
      Partial<Pick<HistoryItem, "id" | "timestamp">>,
  ) {
    const next = {
      ...item,
      id: item.id || crypto.randomUUID(),
      timestamp: item.timestamp || Date.now(),
    } as HistoryItem;
    write([next, ...read()].slice(0, 100));
  },
  deleteItem(id: string) {
    write(read().filter((item) => item.id !== id));
  },
  clearHistory() {
    write([]);
  },
};
