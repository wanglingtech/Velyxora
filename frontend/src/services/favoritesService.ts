const FAVORITES_STORAGE_KEY = "velyxora_favorites_v1";

const readFavorites = (): string[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) &&
      parsed.every((value) => typeof value === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
};

const writeFavorites = (favorites: string[]): void => {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Storage may be unavailable in private browsing or restricted environments.
  }
};

export const favoritesService = {
  getFavorites(): string[] {
    return readFavorites();
  },

  isFavorite(toolId: string): boolean {
    return readFavorites().includes(toolId);
  },

  toggleFavorite(toolId: string): string[] {
    const favorites = readFavorites();
    const nextFavorites = favorites.includes(toolId)
      ? favorites.filter((id) => id !== toolId)
      : [...favorites, toolId];

    writeFavorites(nextFavorites);
    return nextFavorites;
  },
};
