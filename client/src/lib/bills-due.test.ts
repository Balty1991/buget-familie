import { describe, expect, it } from "vitest";
import { billsDueEnvelopes } from "./bills-due";
import { createEmptyAppData, isFixedEnvelope } from "./finance-data";
import { todayBrief } from "./household-insights";

describe("facturile de până la salariu", () => {
  it("umple plicurile în ordine și se oprește când se termină banii scriși", () => {
    const full = billsDueEnvelopes(
      [{ label: "Chirie", category: "Casă & facturi", amount: 1800 }, { label: "Lumină", category: "Casă & facturi", amount: 200 }],
      "card",
      3000,
      "2026-09-28T12:00:00.000Z",
    );
    expect(full.map((item) => [item.label, item.amount, item.weeklyPace])).toEqual([["Chirie", 1800, false], ["Lumină", 200, false]]);
    const short = billsDueEnvelopes(
      [{ label: "Chirie", category: "Casă & facturi", amount: 1800 }, { label: "Lumină", category: "Casă & facturi", amount: 200 }],
      "card",
      1900,
    );
    expect(short.map((item) => [item.label, item.amount])).toEqual([["Chirie", 1800], ["Lumină", 100]]);
  });

  it("plicul fix nu intră în cifra zilei, iar textul spune pentru ce a fost lăsat", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = data.settings.paymentSources.map((source) => source.id === "source-debit" ? { ...source, openingBalance: 3000 } : source);
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: "2026-09-28",
      nextPayday: "2026-10-10",
      paydayFlexDays: 0,
      sourceIds: ["source-debit"],
      allocations: billsDueEnvelopes([{ label: "Chirie", category: "Casă & facturi", amount: 1800 }], "source-debit", 3000),
    };
    expect(isFixedEnvelope(data.settings.salaryPlan, data.settings.salaryPlan.allocations[0])).toBe(true);
    const brief = todayBrief(data, "2026-09-28");
    const open = todayBrief({ ...data, settings: { ...data.settings, salaryPlan: { ...data.settings.salaryPlan, allocations: [] } } }, "2026-09-28");
    expect(brief.spendable).toBeLessThan(open.spendable - 50);
    expect(brief.reason).toContain("Chirie");
    expect(brief.reason).toMatch(/deoparte|stau deoparte/);
  });
});
