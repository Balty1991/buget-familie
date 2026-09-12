/**
 * Catalog teme: White + Dark + extras. Migrarea o dată mapează ID-urile vechi
 * la cele păstrate, fără să strice sync/datele.
 */
import type { ThemeId } from "@/pages/home-kit";
import { safeSetItem } from "@/lib/safe-storage";

export const THEME_STORAGE_KEY = "buget-familie:theme";
/** Migrare anterioară ivory/snow → ink (păstrată ca semnal istoric). */
export const THEME_MIGRATED_INK_KEY = "buget-familie:theme-migrated-ink-2026-09";
/** Migrare catalog slim 2026-09 (laundry list → white/dark/extras). */
export const THEME_MIGRATED_CATALOG_KEY = "buget-familie:theme-migrated-catalog-2026-09";
/**
 * Migrare Atelier Platinum: utilizatorii pe look-ul stark ink/white văd noul
 * Alb implicit (CSS). Aurora / Navy / Cyber rămân neatins.
 */
export const THEME_MIGRATED_ATELIER_KEY = "buget-familie:theme-migrated-atelier-2026-09";
/**
 * Migrare Atelier Premium (fintech bold): utilizatorii pe Alb implicit văd noul
 * look; cheile vechi de „skin” local sunt curățate o dată.
 */
export const THEME_MIGRATED_PREMIUM_KEY = "buget-familie:theme-migrated-premium-2026-09";
/** Migrare UI chrome 2026-09: fonts/buttons/menus + secondary tabs. */
export const THEME_MIGRATED_UI_CHROME_KEY = "buget-familie:theme-migrated-ui-chrome-2026-09";
export const WHATS_NEW_KEY = "buget-familie:whats-new-premium-2026-09";

/** Chei locale vechi care puteau bloca look-ul nou pe Alb. */
export const STALE_SKIN_KEYS = [
  "buget-familie:skin",
  "buget-familie:skin-tokens",
  "buget-familie:custom-theme",
  "buget-familie:theme-tokens",
  "buget-familie:visual-skin",
  "buget-familie:atelier-skin",
] as const;

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
  removeItem?: (key: string) => void;
};

const write = (storage: StorageLike, key: string, value: string) => {
  safeSetItem(storage, key, value);
};

const clear = (storage: StorageLike, key: string) => {
  try {
    storage.removeItem?.(key);
  } catch {
    /* ignore */
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
 * Default: White (Atelier Premium). Nu forțează pe utilizatorii care au deja
 * Aurora / Navy / Cyber.
 */
export function resolveInitialTheme(storage: StorageLike): ThemeId {
  const saved = storage.getItem(THEME_STORAGE_KEY);
  const catalogMigrated = Boolean(storage.getItem(THEME_MIGRATED_CATALOG_KEY));

  let next: ThemeId;
  if (!catalogMigrated) {
    write(storage, THEME_MIGRATED_CATALOG_KEY, "1");
    // Păstrează semnalul vechii migrări ink, ca fișele „Ce e nou” să nu se reseteze ciudat.
    if (!storage.getItem(THEME_MIGRATED_INK_KEY)) {
      write(storage, THEME_MIGRATED_INK_KEY, "1");
    }
    next = canonicalize(saved);
    write(storage, THEME_STORAGE_KEY, next);
  } else {
    next = canonicalize(saved);
  }

  // O dată: marchează trecerea la Atelier Platinum. Look-ul nou vine din CSS pe white.
  // Aurora / Navy / Cyber rămân; dark rămâne dark; ink/ivory/snow → white.
  if (!storage.getItem(THEME_MIGRATED_ATELIER_KEY)) {
    write(storage, THEME_MIGRATED_ATELIER_KEY, "1");
    if (next === "aurora" || next === "navy" || next === "cyber" || next === "dark") {
      // păstrează alegerea explicită / nocturnă
    } else {
      next = "white";
      write(storage, THEME_STORAGE_KEY, next);
    }
  }

  // O dată: Atelier Premium — curăță skin-uri locale vechi și asigură Alb pe default.
  if (!storage.getItem(THEME_MIGRATED_PREMIUM_KEY)) {
    write(storage, THEME_MIGRATED_PREMIUM_KEY, "1");
    for (const key of STALE_SKIN_KEYS) {
      clear(storage, key);
    }
    if (next === "aurora" || next === "navy" || next === "cyber" || next === "dark") {
      // păstrează temele premium nocturne
    } else {
      next = "white";
      write(storage, THEME_STORAGE_KEY, next);
      // pe Alb, textura veche poate masca noul look — resetează la plain o dată
      const bg = storage.getItem("buget-familie:background");
      if (bg && bg !== "plain") {
        write(storage, "buget-familie:background", "plain");
      }
    }
  }

  // O dată: UI chrome redesign (fonts/buttons/menus/Obligații).
  if (!storage.getItem(THEME_MIGRATED_UI_CHROME_KEY)) {
    write(storage, THEME_MIGRATED_UI_CHROME_KEY, "1");
    for (const key of STALE_SKIN_KEYS) {
      clear(storage, key);
    }
  }

  return next;
}

export function shouldShowWhatsNew(storage: StorageLike, blocked = false): boolean {
  if (blocked) return false;
  return !storage.getItem(WHATS_NEW_KEY);
}

export function markWhatsNewSeen(storage: StorageLike) {
  write(storage, WHATS_NEW_KEY, "1");
}
