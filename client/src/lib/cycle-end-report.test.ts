import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { cycleEndReport } from "./household-insights";

const family = () => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-01", nextPayday: "2026-10-29", paydayFlexDays: 0, allocations: [
    { id: "m", label: "Mâncare", amount: 2400, category: "Alimente", weeklyPace: true, weeklyAmount: 600 },
    { id: "l", label: "Lumină", amount: 400, category: "Casă & facturi", weeklyPace: false },
    { id: "g", label: "Gaz", amount: 200, category: "Casă & facturi", weeklyPace: false },
    { id: "t", label: "Taxi", amount: 500, category: "Transport", weeklyPace: false },
  ] };
  data.transactions = [
    { id: "a", title: "Lidl", amount: 1900, kind: "expense", category: "Alimente", source: "", person: "", date: "2026-10-20", allocationId: "m" },
    { id: "b", title: "Enel", amount: 330, kind: "expense", category: "Casă & facturi", source: "", person: "", date: "2026-10-15", allocationId: "l" },
    { id: "c", title: "Bolt", amount: 580, kind: "expense", category: "Transport", source: "", person: "", date: "2026-10-18", allocationId: "t" },
  ];
  data.savings = [{ id: "s", name: "Vacanță", current: 1000, target: 3000, due: "", tone: "forest" }];
  return data;
};

describe("raportul de final de lună", () => {
  it("apare cu 3 zile înainte de salariu, nu mai devreme", () => {
    expect(cycleEndReport(family(), "2026-10-20")).toBeUndefined();
    expect(cycleEndReport(family(), "2026-10-26")).toBeDefined();
  });
  it("ce a ajuns, ce nu și cât se poate muta fără grijă", () => {
    const report = cycleEndReport(family(), "2026-10-26")!;
    expect(report.over).toEqual([{ id: "t", label: "Taxi", over: 80 }]);
    expect(report.made.map((item) => [item.label, item.left])).toEqual([["Mâncare", 500], ["Gaz", 200], ["Lumină", 70]]);
    // Lumina plătită lasă 70; gazul neplătit își ține banii; mâncarea păstrează 3 × ~86 pentru zilele rămase.
    expect(report.spare).toBe(230); // 313 − cei 80 depășiți la taxi
    expect(report.goal).toMatchObject({ name: "Vacanță", left: 2000 });
  });
  it("după alegere, nu mai apare în ciclul ăsta", () => {
    const data = family();
    data.settings.salaryPlan.cycleReportDone = "2026-10-29";
    expect(cycleEndReport(data, "2026-10-27")).toBeUndefined();
  });
});
