import { describe, expect, it } from "vitest";
import { applySalaryAllocationRules, createEmptyAppData, type AppData } from "@/lib/finance-data";

const setup = (amount: number, percents: number[]): AppData => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = {
    ...data.settings.salaryPlan,
    allocations: percents.map((_, i) => ({ id: `e${i}`, label: `Plic ${i}`, amount: 0, alertThreshold: 80 })),
    salaryAllocationRules: percents.map((value, i) => ({ id: `r${i}`, label: `R${i}`, allocationId: `e${i}`, mode: "percent" as const, value, active: true })),
  };
  data.transactions = [{ id: "inc", title: "Salariu", amount, kind: "income", category: "Venit", source: "Card", sourceId: "source-debit", person: "Eu", memberId: "member-me", date: "2026-09-10" }];
  return data;
};

describe("Reguli în procente care fac exact 100%", () => {
  for (const [amount, percents] of [[1000.01, [50, 50]], [1234.55, [30, 30, 40]], [4567.89, [25, 25, 25, 25]], [3001, [33.33, 33.33, 33.34]]] as Array<[number, number[]]>) {
    it(`${amount} lei cu ${percents.join("/")}%`, () => {
      const result = applySalaryAllocationRules(setup(amount, percents), "inc");
      expect(result.error).toBeUndefined();
      expect(result.total).toBeLessThanOrEqual(amount);
    });
  }
});
