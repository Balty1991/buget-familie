import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { billInMonth, monthlyLiving, yearPlan } from "./year-plan";

const base = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", openingBalance: 5000 }];
  data.settings.salaryPlan.incomes = [{ id: "sal", memberId: "m", label: "Salariu", amount: 6000, day: 10 }];
  const spend = (date: string, amount: number, extra: Partial<Transaction> = {}) => ({ id: `${date}-${amount}`, date, title: "x", amount, kind: "expense" as const, category: "Alimente", sourceId: "card", source: "Card", person: "A", ...extra }) as Transaction;
  data.transactions = [spend("2026-07-05", 4000), spend("2026-08-05", 4000), spend("2026-09-05", 4000), spend("2026-09-06", 999, { recurringId: "r" })];
  return data;
};

describe("planul pe 12 luni", () => {
  it("facturile trimestriale și anuale cad în lunile lor", () => {
    expect(billInMonth({ frequency: "yearly", month: 3 }, "2027-03")).toBe(true);
    expect(billInMonth({ frequency: "yearly", month: 3 }, "2027-04")).toBe(false);
    expect(billInMonth({ frequency: "quarterly", month: 1 }, "2026-10")).toBe(true);
    expect(billInMonth({ frequency: "quarterly", month: 1 }, "2026-11")).toBe(false);
    expect(billInMonth({}, "2026-11")).toBe(true);
  });

  it("traiul obișnuit vine din ultimele luni, fără facturi", () => {
    expect(monthlyLiving(base(), "2026-10-03")).toEqual({ amount: 4000, basis: "spending" });
  });

  it("socotește lună cu lună: venit, trai, facturi, rate până la ultima, evenimente", () => {
    const data = base();
    data.recurring = [{ id: "rca", name: "RCA", amount: 1200, category: "Transport", sourceId: "card", memberId: "m", dueDay: 5, active: true, frequency: "yearly", month: 1 }];
    data.debts = [{ id: "d", name: "Telefon", remaining: 600, monthly: 200, due: "", tone: "coral" }];
    data.settings.plannedEvents = [{ id: "e", name: "Crăciun", date: "2026-12-25", estimate: 1500, kind: "holiday", repeat: "yearly" } as never];
    const plan = yearPlan(data, "2026-10-03");
    // Pornim de la 5000 − 15.000 cheltuiți (12.000 + 999) = −7.999 lei pe card.
    expect(plan.start).toBe(5000 - 12999);
    expect(plan.months[0]).toMatchObject({ key: "2026-11", income: 6000, living: 4000, bills: 0, debts: 200, net: 1800 });
    expect(plan.months[1]).toMatchObject({ key: "2026-12", events: 1500 });
    expect(plan.months[1].notes).toContain("Crăciun");
    expect(plan.months[2]).toMatchObject({ key: "2027-01", bills: 1200, debts: 200 });
    expect(plan.months[2].notes).toContain("✓ Telefon");
    expect(plan.months[3].debts).toBe(0);
    expect(plan.firstShort).toBe(0);
  });

  it("scenariile: un venit pierdut, o cheltuială în plus, una mare o dată, un credit", () => {
    const data = base();
    data.settings.paymentSources[0].openingBalance = 20000;
    const plain = yearPlan(data, "2026-10-03");
    const loss = yearPlan(data, "2026-10-03", [{ id: "1", kind: "income-loss", incomeId: "sal", share: 1, from: 0, months: 3 }]);
    expect(loss.months[0].income).toBe(0);
    expect(loss.months[3].income).toBe(6000);
    expect(loss.months[11].balance).toBe(plain.months[11].balance - 18000);
    const rent = yearPlan(data, "2026-10-03", [{ id: "2", kind: "expense", label: "Chirie", amount: 300, from: 2 }]);
    expect(rent.months[11].balance).toBe(plain.months[11].balance - 3000);
    const car = yearPlan(data, "2026-10-03", [{ id: "3", kind: "one-off", label: "Mașină", amount: 5000, at: 4 }]);
    expect(car.months[4].notes).toContain("Mașină");
    const loan = yearPlan(data, "2026-10-03", [{ id: "4", kind: "loan", label: "Credit", principal: 10000, monthly: 500, months: 24, at: 0 }]);
    expect(loan.months[0].scenario).toBe(10000);
    expect(loan.months[1].scenario).toBe(-500);
  });
});
