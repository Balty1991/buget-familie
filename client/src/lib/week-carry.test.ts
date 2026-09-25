import { afterEach, describe, expect, it, vi } from "vitest";
import { allocationWeeksStatus, createEmptyAppData } from "./finance-data";

const family = (carry: boolean) => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-01", nextPayday: "2026-10-28", paydayFlexDays: 0, weekCarryOver: carry || undefined, allocations: [{ id: "m", label: "Mâncare", amount: 2400, category: "Alimente", weeklyPace: true, weeklyAmount: 600 }] };
  data.transactions = [
    { id: "a", title: "Lidl", amount: 500, kind: "expense", category: "Alimente", source: "", person: "", date: "2026-10-03", allocationId: "m" },
    { id: "b", title: "Kaufland", amount: 800, kind: "expense", category: "Alimente", source: "", person: "", date: "2026-10-09", allocationId: "m" },
  ];
  return data;
};

describe("reportul între săptămâni", () => {
  afterEach(() => vi.useRealTimers());
  it("fără report, fiecare săptămână are suma ei", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T10:00:00"));
    const weeks = allocationWeeksStatus(family(false), family(false).settings.salaryPlan.allocations[0]);
    expect(weeks.slice(0, 3).map((week) => week.budget)).toEqual([600, 600, 600]);
  });
  it("cu report: +100 din S1, apoi depășirea din S2 se scade din S3", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T10:00:00"));
    const data = family(true);
    const weeks = allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]);
    expect(weeks.slice(0, 4).map((week) => [week.budget, week.carry])).toEqual([[600, 0], [700, 100], [500, -100], [600, 0]]);
  });
  it("săptămâna în curs nu dă nimic mai departe până nu se încheie", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T10:00:00"));
    const data = family(true);
    const weeks = allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]);
    expect(weeks[1].carry).toBe(100);
    expect(weeks[2].carry).toBe(0);
  });
});
