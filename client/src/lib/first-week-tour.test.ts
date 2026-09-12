import { describe, expect, it } from "vitest";
import {
  FIRST_WEEK_TIPS,
  markFirstWeekTourSeen,
  markSetupCompletedAt,
  shouldShowFirstWeekTour,
} from "./first-week-tour";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
};

describe("turul primei săptămâni", () => {
  it("nu apare fără setup-complete", () => {
    const storage = memory();
    expect(shouldShowFirstWeekTour(storage)).toBe(false);
  });

  it("apare după setup, o singură dată în fereastra de 7 zile", () => {
    const storage = memory();
    storage.setItem("buget-familie:setup-complete", "true");
    expect(shouldShowFirstWeekTour(storage)).toBe(true);
    markFirstWeekTourSeen(storage);
    expect(shouldShowFirstWeekTour(storage)).toBe(false);
  });

  it("respectă blocked (FirstRunSetup / onboarding)", () => {
    const storage = memory();
    storage.setItem("buget-familie:setup-complete", "true");
    markSetupCompletedAt(storage);
    expect(shouldShowFirstWeekTour(storage, true)).toBe(false);
  });

  it("expiră după o săptămână", () => {
    const storage = memory();
    storage.setItem("buget-familie:setup-complete", "true");
    markSetupCompletedAt(storage, new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString());
    expect(shouldShowFirstWeekTour(storage)).toBe(false);
  });

  it("are cele trei tipuri: captură, plicuri, sync", () => {
    expect(FIRST_WEEK_TIPS.map((tip) => tip.id)).toEqual(["capture", "envelopes", "sync"]);
  });

  it("markSetupCompletedAt nu aruncă la QuotaExceededError", () => {
    const map = new Map<string, string>();
    let blocked = true;
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (blocked && key === "buget-familie:setup-completed-at") {
          const err = new Error("Setting the value of 'buget-familie:setup-completed-at' exceeded the quota.");
          err.name = "QuotaExceededError";
          throw err;
        }
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
        if (key.startsWith("buget-familie:app-data")) blocked = false;
      },
    };
    storage.setItem("buget-familie:setup-complete", "true");
    storage.setItem("buget-familie:app-data-v6", "huge");
    expect(() => markSetupCompletedAt(storage)).not.toThrow();
    expect(storage.getItem("buget-familie:setup-completed-at")).toMatch(/^20/);
    expect(storage.getItem("buget-familie:app-data-v6")).toBeNull();
  });
});
