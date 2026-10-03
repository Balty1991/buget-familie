import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { monthAdvice } from "./month-advisor";

let n = 0;
const tx = (date: string, amount: number, kind: "income" | "expense", category = "Alimente", extra: Partial<Transaction> = {}) => ({ id: `t${++n}`, date, amount, kind, category, title: category, sourceId: "card", source: "Card", person: "A", ...extra }) as Transaction;

describe("asistentul lunar", () => {
  const data = () => {
    const d = createEmptyAppData();
    d.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", openingBalance: 0 }];
    for (const month of ["2026-06", "2026-07", "2026-08"]) d.transactions.push(tx(`${month}-10`, 8000, "income", "Salariu"), tx(`${month}-11`, 2000, "expense"), tx(`${month}-12`, 600, "expense", "Timp liber"), tx(`${month}-13`, 1000, "expense", "Transport"));
    d.transactions.push(tx("2026-09-10", 8000, "income", "Salariu"), tx("2026-09-11", 2900, "expense"), tx("2026-09-12", 200, "expense", "Timp liber"), tx("2026-09-13", 1000, "expense", "Transport"), tx("2026-09-20", 500, "expense", "Credite", { debtId: "d" }));
    d.savings = [{ id: "f", name: "Fond de urgență", current: 1000, target: 20000, due: "", tone: "forest" }];
    d.settings.salaryPlan.allocations = [{ id: "a", label: "Timp liber", category: "Timp liber", amount: 800, alertThreshold: 80 }];
    return d;
  };

  it("socotește luna, ce a mers și ce nu, față de media lunilor dinainte", () => {
    const advice = monthAdvice(data(), "2026-09", "2026-10-03")!;
    expect(advice).toMatchObject({ income: 8000, expense: 4600, saved: 3400, rate: 43 });
    expect(advice.wins.some((line) => line.includes("3.400"))).toBe(true);
    expect(advice.wins.some((line) => line.startsWith("Timp liber"))).toBe(true);
    expect(advice.wins.some((line) => line.includes("din datorii"))).toBe(true);
    expect(advice.issues.some((line) => line.startsWith("Alimente"))).toBe(true);
  });

  it("dă cel mult trei recomandări, fiecare cu o sumă", () => {
    const advice = monthAdvice(data(), "2026-09", "2026-10-03")!;
    expect(advice.tips.length).toBeGreaterThan(0);
    expect(advice.tips.length).toBeLessThanOrEqual(3);
    expect(advice.tips.every((tip) => (tip.amount || 0) > 0)).toBe(true);
    expect(advice.tips.find((tip) => tip.id === "limit")?.amount).toBe(2200);
    expect(advice.tips.find((tip) => tip.id === "save")?.text).toContain("Fond de urgență");
  });

  it("cu prea puține mișcări nu face raport", () => {
    expect(monthAdvice(createEmptyAppData(), "2026-09", "2026-10-03")).toBeUndefined();
  });
});

describe("asistentul lunar, lună începută la jumătate", () => {
  it("nu propune plicuri mai mici și spune că luna e incompletă", () => {
    const d = createEmptyAppData();
    d.settings.salaryPlan.allocations = [{ id: "a", label: "Mâncare", category: "Alimente", amount: 2400, alertThreshold: 80 }];
    d.transactions = [tx("2026-09-19", 9000, "income", "Salariu"), ...[20, 21, 22, 23, 24].map((day) => tx(`2026-09-${day}`, 100, "expense"))];
    const advice = monthAdvice(d, "2026-09", "2026-10-03")!;
    expect(advice.partialFrom).toBe("2026-09-19");
    expect(advice.tips.some((tip) => tip.id.startsWith("env-"))).toBe(false);
  });
});
