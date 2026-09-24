/**
 * Testarea cu utilizatori, #10: telefoanele din aceeași familie au aceeași zi „azi”,
 * chiar dacă unul e setat pe alt fus orar.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyAppData, isoDateInZone, isoToday, normalizeAppData, setFamilyTimeZone } from "./finance-data";
import { mergeFamilyData } from "./family-crypto";

afterEach(() => setFamilyTimeZone(undefined));

describe("ziua familiei într-un singur fus orar", () => {
  it("același moment e altă zi la București și la New York, iar familia o alege pe a ei", () => {
    const moment = new Date("2026-09-24T02:30:00Z"); // 05:30 la București, 22:30 (23 sept.) la New York
    expect(isoDateInZone(moment, "Europe/Bucharest")).toBe("2026-09-24");
    expect(isoDateInZone(moment, "America/New_York")).toBe("2026-09-23");
  });

  it("isoToday urmează fusul familiei când e setat", () => {
    setFamilyTimeZone("Pacific/Kiritimati"); // UTC+14
    const kiritimati = isoToday();
    setFamilyTimeZone("Pacific/Pago_Pago"); // UTC−11
    const pagoPago = isoToday();
    expect(kiritimati).not.toBe(pagoPago);
  });

  it("un fus greșit e ignorat, nu strică ziua", () => {
    setFamilyTimeZone("Marte/Olympus");
    expect(isoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normalizeAppData({ settings: { familyTimeZone: "Marte/Olympus" } }).settings.familyTimeZone).toBeUndefined();
  });

  it("un telefon nou preia fusul camerei, iar o alegere de mână mai nouă câștigă", () => {
    const room = createEmptyAppData();
    room.settings.familyTimeZone = "Europe/Bucharest";
    const abroad = createEmptyAppData();
    abroad.settings.familyTimeZone = "America/New_York";
    expect(mergeFamilyData(abroad, room).settings.familyTimeZone).toBe("Europe/Bucharest");
    abroad.settings.familyTimeZoneSetAt = "2026-09-24T10:00:00.000Z";
    expect(mergeFamilyData(abroad, room).settings.familyTimeZone).toBe("America/New_York");
    expect(mergeFamilyData(room, abroad).settings.familyTimeZone).toBe("America/New_York");
  });
});
