import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasActiveFamilie, OFFLINE_GRACE_DAYS, readEntitlements, saveEntitlement } from "./billing-store";
import { currentPlan } from "./entitlements";

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal("window", {
    localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value), removeItem: (key: string) => void memory.delete(key) },
    dispatchEvent: () => true,
  });
  vi.stubGlobal("CustomEvent", class { constructor(public type: string) {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("dreptul la Familia", () => {
  it("un abonament verificat și neexpirat dă Familia", () => {
    const now = Date.parse("2026-09-24T10:00:00Z");
    saveEntitlement("play", { productId: "familie_lunar", expiresAt: "2026-10-24T10:00:00Z", verifiedAt: "2026-09-24T10:00:00Z" });
    expect(hasActiveFamilie(now)).toBe(true);
  });

  it("fără internet câteva zile după expirare, Familia rămâne; după grație, nu", () => {
    saveEntitlement("room", { roomId: "a".repeat(64), expiresAt: "2026-09-20T10:00:00Z", verifiedAt: "2026-09-19T10:00:00Z" });
    expect(hasActiveFamilie(Date.parse("2026-09-22T10:00:00Z"))).toBe(true);
    expect(hasActiveFamilie(Date.parse("2026-09-20T10:00:00Z") + (OFFLINE_GRACE_DAYS + 1) * 86_400_000)).toBe(false);
  });

  it("anularea verificată scoate doar sursa ei", () => {
    saveEntitlement("play", { expiresAt: "2030-01-01T00:00:00Z", verifiedAt: "2026-09-24T00:00:00Z" });
    saveEntitlement("room", { roomId: "b".repeat(64), expiresAt: "2030-01-01T00:00:00Z", verifiedAt: "2026-09-24T00:00:00Z" });
    saveEntitlement("play", undefined);
    expect(readEntitlements().map((item) => item.source)).toEqual(["room"]);
  });

  it("cât timp plățile nu sunt pornite, toată lumea are Familia", () => {
    expect(currentPlan()).toBe("familie");
  });
});
