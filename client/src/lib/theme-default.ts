/**
 * Catalog teme: White + Dark + extras. Migrarea o dată mapează ID-urile vechi
 * la cele păstrate, fără să strice sync/datele.
 */
import type { ThemeId } from "@/pages/home-kit";

export const THEME_STORAGE_KEY = "buget-familie:theme";
/** Migrare anterioară ivory/snow → ink (păstrată ca semnal istoric). */
export const THEME_MIGRATED_INK_KEY = "buget-familie:theme-migrated-ink-2026-09";
/** Migrare catalog slim 2026-09 (laundry list → white/dark/extras). */
export const THEME_MIGRATED_CATALOG_KEY = "buget-familie:theme-migrated-catalog-2026-09";
export const WHATS_NEW_KEY = "buget-familie:whats-new-2026-09";

export const DEFAULT_THEME: ThemeId = "white";

/** ID-uri din catalogul curent. */
export const KNOWN_THEMES: ThemeId[] = ["white", "dark", "aurora", "navy", "cyber"];

/**
 * ID-uri vechi + curente — folosite la strip pe <html> ca să nu rămână
 * `theme-ink` / `theme-forest` după consolidare.
 */
export const ALL_THEME_CLASS_IDS = [
  "white", "dark", "aurora", "navy", "cyber",
  "snow", "ivory", "ink", "sand", "sage", "slate", "lagoon",
  "forest", "midnight", "graphite", "copper", "plum", "rosewood",
] as const;

/** Mapare o dată: teme scoase → cea mai apropiată păstrată. */
export const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  snow: "white",
  ivory: "white",
  ink: "white",
  sand: "white",
  sage: "white",
  slate: "white",
  lagoon: "cyber",
  forest: "cyber",
  midnight: "aurora",
  plum: "aurora",
  graphite: "dark",
  copper: "dark",
  rosewood: "dark",
  navy: "navy",
  white: "white",
  dark: "dark",
  aurora: "aurora",
  cyber: "cyber",
};

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const write = (storage: StorageLike, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    /* preferința de temă nu trebuie să blocheze aplicația */
  }
};

const canonicalize = (value: string | null): ThemeId => {
  if (!value) return DEFAULT_THEME;
  const mapped = LEGACY_THEME_MAP[value];
  if (mapped) return mapped;
  if ((KNOWN_THEMES as string[]).includes(value)) return value as ThemeId;
  return DEFAULT_THEME;
};

/**
 * Citește tema salvată și, o dată, migrează ID-urile vechi la catalogul slim.
 * Default: White. Nu forțează pe utilizatorii care au deja o temă din catalog.
 */
export function resolveInitialTheme(storage: StorageLike): ThemeId {
  const saved = storage.getItem(THEME_STORAGE_KEY);
  const catalogMigrated = Boolean(storage.getItem(THEME_MIGRATED_CATALOG_KEY));

  if (!catalogMigrated) {
    write(storage, THEME_MIGRATED_CATALOG_KEY, "1");
    // Păstrează semnalul vechii migrări ink, ca fișele „Ce e nou” să nu se reseteze ciudat.
    if (!storage.getItem(THEME_MIGRATED_INK_KEY)) {
      write(storage, THEME_MIGRATED_INK_KEY, "1");
    }
    const next = canonicalize(saved);
    write(storage, THEME_STORAGE_KEY, next);
    return next;
  }

  return canonicalize(saved);
}

export function shouldShowWhatsNew(storage: StorageLike, blocked = false): boolean {
  if (blocked) return false;
  return !storage.getItem(WHATS_NEW_KEY);
}

export function markWhatsNewSeen(storage: StorageLike) {
  write(storage, WHATS_NEW_KEY, "1");
}
