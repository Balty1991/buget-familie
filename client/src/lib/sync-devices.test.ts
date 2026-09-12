
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { getOrCreateDeviceId, listActiveSyncDevices, revokeSyncDevice, touchSyncDevice } from "./sync-devices";

describe("dispozitive de sync", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
    });
    vi.stubGlobal("navigator", { userAgent: "Android" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("înregistrează și revocă un telefon", () => {
    const id = getOrCreateDeviceId();
    let data = touchSyncDevice(createEmptyAppData(), "Android test");
    expect(listActiveSyncDevices(data)).toHaveLength(1);
    expect(listActiveSyncDevices(data)[0].id).toBe(id);
    data = revokeSyncDevice(data, id);
    expect(listActiveSyncDevices(data)).toHaveLength(0);
  });
});
