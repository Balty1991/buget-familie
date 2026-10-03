import { describe, expect, it } from "vitest";
import { debtExit } from "./debt-exit";

const debt = (id: string, remaining: number, monthly: number, annualRate?: number) => ({ id, name: id, remaining, monthly, due: "", tone: "coral" as const, ...(annualRate ? { annualRate } : {}) });

describe("ieșirea din datorii", () => {
  const debts = [debt("card", 4000, 200, 28), debt("credit", 18000, 600, 11), debt("prieten", 1500, 150)];

  it("compară strategiile și arată câștigul unei sume în plus", () => {
    const exit = debtExit(debts, 300)!;
    expect(exit.recommended).toBe("avalanche");
    expect(exit.chosen.strategy).toBe("avalanche");
    expect(exit.avalanche.totalInterest).toBeLessThanOrEqual(exit.snowball.totalInterest);
    expect(exit.monthsSaved).toBeGreaterThan(0);
    expect(exit.interestSaved).toBeGreaterThan(0);
    expect(exit.chosen.schedule[0]).toMatchObject({ prieten: 150 });
    const first = exit.chosen.schedule[0];
    expect(Math.round(Object.values(first).reduce((a, b) => a + b, 0))).toBe(200 + 600 + 150 + 300);
    expect(first.card).toBeGreaterThan(200);
  });

  it("fără sumă în plus nu câștigă nimic; fără datorii nu răspunde", () => {
    const exit = debtExit(debts, 0)!;
    expect(exit.monthsSaved).toBe(0);
    expect(exit.interestSaved).toBe(0);
    expect(debtExit([], 100)).toBeUndefined();
  });

  it("bulgărele de zăpadă închide întâi datoria mică", () => {
    const exit = debtExit(debts, 300, "snowball")!;
    expect(exit.chosen.order[0].id).toBe("prieten");
    expect(exit.chosen.closedAt.prieten).toBeLessThan(exit.chosen.closedAt.card);
  });
});
