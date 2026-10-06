/**
 * Testarea cu utilizatori, M4: datoriile au dobândă, iar ordinea de plată ține cont de ea.
 */
import { describe, expect, it } from "vitest";
import type { Debt } from "./finance-data";
import { amortize, buildDebtSchedule, orderDebts, payoffPlan, recommendedStrategy } from "./debt-plan";

const debt = (id: string, remaining: number, monthly: number, annualRate?: number): Debt => ({ id, name: id, remaining, monthly, due: "", tone: "coral", annualRate });

describe("scadențar cu dobândă", () => {
  it("fără dobândă rămâne sold ÷ rată", () => {
    const plan = amortize(18500, undefined, 620);
    expect(plan.months).toBe(30);
    expect(plan.totalInterest).toBe(0);
  });

  it("creditul de 18.500 cu 18% pe an are mai mult de 30 de rate și dobândă reală", () => {
    const plan = amortize(18500, 18, 620);
    // Sold × 1,5% pe lună: prima dobândă e 277,50 lei.
    expect(plan.rows[0].interest).toBe(277.5);
    expect(plan.months).toBeGreaterThan(30);
    // n = −ln(1 − rP/A) / ln(1 + r) = 39,86 → 40 de rate.
    expect(plan.months).toBe(40);
    expect(plan.totalInterest).toBeGreaterThan(5000);
    expect(plan.rows[plan.rows.length - 1].balanceAfter).toBe(0);
  });

  it("o rată care nu acoperă dobânda nu se termină niciodată", () => {
    expect(amortize(10000, 36, 250).months).toBeNull();
  });

  it("300 din 700 rămâne parțial; două plăți în aceeași lună se adună", () => {
    const partial = buildDebtSchedule({ monthly: 700, remaining: 10000, payments: [{ amount: 300, date: "2026-10-06" }] });
    expect(partial.rows[0]).toMatchObject({ status: "partial", paidAmount: 300, planned: 700, remainingAmount: 400 });
    const both = buildDebtSchedule({ monthly: 700, remaining: 9300, payments: [{ amount: 300, date: "2026-10-01" }, { amount: 400, date: "2026-10-20" }] });
    expect(both.rows[0]).toMatchObject({ status: "paid", paidAmount: 700 });
    expect(both.rows.filter((row) => row.date.startsWith("2026-10"))).toHaveLength(1);
  });

  it("ultima rată, mai mică, nu se numește parțială dacă datoria s-a închis", () => {
    const closed = buildDebtSchedule({ monthly: 700, remaining: 0, payments: [{ amount: 180, date: "2026-10-02", debtRemainingAfter: 0 }] });
    expect(closed.rows[0]).toMatchObject({ status: "paid", planned: 180, paidAmount: 180 });
  });

  it("arată doar primele 120 de rate viitoare", () => {
    const schedule = buildDebtSchedule({ monthly: 100, remaining: 50000, payments: [] });
    expect(schedule.futureCapped).toBe(true);
    expect(schedule.rows).toHaveLength(120);
  });
});

describe("ordinea de plată", () => {
  const debts = [debt("credit", 18500, 620, 18), debt("card", 3200, 210, 29), debt("ifn", 1800, 450, 120)];

  it("avalanșa ia întâi dobânda cea mai mare; mingea de zăpadă soldul cel mai mic", () => {
    expect(orderDebts(debts, "avalanche").map((item) => item.id)).toEqual(["ifn", "card", "credit"]);
    expect(orderDebts(debts, "snowball").map((item) => item.id)).toEqual(["ifn", "card", "credit"]);
    const mixed = [debt("mic-ieftin", 500, 100, 5), debt("mare-scump", 5000, 300, 40)];
    expect(orderDebts(mixed, "avalanche")[0].id).toBe("mare-scump");
    expect(orderDebts(mixed, "snowball")[0].id).toBe("mic-ieftin");
  });

  it("banii în plus scurtează drumul și scad dobânda; avalanșa nu costă mai mult", () => {
    const base = payoffPlan(debts, 0, "avalanche");
    const extra = payoffPlan(debts, 300, "avalanche");
    expect(extra.months!).toBeLessThan(base.months!);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
    const snowball = payoffPlan(debts, 300, "snowball");
    expect(extra.totalInterest).toBeLessThanOrEqual(snowball.totalInterest + 0.01);
    expect(Object.keys(extra.closedAt).sort()).toEqual(["card", "credit", "ifn"]);
  });

  it("recomandă avalanșa când se știu dobânzile, altfel mingea de zăpadă", () => {
    expect(recommendedStrategy(debts)).toBe("avalanche");
    expect(recommendedStrategy([debt("a", 100, 10), debt("b", 200, 10)])).toBe("snowball");
  });
});

describe("soldul lună de lună pentru grafic", () => {
  it("pornește de la totalul de azi și ajunge la zero în luna în care se închide ultima datorie", () => {
    const debts = [{ id: "a", name: "Card", remaining: 1000, monthly: 250, annualRate: 0, due: "", tone: "coral" as const }];
    const plan = payoffPlan(debts, 0, "snowball");
    expect(plan.totals).toEqual([1000, 750, 500, 250, 0]);
    expect(plan.totals.length - 1).toBe(plan.months);
  });
});
