import { UserSettings } from "../types";

const SETTINGS_KEY = "velyxora_settings_v1";
const defaults: UserSettings = {
  language: "es",
  theme: "dark",
  imageQuality: 90,
  audioBitrate: "192k",
  videoQuality: "original",
  preferLocalProcessing: true,
  reducedMotion: false,
};

export const settingsService = {
  getSettings(): UserSettings {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return { ...defaults, ...stored };
    } catch {
      return { ...defaults };
    }
  },
  saveSettings(changes: Partial<UserSettings>): UserSettings {
    const settings = { ...this.getSettings(), ...changes };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
    return settings;
  },
};
