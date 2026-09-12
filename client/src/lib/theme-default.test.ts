import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_MIGRATED_INK_KEY,
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
    dump: () => store,
  };
};

describe("tema implicită Ink Studio", () => {
  it("fără preferință salvatǎ, pornește pe ink și marchează migrarea", () => {
    const storage = memory();
    expect(resolveInitialTheme(storage)).toBe("ink");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe(DEFAULT_THEME);
    expect(storage.getItem(THEME_MIGRATED_INK_KEY)).toBe("1");
  });

  it("migrarea o dată: ivory și snow devin ink", () => {
    for (const legacy of ["ivory", "snow"]) {
      const storage = memory({ [THEME_STORAGE_KEY]: legacy });
      expect(resolveInitialTheme(storage)).toBe("ink");
      expect(storage.getItem(THEME_STORAGE_KEY)).toBe("ink");
    }
  });

  it("păstrează forest, midnight și celelalte alegeri explicite", () => {
    for (const kept of ["forest", "midnight", "navy", "sand", "graphite"]) {
      const storage = memory({ [THEME_STORAGE_KEY]: kept });
      expect(resolveInitialTheme(storage)).toBe(kept);
      expect(storage.getItem(THEME_STORAGE_KEY)).toBe(kept);
      expect(storage.getItem(THEME_MIGRATED_INK_KEY)).toBe("1");
    }
  });

  it("după migrare, ivory ales explicit rămâne ivory", () => {
    const storage = memory({
      [THEME_STORAGE_KEY]: "ivory",
      [THEME_MIGRATED_INK_KEY]: "1",
    });
    expect(resolveInitialTheme(storage)).toBe("ivory");
  });

  it("dark vechi devine forest", () => {
    const storage = memory({ [THEME_STORAGE_KEY]: "dark", [THEME_MIGRATED_INK_KEY]: "1" });
    expect(resolveInitialTheme(storage)).toBe("forest");
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
