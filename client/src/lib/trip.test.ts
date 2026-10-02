import { describe, expect, it } from "vitest";
import { normalizeAppData, createEmptyAppData, type Transaction } from "./finance-data";
import { activeTrip, mergeTrip, normalizeTrip, tripStats, type Trip } from "./trip";

const trip: Trip = { id: "trip-1", name: "Mare", budget: 3000, start: "2026-08-01", end: "2026-08-07", currency: "EUR", updatedAt: "2026-07-20T10:00:00.000Z" };
const spend = (id: string, date: string, amount: number, category = "Alimente", tripId = "trip-1") => ({ id, date, amount, category, title: id, kind: "expense", ...(tripId ? { tripId } : {}) }) as Transaction;

describe("modul vacanță", () => {
  it("curăță ce vine din stocare", () => {
    expect(normalizeTrip(trip)).toEqual(trip);
    expect(normalizeTrip({ ...trip, end: "2026-07-01" })).toBeUndefined();
    expect(normalizeTrip({ ...trip, name: " " })).toBeUndefined();
    expect(normalizeTrip({ ...trip, currency: "RON" })?.currency).toBeUndefined();
    expect(normalizeTrip(null)).toBeUndefined();
  });

  it("supraviețuiește încărcării datelor și se unește după ultima modificare", () => {
    const data = createEmptyAppData();
    data.settings.trip = trip;
    expect(normalizeAppData(JSON.parse(JSON.stringify(data))).settings.trip).toEqual(trip);
    const closed = { ...trip, closedAt: "2026-08-05T10:00:00.000Z", updatedAt: "2026-08-05T10:00:00.000Z" };
    expect(mergeTrip(trip, closed)).toBe(closed);
    expect(mergeTrip(closed, trip)).toBe(closed);
    expect(mergeTrip(undefined, trip)).toBe(trip);
  });

  it("e activă doar între zile și până e încheiată", () => {
    const data = createEmptyAppData();
    data.settings.trip = trip;
    expect(activeTrip(data, "2026-07-31")).toBeUndefined();
    expect(activeTrip(data, "2026-08-03")?.id).toBe("trip-1");
    data.settings.trip = { ...trip, closedAt: "2026-08-03T10:00:00.000Z" };
    expect(activeTrip(data, "2026-08-03")).toBeUndefined();
  });

  it("socotește cât s-a cheltuit, cât mai e pe zi și pe ce", () => {
    const data = createEmptyAppData();
    data.transactions = [spend("a", "2026-08-01", 400), spend("b", "2026-08-02", 200, "Timp liber"), spend("c", "2026-08-02", 999, "Alimente", "")];
    const mid = tripStats(data, trip, "2026-08-03");
    expect(mid).toMatchObject({ spent: 600, left: 2400, days: 7, dayIndex: 3, daysLeft: 5, perDayLeft: 480, perDaySpent: 200, done: false });
    expect(mid.byCategory).toEqual([{ category: "Alimente", amount: 400 }, { category: "Timp liber", amount: 200 }]);
    const after = tripStats(data, trip, "2026-08-10");
    expect(after).toMatchObject({ done: true, daysLeft: 0, perDayLeft: 0, perDaySpent: Math.round((600 / 7) * 100) / 100 });
    expect(tripStats(data, trip, "2026-07-30")).toMatchObject({ dayIndex: 0, daysLeft: 7 });
  });
});
