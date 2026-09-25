import { afterEach, describe, expect, it, vi } from "vitest";
import { appLockWaitSeconds, disableAppLock, setAppLockPin, verifyAppLockPin } from "./app-lock";

const store = new Map<string, string>();
vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });

describe("blocarea aplicației", () => {
  afterEach(() => store.clear());
  it("după 5 PIN-uri greșite trebuie așteptat, chiar și cu PIN-ul bun", async () => {
    await setAppLockPin("2468");
    expect(await verifyAppLockPin("2468")).toBe(true);
    for (let i = 0; i < 4; i += 1) expect(await verifyAppLockPin("0000")).toBe(false);
    expect(appLockWaitSeconds()).toBe(0);
    expect(await verifyAppLockPin("0000")).toBe(false);
    expect(appLockWaitSeconds()).toBeGreaterThanOrEqual(29);
    expect(await verifyAppLockPin("2468")).toBe(false);
  });
  it("PIN-ul bun șterge contorul; dezactivarea îl uită", async () => {
    await setAppLockPin("2468");
    await verifyAppLockPin("0000");
    expect(await verifyAppLockPin("2468")).toBe(true);
    expect(store.has("buget-familie:lock-attempts")).toBe(false);
    await verifyAppLockPin("0000");
    disableAppLock();
    expect(store.size).toBe(0);
  });
});
