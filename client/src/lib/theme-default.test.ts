import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  LEGACY_THEME_MAP,
  STALE_SKIN_KEYS,
  THEME_MIGRATED_ATELIER_KEY,
  THEME_MIGRATED_CATALOG_KEY,
  THEME_MIGRATED_INK_KEY,
  THEME_MIGRATED_PREMIUM_KEY,
  THEME_MIGRATED_UI_CHROME_KEY,
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
    expect(storage.getItem(THEME_MIGRATED_UI_CHROME_KEY)).toBe("1");
  });

  it("mapează ID-urile vechi o dată la catalogul slim", () => {
    const cases: Array<[string, string]> = [
      ["ivory", "white"],
      ["snow", "white"],
      ["ink", "white"],
      ["sand", "white"],
      ["sage", "white"],
      ["slate", "white"],
      ["lagoon", "dark"],
      ["forest", "dark"],
      ["midnight", "navy"],
      ["plum", "navy"],
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
    for (const kept of ["white", "dark", "navy"]) {
      const storage = memory({
        [THEME_STORAGE_KEY]: kept,
        [THEME_MIGRATED_CATALOG_KEY]: "1",
        [THEME_MIGRATED_ATELIER_KEY]: "1",
        [THEME_MIGRATED_PREMIUM_KEY]: "1",
      });
      expect(resolveInitialTheme(storage)).toBe(kept);
    }
  });

  it("Aurora și Cyber, scoase din alegere, trec pe Navy și Întunecat", () => {
    const base = { [THEME_MIGRATED_CATALOG_KEY]: "1", [THEME_MIGRATED_ATELIER_KEY]: "1", [THEME_MIGRATED_PREMIUM_KEY]: "1" };
    expect(resolveInitialTheme(memory({ ...base, [THEME_STORAGE_KEY]: "aurora" }))).toBe("navy");
    expect(resolveInitialTheme(memory({ ...base, [THEME_STORAGE_KEY]: "cyber" }))).toBe("dark");
  });

  it("migrarea Atelier păstrează navy și dark", () => {
    for (const kept of ["navy", "dark"]) {
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
    expect(resolveInitialTheme(storage)).toBe("navy");
    expect(storage.getItem("buget-familie:background")).toBe("aurora");
    expect(storage.getItem("buget-familie:skin")).toBeNull();
  });


  it("migrarea UI chrome marchează flag-ul și curăță skin-uri vechi", () => {
    const storage = memory({
      [THEME_STORAGE_KEY]: "white",
      [THEME_MIGRATED_CATALOG_KEY]: "1",
      [THEME_MIGRATED_ATELIER_KEY]: "1",
      [THEME_MIGRATED_PREMIUM_KEY]: "1",
      "buget-familie:skin": "stale",
    });
    expect(resolveInitialTheme(storage)).toBe("white");
    expect(storage.getItem(THEME_MIGRATED_UI_CHROME_KEY)).toBe("1");
    expect(storage.getItem("buget-familie:skin")).toBeNull();
  });

  it("LEGACY_THEME_MAP acoperă laundry-list-ul vechi", () => {
    for (const id of ["snow", "ivory", "ink", "sand", "sage", "slate", "lagoon", "forest", "midnight", "graphite", "copper", "plum", "rosewood"]) {
      expect(LEGACY_THEME_MAP[id]).toBeTruthy();
    }
  });
});

describe("afișul Ce e nou", () => {
  it("nu apare la instalare goală și dispare după dismiss", () => {
    const fresh = memory();
    expect(shouldShowWhatsNew(fresh)).toBe(false);
    const storage = memory();
    storage.setItem("buget-familie:setup-complete", "true");
    expect(shouldShowWhatsNew(storage)).toBe(true);
    expect(shouldShowWhatsNew(storage, true)).toBe(false);
    markWhatsNewSeen(storage);
    expect(storage.getItem(WHATS_NEW_KEY)).toBe("1");
    expect(shouldShowWhatsNew(storage)).toBe(false);
  });
});
