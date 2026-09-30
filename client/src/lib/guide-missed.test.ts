import { beforeEach, describe, expect, it, vi } from "vitest";
const store = new Map<string, string>();
vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });

import { clearMissed, loadMissed, MISSED_LIMIT, missedAsText, recordMissed } from "./guide-missed";

describe("frazele neînțelese rămân pe telefon", () => {
  beforeEach(() => clearMissed());

  it("se adaugă, fără dubluri, cu cea mai nouă la final", () => {
    recordMissed("am facut 40 la tombola", "2026-09-01T10:00:00Z");
    recordMissed("ceva nou", "2026-09-02T10:00:00Z");
    recordMissed("Am facut 40 la tombola", "2026-09-03T10:00:00Z");
    expect(loadMissed().map((item) => item.text)).toEqual(["ceva nou", "Am facut 40 la tombola"]);
    expect(missedAsText(loadMissed())).toBe("2026-09-03 · Am facut 40 la tombola\n2026-09-02 · ceva nou");
  });

  it("păstrează cel mult ultimele 50", () => {
    for (let index = 0; index < MISSED_LIMIT + 5; index += 1) recordMissed(`fraza ${index}`);
    expect(loadMissed()).toHaveLength(MISSED_LIMIT);
    expect(loadMissed()[0].text).toBe("fraza 5");
  });

  it("golește lista", () => {
    recordMissed("x");
    clearMissed();
    expect(loadMissed()).toEqual([]);
  });
});
