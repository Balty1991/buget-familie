import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { dayStripFigure } from "./household-insights";
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
});
