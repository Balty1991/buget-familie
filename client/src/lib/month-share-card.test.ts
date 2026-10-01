import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-storage", () => ({ isNativeApp: () => false }));

import type { MonthlyFamilyReport } from "./household-insights";
import { monthCardHeadline, monthCardSlices } from "./month-share-card";

const report = (patch: Partial<MonthlyFamilyReport> = {}): MonthlyFamilyReport => ({
  month: "2026-09",
  title: "septembrie 2026",
  priorTitle: "august 2026",
  familyName: "Familia Pop",
  income: 6000,
  expense: 4500,
  cashflow: 1500,
  priorExpense: 0,
  keptShare: 0.25,
  categories: [
    { name: "Alimente", amount: 1800, prior: 0, delta: 0 },
    { name: "Casă & facturi", amount: 1200, prior: 0, delta: 0 },
    { name: "Transport", amount: 600, prior: 0, delta: 0 },
    { name: "Copii", amount: 400, prior: 0, delta: 0 },
    { name: "Sănătate", amount: 300, prior: 0, delta: 0 },
  ],
  members: [],
  subscriptions: { monthly: 0, yearly: 0, count: 0, rises: [] },
  nextStep: "",
  empty: false,
  ...patch,
});

describe("imaginea lunii", () => {
  it("are cel mult cinci felii, iar restul intră în Altele", () => {
    const slices = monthCardSlices(report());
    expect(slices.map((slice) => slice.name)).toEqual(["Alimente", "Casă & facturi", "Transport", "Copii", "Altele"]);
    expect(slices.at(-1)?.amount).toBe(500);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 5);
  });

  it("fără cheltuieli nu desenează felii", () => {
    expect(monthCardSlices(report({ categories: [], expense: 0 }))).toEqual([]);
  });

  it("fără sume arată doar procentul păstrat, nu lei", () => {
    const head = monthCardHeadline(report(), false);
    expect(head.value).toBe("25%");
    expect(`${head.value} ${head.note}`).not.toMatch(/RON|lei/i);
  });

  it("cu sume arată cât a rămas", () => {
    expect(monthCardHeadline(report(), true).value).toMatch(/1\.500/);
  });

  it("o lună pe minus nu își arată suma fără acord", () => {
    const head = monthCardHeadline(report({ cashflow: -300, keptShare: 0 }), false);
    expect(head.value).not.toMatch(/\d/);
  });
});
