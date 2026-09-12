import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  LEGACY_THEME_MAP,
  STALE_SKIN_KEYS,
  THEME_MIGRATED_ATELIER_KEY,
  THEME_MIGRATED_CATALOG_KEY,
  THEME_MIGRATED_INK_KEY,
  THEME_MIGRATED_PREMIUM_KEY,
  THEME_STORAGE_KEY,
  WHATS_NEW_KEY,
  markWhatsNewSeen,
  resolveInitialTheme,
  shouldShowWhatsNew,
} from "./theme-default";

const memory = (initial: Record<string, string> = {}) => {
  const store = { ...initial };
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    dump: () => store,
  };
};

describe("catalog teme White/Dark/extras", () => {
  it("fără preferință, pornește pe white și marchează migrările", () => {
    const storage = memory();
    expect(resolveInitialTheme(storage)).toBe("white");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe(DEFAULT_THEME);
    expect(storage.getItem(THEME_MIGRATED_CATALOG_KEY)).toBe("1");
    expect(storage.getItem(THEME_MIGRATED_INK_KEY)).toBe("1");
    expect(storage.getItem(THEME_MIGRATED_ATELIER_KEY)).toBe("1");
    expect(storage.getItem(THEME_MIGRATED_PREMIUM_KEY)).toBe("1");
  });

  it("mapează ID-urile vechi o dată la catalogul slim", () => {
    const cases: Array<[string, string]> = [
      ["ivory", "white"],
      ["snow", "white"],
      ["ink", "white"],
      ["sand", "white"],
      ["sage", "white"],
      ["slate", "white"],
      ["lagoon", "cyber"],
      ["forest", "cyber"],
      ["midnight", "aurora"],
      ["plum", "aurora"],
      ["graphite", "dark"],
      ["copper", "dark"],
      ["rosewood", "dark"],
      ["navy", "navy"],
      ["dark", "dark"],
    ];
    for (const [legacy, kept] of cases) {
      const storage = memory({ [THEME_STORAGE_KEY]: legacy });
      expect(resolveInitialTheme(storage)).toBe(kept);
      expect(storage.getItem(THEME_STORAGE_KEY)).toBe(kept);
      expect(storage.getItem(THEME_MIGRATED_ATELIER_KEY)).toBe("1");
      expect(storage.getItem(THEME_MIGRATED_PREMIUM_KEY)).toBe("1");
    }
  });

  it("după migrare, păstrează temele din catalog", () => {
    for (const kept of ["white", "dark", "aurora", "navy", "cyber"]) {
      const storage = memory({
        [THEME_STORAGE_KEY]: kept,
        [THEME_MIGRATED_CATALOG_KEY]: "1",
        [THEME_MIGRATED_ATELIER_KEY]: "1",
        [THEME_MIGRATED_PREMIUM_KEY]: "1",
      });
      expect(resolveInitialTheme(storage)).toBe(kept);
    }
  });

  it("migrarea Atelier păstrează aurora/navy/cyber și dark", () => {
    for (const kept of ["aurora", "navy", "cyber", "dark"]) {
      const storage = memory({
        [THEME_STORAGE_KEY]: kept,
        [THEME_MIGRATED_CATALOG_KEY]: "1",
      });
      expect(resolveInitialTheme(storage)).toBe(kept);
      expect(storage.getItem(THEME_MIGRATED_ATELIER_KEY)).toBe("1");
      expect(storage.getItem(THEME_MIGRATED_PREMIUM_KEY)).toBe("1");
    }
  });

  it("migrarea Atelier pune white pe look-ul stark vechi", () => {
    const storage = memory({
      [THEME_STORAGE_KEY]: "white",
      [THEME_MIGRATED_CATALOG_KEY]: "1",
    });
    expect(resolveInitialTheme(storage)).toBe("white");
    expect(storage.getItem(THEME_MIGRATED_ATELIER_KEY)).toBe("1");
    expect(storage.getItem(THEME_MIGRATED_PREMIUM_KEY)).toBe("1");
  });

  it("migrarea Premium curăță skin-uri vechi și resetează fundalul pe Alb", () => {
    const storage = memory({
      [THEME_STORAGE_KEY]: "white",
      [THEME_MIGRATED_CATALOG_KEY]: "1",
      [THEME_MIGRATED_ATELIER_KEY]: "1",
      "buget-familie:skin": "stale",
      "buget-familie:skin-tokens": "{}",
      "buget-familie:background": "grid",
    });
    expect(resolveInitialTheme(storage)).toBe("white");
    expect(storage.getItem(THEME_MIGRATED_PREMIUM_KEY)).toBe("1");
    for (const key of STALE_SKIN_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
    expect(storage.getItem("buget-familie:background")).toBe("plain");
  });

  it("migrarea Premium nu atinge aurora și nu resetează fundalul nocturn", () => {
    const storage = memory({
      [THEME_STORAGE_KEY]: "aurora",
      [THEME_MIGRATED_CATALOG_KEY]: "1",
      [THEME_MIGRATED_ATELIER_KEY]: "1",
      "buget-familie:background": "aurora",
      "buget-familie:skin": "stale",
    });
    expect(resolveInitialTheme(storage)).toBe("aurora");
    expect(storage.getItem("buget-familie:background")).toBe("aurora");
    expect(storage.getItem("buget-familie:skin")).toBeNull();
  });

  it("LEGACY_THEME_MAP acoperă laundry-list-ul vechi", () => {
    for (const id of ["snow", "ivory", "ink", "sand", "sage", "slate", "lagoon", "forest", "midnight", "graphite", "copper", "plum", "rosewood"]) {
      expect(LEGACY_THEME_MAP[id]).toBeTruthy();
    }
  });
});

describe("afișul Ce e nou", () => {
  it("apare o dată, apoi dispare după dismiss", () => {
    const storage = memory();
    expect(shouldShowWhatsNew(storage)).toBe(true);
    expect(shouldShowWhatsNew(storage, true)).toBe(false);
    markWhatsNewSeen(storage);
    expect(storage.getItem(WHATS_NEW_KEY)).toBe("1");
    expect(shouldShowWhatsNew(storage)).toBe(false);
  });
});
