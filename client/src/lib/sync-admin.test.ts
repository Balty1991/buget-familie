import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData } from "./finance-data";
import { mergeFamilyData } from "./family-crypto";
import { claimSyncAdmin, isSyncAdmin } from "./sync-devices";

describe("administratorul camerei", () => {
  it("fără administrator, oricine e; după alegere, doar el", () => {
    const data = createEmptyAppData();
    expect(isSyncAdmin(data)).toBe(true);
    expect(isSyncAdmin(claimSyncAdmin(data, "alt-telefon"))).toBe(false);
  });

  it("la unire câștigă alegerea mai nouă și trece prin normalizare", () => {
    const base = createEmptyAppData();
    const older = { ...base, settings: { ...base.settings, syncAdminDeviceId: "a", syncAdminSetAt: "2026-10-01T10:00:00.000Z" } };
    const newer = { ...base, settings: { ...base.settings, syncAdminDeviceId: "b", syncAdminSetAt: "2026-10-02T10:00:00.000Z" } };
    expect(mergeFamilyData(older, newer).settings.syncAdminDeviceId).toBe("b");
    expect(mergeFamilyData(newer, older).settings.syncAdminDeviceId).toBe("b");
    expect(normalizeAppData(newer).settings.syncAdminDeviceId).toBe("b");
  });
});
