import { afterEach, describe, expect, it, vi } from "vitest";
import { addIsoDays, allocationWeeksStatus, commitLedgerEntry, type AppData } from "./finance-data";
import { applyWeekClose, weekCloseDue, weekToClose } from "./week-close";
import { CARD, FOOD, ME, PAYDAY, PERIOD_START, familyAtPayday, liveOneDay, seeded } from "./__fixtures__/family-month";
import { atNoon, checkInvariants } from "./__fixtures__/invariants";

afterEach(() => { vi.useRealTimers(); });

const food = (data: AppData) => allocationWeeksStatus(data, data.settings.salaryPlan.allocations.find((item) => item.id === FOOD)!);
const spend = (data: AppData, day: string, amount: number) =>
  commitLedgerEntry(data, { id: `shop-${day}-${amount}`, title: "Magazin", amount, kind: "expense", category: "Alimente", sourceId: CARD, source: "Card Ion", memberId: ME, person: "Ion", date: day, allocationId: FOOD });

/** Vineri 9 oct – duminică 11 oct este S1; luni 12 se închide. */
const firstWeekend = (amount: number) => {
  let data = familyAtPayday();
  atNoon("2026-10-10");
  data = spend(data, "2026-10-10", amount);
  return data;
};

describe("închiderea săptămânii", () => {
  it("se propune luni pentru săptămâna de ieri și duminică doar seara", () => {
    const data = firstWeekend(100);
    atNoon("2026-10-12");
    const close = weekToClose(data, "2026-10-12")!;
    expect(close).toMatchObject({ start: PERIOD_START, end: "2026-10-11" });
    expect(close.envelopes[0]).toMatchObject({ allocationId: FOOD, weekIndex: 1, nextIndex: 2, spent: 100 });
    atNoon("2026-10-11");
    expect(weekToClose(data, "2026-10-11")).toBeUndefined();
    expect(weekToClose(data, "2026-10-11", true)?.end).toBe("2026-10-11");
    atNoon("2026-10-13");
    expect(weekToClose(data, "2026-10-13")).toBeUndefined();
  });

  it("restul trece în săptămâna următoare; plicul rămâne la fel", () => {
    const data = firstWeekend(100);
    atNoon("2026-10-12");
    const close = weekToClose(data, "2026-10-12")!;
    const left = close.envelopes[0].remaining;
    expect(left).toBeGreaterThan(0);
    const before = food(data);
    const after = food(applyWeekClose(data, close, {}));
    expect(after[0].remaining).toBeCloseTo(0, 2);
    expect(after[1].budget).toBeCloseTo(before[1].budget + left, 2);
    expect(after.reduce((sum, week) => sum + week.budget, 0)).toBeCloseTo(before.reduce((sum, week) => sum + week.budget, 0), 2);
  });

  it("depășirea se acoperă din săptămâna următoare", () => {
    const data = firstWeekend(400);
    atNoon("2026-10-12");
    const close = weekToClose(data, "2026-10-12")!;
    const over = -close.envelopes[0].remaining;
    expect(over).toBeGreaterThan(0);
    const after = food(applyWeekClose(data, close, {}));
    expect(after[0].remaining).toBeCloseTo(0, 2);
    expect(after[1].budget).toBeCloseTo(food(data)[1].budget - over, 2);
  });

  it("„Lasă așa” nu schimbă nimic", () => {
    const data = firstWeekend(100);
    atNoon("2026-10-12");
    const close = weekToClose(data, "2026-10-12")!;
    expect(applyWeekClose(data, close, { [FOOD]: "keep" })).toBe(data);
  });

  it("cu reportul automat pornit nu mai întreabă; după închidere nici", () => {
    const data = firstWeekend(100);
    atNoon("2026-10-12");
    expect(weekCloseDue(data, "2026-10-12", false, "")).toBe(true);
    expect(weekCloseDue(data, "2026-10-12", false, "2026-10-11")).toBe(false);
    const carry = { ...data, settings: { ...data.settings, salaryPlan: { ...data.settings.salaryPlan, weekCarryOver: true } } };
    expect(weekCloseDue(carry, "2026-10-12", false, "")).toBe(false);
  });

  it("o lună cu închiderea în fiecare luni respectă toate regulile", () => {
    const random = seeded(31);
    let data = familyAtPayday();
    let closed = 0;
    for (let day = PERIOD_START; day < PAYDAY; day = addIsoDays(day, 1)) {
      atNoon(day);
      const close = weekToClose(data, day);
      if (close) { data = applyWeekClose(data, close, {}); closed += 1; }
      data = liveOneDay(data, day, random);
      checkInvariants(data, day);
    }
    expect(closed).toBe(4);
  });
});
