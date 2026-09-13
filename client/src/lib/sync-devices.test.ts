
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createEmptyAppData } from "./finance-data";
import {
  getOrCreateDeviceId,
  isThisDeviceRevoked,
  listActiveSyncDevices,
  listSyncDevices,
  restoreSyncDevice,
  revokeSyncDevice,
  touchSyncDevice,
} from "./sync-devices";

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
    expect(isThisDeviceRevoked(data)).toBe(true);
  });

  it("reconectarea nu șterge revocarea", () => {
    let data = touchSyncDevice(createEmptyAppData(), "Android test");
    const id = getOrCreateDeviceId();
    data = revokeSyncDevice(data, id);
    data = touchSyncDevice(data, "Android test");
    expect(isThisDeviceRevoked(data)).toBe(true);
    expect(listActiveSyncDevices(data)).toHaveLength(0);
    expect(listSyncDevices(data)).toHaveLength(1);
  });

  it("reactivarea scoate revocarea", () => {
    let data = touchSyncDevice(createEmptyAppData(), "Android test");
    const id = getOrCreateDeviceId();
    data = revokeSyncDevice(data, id);
    data = restoreSyncDevice(data, id);
    expect(isThisDeviceRevoked(data)).toBe(false);
    expect(listActiveSyncDevices(data)).toHaveLength(1);
  });
});
