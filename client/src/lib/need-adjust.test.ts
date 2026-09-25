import { describe, expect, it } from "vitest";
import { createEmptyAppData, type MonthlyNeed, type Transaction } from "./finance-data";
import { needAdjustments } from "./monthly-needs";

const need = (id: string, label: string, category: string, min: number, max: number, extra: Partial<MonthlyNeed> = {}): MonthlyNeed => ({ id, label, category, cadence: "monthly", min, max, priority: "fixed", ...extra });
const expense = (id: string, amount: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({ id, title: id, amount, kind: "expense", category: "Casă & facturi", source: "", person: "", date, ...extra });

const family = () => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, allocations: [{ id: "env-l", label: "Lumină", amount: 300, category: "Casă & facturi" }], needs: [need("l", "Lumină", "Casă & facturi", 250, 300, { allocationId: "env-l" }), need("a", "Apă", "Casă & facturi", 50, 100)] };
  data.transactions = [expense("e1", 320, "2026-07-12", { allocationId: "env-l" }), expense("e2", 350, "2026-08-12", { allocationId: "env-l" }), expense("e3", 380, "2026-09-12", { allocationId: "env-l" })];
  return data;
};

describe("intervalele după ce s-a plătit", () => {
  it("lumina plătită peste maxim: propune 320–380, luna cea mai veche întâi", () => {
    const [item] = needAdjustments(family(), "2026-10-05");
    expect(item).toMatchObject({ direction: "up", min: 320, max: 380 });
    expect(item.months.map((entry) => entry.amount)).toEqual([320, 350, 380]);
  });
  it("după „Lasă cum e”, nu mai întreabă luna asta", () => {
    const data = family();
    data.settings.salaryPlan.needs = data.settings.salaryPlan.needs!.map((item) => item.id === "l" ? { ...item, reviewedMonth: "2026-10" } : item);
    expect(needAdjustments(data, "2026-10-20")).toEqual([]);
    expect(needAdjustments(data, "2026-11-02")).toHaveLength(1);
  });
  it("fără plic și cu categoria împărțită (apă/lumină), nu ghicește", () => {
    const data = family();
    data.transactions = [expense("w1", 40, "2026-08-02"), expense("w2", 45, "2026-09-02")];
    expect(needAdjustments(data, "2026-10-05").find((item) => item.need.id === "a")).toBeUndefined();
  });
  it("mâncarea pe săptămână se compară pe săptămână", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, needs: [need("m", "Mâncare", "Alimente", 600, 600, { cadence: "weekly", priority: "flex" })] };
    data.transactions = [expense("f1", 3100, "2026-08-10", { category: "Alimente" }), expense("f2", 3000, "2026-09-10", { category: "Alimente" })];
    expect(needAdjustments(data, "2026-10-05")[0]).toMatchObject({ direction: "up", min: 700, max: 700 });
  });
});
