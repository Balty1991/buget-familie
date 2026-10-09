import { describe, expect, it } from "vitest";
import { allocationWeeksStatus, createEmptyAppData, envelopeDayAmount, normalizeAppData, type AppData, type Transaction } from "./finance-data";

/** Plicul de alimente al lui Alin: 600 pe săptămână întreagă, din 9 oct până pe 9 nov. */
const family = (spread?: number): AppData => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-09", nextPayday: "2026-11-09", earliestPayday: undefined, paydayFlexDays: 0,
    allocations: [{ id: "food", label: "Alimente", amount: 2744, category: "Alimente", sourceId: "source-debit", weeklyAmount: 600 }] };
  const bon: Transaction = { id: "mega", title: "Cumpărături Mega Image", amount: 165.5, kind: "expense", category: "Alimente", source: "Card", person: "Eu", date: "2026-10-09", sourceId: "source-debit", allocationId: "food", ...(spread ? { spreadAmount: spread } : {}) };
  data.transactions = [bon];
  return data;
};

describe("cumpărătura pentru toată luna (bonul Mega Image, 9 oct)", () => {
  it("fără bifă, tot bonul golește prima săptămână", () => {
    const data = family();
    const weeks = allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]);
    expect(weeks[0].spent).toBeCloseTo(165.5, 2);
  });

  it("detergentul și hrana pisicii (134,58) se împart pe toate săptămânile; restul rămâne în prima", () => {
    const data = family(134.58);
    const allocation = data.settings.salaryPlan.allocations[0];
    const weeks = allocationWeeksStatus(data, allocation);
    const share = 134.58 / weeks.length;
    expect(weeks[0].spent).toBeCloseTo(30.92 + share, 2);
    for (const week of weeks.slice(1)) expect(week.spent).toBeCloseTo(share, 2);
    // Totalul plicului nu se schimbă: tot bonul e cheltuit din Alimente.
    expect(weeks.reduce((sum, week) => sum + week.spent, 0)).toBeCloseTo(165.5, 2);
    expect(envelopeDayAmount(data, data.transactions[0], allocation)).toBeCloseTo(30.92 + share, 2);
  });

  it("se păstrează la salvare și sincronizare, cel mult cât cheltuiala", () => {
    const data = family(134.58);
    const again = normalizeAppData(JSON.parse(JSON.stringify(data)));
    expect(again.transactions[0].spreadAmount).toBe(134.58);
  });
});
