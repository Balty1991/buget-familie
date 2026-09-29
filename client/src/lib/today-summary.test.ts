import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { dayStripFigure, todayBrief } from "./household-insights";
import { buildTodaySummary } from "./today-summary";

describe("rezumatul de azi", () => {
  it("fără salariu arată soldul, nu un ritm pe zile", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = data.settings.paymentSources.map((source) => source.id === "source-cash" ? { ...source, openingBalance: 1200 } : source);
    const summary = buildTodaySummary(data, "2026-09-23");
    expect(summary.heroTracksWeek).toBe(false);
    expect(summary.heroLabel).toBe("Ai acum");
    expect(summary.heroValue).toBe(1200);
    expect(summary.todayStrip).toBe(summary.rhythm.days.find((row) => row.isToday)?.left);
  });

  it("cu ritm săptămânal, cardul și căsuța de azi pleacă din aceeași limită", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: "2026-09-07",
      nextPayday: "2026-10-04",
      sourceIds: ["source-cash"],
      allocations: [{ id: "food", label: "Alimente", amount: 2400, category: "Alimente", weeklyPace: true }],
    };
    data.settings.paymentSources = data.settings.paymentSources.map((source) => source.id === "source-cash" ? { ...source, openingBalance: 2400 } : source);
    const summary = buildTodaySummary(data, "2026-09-07");
    const today = summary.rhythm.days.find((row) => row.isToday);
    expect(summary.heroTracksWeek).toBe(true);
    expect(summary.heroLabel).toBe("Poți folosi azi");
    expect(summary.heroValue).toBe(summary.brief.spendable);
    expect(today && dayStripFigure(today, summary.brief.spendable, summary.heroTracksWeek)).toBe(summary.todayStrip);
    expect(summary.todayStrip).toBe(summary.brief.spendable);
  });

  it("plicul fix de plătit până la salariu nu intră în cifra zilei", () => {
    const open = () => {
      const data = createEmptyAppData();
      data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-09-20", nextPayday: "2026-10-10", sourceIds: ["source-debit"] };
      data.settings.paymentSources = data.settings.paymentSources.map((source) => source.id === "source-debit" ? { ...source, openingBalance: 3000 } : source);
      return data;
    };
    const before = todayBrief(open(), "2026-09-20").spendable;
    const withDue = open();
    withDue.settings.salaryPlan.allocations = [{ id: "due", label: "De plătit până la salariu", amount: 1800, category: "Casă & facturi", sourceId: "source-debit", weeklyPace: false }];
    const after = todayBrief(withDue, "2026-09-20").spendable;
    expect(before).toBeGreaterThan(after + 40);
    expect(after).toBeGreaterThan(0);
    expect(before - after).toBeLessThan(200);
  });
});
