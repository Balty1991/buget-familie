/** Utilizator #11: ultima tranșă se oprește la data salariului; toleranța se arată separat. */
import { describe, expect, it } from "vitest";
import { allocationWeeksStatus, createEmptyAppData, planWeeklyCycle } from "./finance-data";

describe("ultima săptămână a ciclului", () => {
  it("nu are 9 zile: zilele de toleranță sunt graceDays, cheltuielile din ele se numără", () => {
    const data = createEmptyAppData();
    const source = data.settings.paymentSources[0];
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: "2026-09-10",
      nextPayday: "2026-10-10",
      paydayFlexDays: 3,
      allocations: [{ id: "food", label: "Mâncare", category: "Alimente", amount: 1860, sourceId: source.id, weeklyPace: true }],
    };
    data.transactions = [{ id: "t1", title: "Lidl", amount: 40, kind: "expense", category: "Alimente", source: source.name, sourceId: source.id, person: "Eu", memberId: "member-me", date: "2026-10-12", allocationId: "food" }];
    const cycle = planWeeklyCycle(data)!;
    const last = cycle.weeks[cycle.weeks.length - 1];
    expect(last.days).toBeLessThanOrEqual(7);
    expect(last.end <= "2026-10-10").toBe(true);
    expect(last.graceDays).toBe(3);
    const weeks = allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]);
    expect(weeks[weeks.length - 1].spent).toBe(40);
  });
});
