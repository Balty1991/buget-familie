import { beforeEach, describe, expect, it } from "vitest";
import { AUTO_BACKUP_KEY, readAutoBackup, writeAutoBackup } from "./auto-backup";

describe("salvarea automată la fiecare modificare", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      window: Object.assign(globalThis.window || {}, {
        localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
        dispatchEvent: () => true,
      }),
      CustomEvent: globalThis.CustomEvent || class { constructor(public type: string, public init?: unknown) {} },
    });
  });

  it("e oprită până o pornește omul, și ține minte ultima salvare", () => {
    expect(readAutoBackup().live).toBe(false);
    writeAutoBackup({ live: true });
    writeAutoBackup({ liveAt: "2026-10-07T10:00:00.000Z", livePath: "Documents/Buget Familie/buget-familie-automat.json" });
    const prefs = readAutoBackup();
    expect(prefs.live).toBe(true);
    expect(prefs.livePath).toContain("Buget Familie");
    expect(JSON.parse(window.localStorage.getItem(AUTO_BACKUP_KEY) || "{}").live).toBe(true);
  });
});
