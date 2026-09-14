import { UserSettings } from "../types";

const SETTINGS_KEY = "velyxora_settings_v2";
const defaults: UserSettings = {
  version: 2, language: "es", theme: "dark", imageQuality: 90,
  audioBitrate: "192k", videoQuality: "original", preferLocalProcessing: true,
  reducedMotion: false, saveHistory: true, confirmBeforeClearHistory: true,
};

const validate = (value: unknown): UserSettings => {
  if (!value || typeof value !== "object") return { ...defaults };
  const candidate = value as Partial<UserSettings>;
  return {
    ...defaults,
    language: candidate.language === "en" ? "en" : "es",
    theme: ["dark", "light", "system"].includes(String(candidate.theme)) ? candidate.theme! : defaults.theme,
    imageQuality: typeof candidate.imageQuality === "number" && candidate.imageQuality >= 50 && candidate.imageQuality <= 100 ? candidate.imageQuality : defaults.imageQuality,
    audioBitrate: ["128k", "192k", "256k", "320k"].includes(String(candidate.audioBitrate)) ? candidate.audioBitrate! : defaults.audioBitrate,
    videoQuality: ["original", "1080p", "720p"].includes(String(candidate.videoQuality)) ? candidate.videoQuality! : defaults.videoQuality,
    preferLocalProcessing: typeof candidate.preferLocalProcessing === "boolean" ? candidate.preferLocalProcessing : defaults.preferLocalProcessing,
    reducedMotion: typeof candidate.reducedMotion === "boolean" ? candidate.reducedMotion : defaults.reducedMotion,
    saveHistory: typeof candidate.saveHistory === "boolean" ? candidate.saveHistory : defaults.saveHistory,
    confirmBeforeClearHistory: typeof candidate.confirmBeforeClearHistory === "boolean" ? candidate.confirmBeforeClearHistory : defaults.confirmBeforeClearHistory,
  };
};

const apply = (settings: UserSettings) => {
  if (typeof document !== "undefined") document.documentElement.dataset.reduceMotion = settings.reducedMotion ? "true" : "false";
};

export const settingsService = {
  getSettings(): UserSettings {
    try { const result = validate(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); apply(result); return result; }
    catch { const result = { ...defaults }; apply(result); return result; }
  },
  updateSettings(changes: Partial<UserSettings>): UserSettings {
    const settings = validate({ ...this.getSettings(), ...changes, version: 2 });
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* unavailable */ }
    apply(settings); return settings;
  },
  saveSettings(changes: Partial<UserSettings>): UserSettings { return this.updateSettings(changes); },
  resetSettings(): UserSettings {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults)); } catch { /* unavailable */ }
    const result = { ...defaults }; apply(result); return result;
  },
};
