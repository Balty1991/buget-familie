import { describe, expect, it, vi } from "vitest";
import {
  HEAVY_LOCAL_STORAGE_KEYS,
  freeHeavyLocalCache,
  isQuotaExceededError,
  safeSetItem,
} from "./safe-storage";
import { writeLocalStorageSnapshot, APP_STORAGE_KEY, APP_STORAGE_META_KEY } from "./app-storage";

const memory = (opts?: { failKeys?: Set<string>; failAlways?: boolean }) => {
  const map = new Map<string, string>();
  const failKeys = opts?.failKeys || new Set<string>();
  return {
    store: map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (opts?.failAlways || failKeys.has(key)) {
        const err = new Error("Setting the value exceeded the quota.");
        err.name = "QuotaExceededError";
        throw err;
      }
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
};

describe("safe-storage", () => {
  it("detectează QuotaExceededError", () => {
    const err = new Error("Failed to execute setItem");
    err.name = "QuotaExceededError";
    expect(isQuotaExceededError(err)).toBe(true);
    expect(isQuotaExceededError(new Error("other"))).toBe(false);
  });

  it("safeSetItem nu aruncă și reîncearcă după freeHeavyLocalCache", () => {
    const storage = memory();
    storage.setItem(HEAVY_LOCAL_STORAGE_KEYS[0], "x".repeat(100));
    let attempts = 0;
    const wrapped = {
      ...storage,
      setItem: (key: string, value: string) => {
        attempts += 1;
        if (attempts === 1 && key === "buget-familie:setup-completed-at") {
          const err = new Error("quota");
          err.name = "QuotaExceededError";
          throw err;
        }
        storage.setItem(key, value);
      },
    };
    expect(safeSetItem(wrapped, "buget-familie:setup-completed-at", "2026-09-12T00:00:00.000Z")).toBe(true);
    expect(wrapped.getItem(HEAVY_LOCAL_STORAGE_KEYS[0])).toBeNull();
    expect(wrapped.getItem("buget-familie:setup-completed-at")).toBe("2026-09-12T00:00:00.000Z");
  });

  it("freeHeavyLocalCache șterge snapshot-urile grele", () => {
    const storage = memory();
    storage.setItem(HEAVY_LOCAL_STORAGE_KEYS[0], "big");
    storage.setItem(HEAVY_LOCAL_STORAGE_KEYS[1], "legacy");
    storage.setItem("buget-familie:theme", "white");
    freeHeavyLocalCache(storage);
    expect(storage.getItem(HEAVY_LOCAL_STORAGE_KEYS[0])).toBeNull();
    expect(storage.getItem(HEAVY_LOCAL_STORAGE_KEYS[1])).toBeNull();
    expect(storage.getItem("buget-familie:theme")).toBe("white");
  });
});

describe("writeLocalStorageSnapshot pe quota", () => {
  it("nu aruncă și marchează wroteFull=false", () => {
    const setItem = vi.fn((key: string, value: string) => {
      if (key === APP_STORAGE_KEY) {
        const err = new Error("Setting the value of app-data exceeded the quota.");
        err.name = "QuotaExceededError";
        throw err;
      }
    });
    const removeItem = vi.fn();
    const getItem = vi.fn(() => null);
    vi.stubGlobal("window", {
      localStorage: { setItem, getItem, removeItem },
    });

    const result = writeLocalStorageSnapshot(JSON.stringify({ version: 9 }), "2026-09-12T12:00:00.000Z");
    expect(result.wroteFull).toBe(false);
    expect(result.quotaExceeded).toBe(true);
    expect(result.meta.savedAt).toBe("2026-09-12T12:00:00.000Z");
    // meta sau free heavy keys au fost încercate
    expect(removeItem).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
