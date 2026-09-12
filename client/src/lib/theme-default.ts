/**
 * Tema implicită trebuie să se schimbe vizibil pentru utilizatorii care au
 * rămas pe vechiul default (ivory/snow), fără să atingă pe cine a ales
 * explicit forest, midnight etc.
 */
import type { ThemeId } from "@/pages/home-kit";

export const THEME_STORAGE_KEY = "buget-familie:theme";
export const THEME_MIGRATED_INK_KEY = "buget-familie:theme-migrated-ink-2026-09";
export const WHATS_NEW_KEY = "buget-familie:whats-new-2026-09";
export const DEFAULT_THEME: ThemeId = "ink";
export const LEGACY_DEFAULT_THEMES: ThemeId[] = ["ivory", "snow"];

const KNOWN_THEMES: ThemeId[] = [
  "snow", "ivory", "ink", "sand", "sage", "slate", "lagoon",
  "forest", "midnight", "navy", "graphite", "copper", "plum", "rosewood",
];

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const knownTheme = (value: string | null): value is ThemeId =>
  Boolean(value && KNOWN_THEMES.includes(value as ThemeId));

const write = (storage: StorageLike, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    /* preferința de temă nu trebuie să blocheze aplicația */
  }
};

/**
 * Citește tema salvată. Dacă nu există preferință reală — sau e vechiul default
 * ivory/snow și migrarea nu a rulat — trece o dată pe Ink Studio.
 */
export function resolveInitialTheme(storage: StorageLike): ThemeId {
  const saved = storage.getItem(THEME_STORAGE_KEY);
  const migrated = Boolean(storage.getItem(THEME_MIGRATED_INK_KEY));

  if (!migrated) {
    write(storage, THEME_MIGRATED_INK_KEY, "1");
    if (!saved || saved === "ivory" || saved === "snow") {
      write(storage, THEME_STORAGE_KEY, DEFAULT_THEME);
      return DEFAULT_THEME;
    }
  }

  if (saved === "dark") return "forest";
  if (knownTheme(saved)) return saved;
  return DEFAULT_THEME;
}

export function shouldShowWhatsNew(storage: StorageLike, blocked = false): boolean {
  if (blocked) return false;
  return !storage.getItem(WHATS_NEW_KEY);
}

export function markWhatsNewSeen(storage: StorageLike) {
  write(storage, WHATS_NEW_KEY, "1");
}
