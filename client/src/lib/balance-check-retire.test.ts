/** Utilizator #16: „Cât ai de fapt pe card?” nu mai stă 11 zile pe Astăzi. */
import { describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });

const { readLastBalanceCheck, retireIgnoredBalanceCheck, markBalanceChecked } = await import("./balance-check");

describe("întrebarea de sold ignorată", () => {
  it("se retrage singură după 3 zile pe ecran, ca „Mai târziu”", () => {
    store.clear();
    expect(retireIgnoredBalanceCheck("2026-10-10")).toBe(false);
    expect(retireIgnoredBalanceCheck("2026-10-12")).toBe(false);
    expect(retireIgnoredBalanceCheck("2026-10-13")).toBe(true);
    expect(readLastBalanceCheck()).toBe("2026-10-13");
  });

  it("răspunsul șterge ziua de afișare, iar următoarea întrebare numără de la zero", () => {
    store.clear();
    retireIgnoredBalanceCheck("2026-10-01");
    markBalanceChecked("2026-10-02");
    expect(retireIgnoredBalanceCheck("2026-10-20")).toBe(false);
  });
});
