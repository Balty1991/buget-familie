import { describe, expect, it } from "vitest";
import { analyze } from "./analyst";
import { createEmptyAppData, pendingDebtsInPlan, planAllocationMath, planForecast, recordDebtPayment, type AppData, type Debt } from "./finance-data";
import { liquidSafeToSpend, todayBrief } from "./household-insights";

const ASOF = "2026-09-24";

const debt = (id: string, monthly: number, dueDate: string, remaining = 5000): Debt => ({ id, name: id, remaining, monthly, due: "", tone: "coral", dueDate });

/** Andrei din testarea cu utilizatori: 2.500 pe card, salariul pe 05.10, trei datorii. */
const andrei = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 2500 : 0 }));
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: ASOF, nextPayday: "2026-10-05", earliestPayday: undefined, paydayFlexDays: 0 };
  data.debts = [
    debt("ifn", 450, "2026-10-01"),
    debt("card", 210, "2026-10-15"),
    debt("credit", 620, "2026-10-20", 18500),
  ];
  return data;
};

describe("ratele la datorii înainte de venit (C1)", () => {
  it("rezervă doar rata care cade înainte de salariu", () => {
    const pending = pendingDebtsInPlan(andrei());
    expect(pending.map((item) => [item.id, item.amount, item.dueDate])).toEqual([["ifn", 450, "2026-10-01"]]);
  });

  it("scade rata din cifra zilei, din Plan și din răspunsul ghidului", () => {
    const data = andrei();
    expect(planForecast(data, ASOF).safeDaily).toBeCloseTo((2500 - 450) / 12, 2);
    expect(liquidSafeToSpend(data, ASOF).available).toBe(2050);
    expect(todayBrief(data, ASOF).spendable).toBeCloseTo(170.83, 2);
    expect(planAllocationMath(data).scheduled).toBe(450);
    // Fără rezervă, ghidul socotea toți cei 2.500 liberi: „Da. Rămân 400”.
    expect(analyze("Pot să-mi permit o mașină de spălat de 2100 lei luna asta?", data, ASOF)!.headline).toMatch(/^Ar ieși 50 RON peste/);
    expect(analyze("Îmi permit 2000 lei?", data, ASOF)!.headline).toMatch(/^Da\. Rămân 50 RON/);
  });

  it("nu mai rezervă rata după ce a fost plătită în perioadă", () => {
    const paid = recordDebtPayment(andrei(), { debtId: "ifn", amount: 450, sourceId: "source-debit", memberId: "member-me", date: ASOF })!;
    expect(pendingDebtsInPlan(paid)).toEqual([]);
    // Plata a ieșit deja din sold; nu se scade încă o dată.
    expect(liquidSafeToSpend(paid, ASOF).available).toBe(2050);
  });

  it("reia pe aceeași zi a lunii o dată de rată rămasă în urmă", () => {
    const data = andrei();
    data.debts = [debt("ifn", 450, "2026-08-01")];
    expect(pendingDebtsInPlan(data).map((item) => item.dueDate)).toEqual(["2026-10-01"]);
  });

  it("nu rezervă mai mult decât a rămas de plătit și ignoră datoriile fără dată", () => {
    const data = andrei();
    data.debts = [debt("aproape", 450, "2026-10-01", 120), { ...debt("fara-data", 300, ""), dueDate: undefined }, debt("achitat", 450, "2026-10-01", 0)];
    expect(pendingDebtsInPlan(data).map((item) => [item.id, item.amount])).toEqual([["aproape", 120]]);
  });

  it("fără data venitului nu rezervă nimic", () => {
    const data = andrei();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, nextPayday: "" };
    expect(pendingDebtsInPlan(data)).toEqual([]);
  });
});

describe("scadențele din categoria unui plic (problema medie #8)", () => {
  it("se plătesc din plicul lor, nu se rezervă a doua oară", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 2500 : 0 }));
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: ASOF,
      nextPayday: "2026-10-05",
      paydayFlexDays: 0,
      allocations: [{ id: "home", label: "Casă & facturi", amount: 800, category: "Casă & facturi" }],
    };
    data.recurring = [{ id: "intretinere", name: "Întreținere", amount: 450, category: "Casă & facturi", sourceId: "source-debit", memberId: "member-me", dueDay: 25, active: true }];
    const math = planAllocationMath(data);
    expect(math.scheduledInEnvelopes).toBe(450);
    expect(math.scheduled).toBe(0);
    // Înainte: 2.500 − 800 − 450 = 1.250.
    expect(math.unrepartized).toBe(1700);
  });

  it("partea care nu încape în plic rămâne rezervată separat", () => {
    const data = andrei();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, allocations: [{ id: "rate", label: "Rate", amount: 100, category: "Rate produse" }] };
    const math = planAllocationMath(data);
    expect(math.scheduledInEnvelopes).toBe(100);
    expect(math.scheduled).toBe(350);
  });
});
