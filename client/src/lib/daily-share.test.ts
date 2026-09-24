/**
 * Testarea cu utilizatori, M2 și M3: cifra zilei urmează o singură regulă, iar după
 * cumpărăturile săptămânii textul nu mai spune „0 pe zi” când plicul mai are bani.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { todayBrief } from "./household-insights";
import { buildTodaySummary } from "./today-summary";

const ASOF = "2026-09-24";

const spend = (amount: number, category = "Alimente", date = ASOF): Transaction => ({ id: `tx-${amount}-${date}`, title: "Cumpărături", amount, kind: "expense", category, sourceId: "source-debit", source: "Card debit", memberId: "member-me", person: "Eu", date });

/** Andrei: 2.500 pe card, salariul pe 05.10, fără plicuri. */
const noEnvelopes = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 2500 : 0 }));
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: ASOF, nextPayday: "2026-10-05", paydayFlexDays: 0 };
  return data;
};

describe("o singură regulă pentru cifra zilei (M3)", () => {
  it("fără plicuri, cheltuiala de azi scade din partea de azi leu cu leu", () => {
    const before = todayBrief(noEnvelopes(), ASOF).spendable;
    expect(before).toBeCloseTo(2500 / 12, 2);
    const data = noEnvelopes();
    data.transactions = [spend(55.5)];
    // Înainte: 2.444,50 / 12 = 203,71 — cheltuiala abia se vedea.
    expect(todayBrief(data, ASOF).spendable).toBeCloseTo(before - 55.5, 2);
  });

  it("peste partea zilei, azi arată 0 și spune cât rămâne de mâine", () => {
    const data = noEnvelopes();
    data.transactions = [spend(400)];
    const brief = todayBrief(data, ASOF);
    expect(brief.spendable).toBe(0);
    expect(brief.reason).toContain("De mâine");
    expect(brief.reason).toContain("190,91"); // 2.100 / 11 zile
  });

  it("mâine, ce a rămas se reîmparte pe zilele rămase", () => {
    const data = noEnvelopes();
    data.transactions = [spend(400)];
    expect(todayBrief(data, "2026-09-25").spendable).toBeCloseTo(2100 / 11, 2);
  });
});

describe("după cumpărăturile săptămânii (M2)", () => {
  it("nu mai spune „0 pe zi” când plicul săptămânii mai are bani", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 3000 : 0 }));
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: ASOF,
      nextPayday: "2026-10-22",
      paydayFlexDays: 0,
      sourceIds: ["source-debit"],
      allocations: [{ id: "food", label: "Alimente", amount: 2470.6, category: "Alimente", weeklyPace: true }],
    };
    data.transactions = [spend(187.45)];
    const summary = buildTodaySummary(data, ASOF);
    expect(summary.heroTracksWeek).toBe(true);
    expect(summary.brief.spendable).toBe(0);
    expect(summary.heroHint).toMatch(/^Azi ai folosit partea zilei\. De mâine: /);
    expect(summary.heroHint).not.toMatch(/\b0 lei\/zi/);
    expect(summary.rhythmNote).not.toMatch(/cam 0 pe zi/);
    const future = summary.rhythm.days.find((row) => row.isFuture);
    expect(future?.left).toBeCloseTo(summary.rhythm.futureShare, 2);
    expect(summary.rhythm.futureShare).toBeGreaterThan(0);
  });
});

describe("planul de familie nu pornește „în roșu” (M1)", () => {
  it("cu plicuri, dar fără bani scriși încă, cere banii de azi în loc de „peste limită”", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: ASOF,
      nextPayday: "2026-10-05",
      allocations: [{ id: "food", label: "Alimente", amount: 1500, category: "Alimente", weeklyPace: true }, { id: "home", label: "Casă & facturi", amount: 800, category: "Casă & facturi" }],
    };
    const summary = buildTodaySummary(data, ASOF);
    expect(summary.overPlan).toBe(false);
    expect(summary.heroLabel).toBe("Pune banii de azi");
    expect(summary.heroValue).toBe(0);
    expect(summary.rhythmNote).not.toMatch(/pe zi până/);
  });

  it("după ce există bani, depășirea reală se arată în continuare", () => {
    const data = noEnvelopes();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, allocations: [{ id: "food", label: "Alimente", amount: 3000, category: "Alimente" }] };
    expect(buildTodaySummary(data, ASOF).overPlan).toBe(true);
  });
});
