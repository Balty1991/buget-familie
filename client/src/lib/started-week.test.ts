/**
 * Scenariul real: perioada 14 septembrie → 9 octombrie, planul făcut joi 17, cu trei zile
 * deja consumate din prima tranșă. Aceleași cifre trebuie să iasă și pe ecranul Plan, și
 * prin asistent, altfel aplicația spune două lucruri despre aceeași săptămână.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, allocationWeeksStatus, type AppData } from "./finance-data";
import { levelStartedWeek, startedWeekPlan, totalForWeeklyPace } from "./started-week";

const TODAY = "2026-09-17";

const house = (amount: number): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", openingBalance: 3000 }];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.paydayFlexDays = 3;
  data.settings.salaryPlan.allocations = [{ id: "env-food", label: "Alimente", category: "Alimente", amount, sourceId: "card", weeklyPace: true }];
  return data;
};

const weeks = (data: AppData) => allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]).map((week) => Math.round(week.budget));

describe("săptămâna începută", () => {
  it("dă zilelor rămase partea lor, nu bugetul unei săptămâni întregi", () => {
    const shift = startedWeekPlan(house(1199), house(1199).settings.salaryPlan.allocations[0], TODAY)!;
    expect(shift.weekIndex).toBe(1);
    expect(shift.share.daysLeft).toBe(4);
    // 1199 pe 23 de zile rămase = 52 pe zi, deci 209 pentru cele 4 zile — nu cei 323 ai tranșei.
    expect(shift.share.fair).toBeCloseTo(208.52, 0);
    expect(shift.movable).toBeCloseTo(114.56, 0);
  });

  it("după echilibrare, fiecare săptămână întreagă primește ritmul promis", () => {
    const after = levelStartedWeek(house(1199), "env-food", TODAY);
    expect(weeks(after)).toEqual([209, 365, 365, 261]);
    // Nimic nu se pierde pe drum.
    expect(weeks(after).reduce((sum, value) => sum + value, 0)).toBe(1200);
  });

  it("nu mișcă nimic a doua oară — echilibrarea e idempotentă", () => {
    const once = levelStartedWeek(house(1199), "env-food", TODAY);
    const twice = levelStartedWeek(once, "env-food", TODAY);
    expect(weeks(twice)).toEqual(weeks(once));
  });

  it("nu atinge un plic fără ritm săptămânal", () => {
    const data = house(1199);
    data.settings.salaryPlan.allocations[0].weeklyPace = false;
    expect(levelStartedWeek(data, "env-food", TODAY)).toBe(data);
  });

  it("nu face nimic înainte de începerea perioadei", () => {
    const data = house(1199);
    expect(levelStartedWeek(data, "env-food", "2026-09-14")).toBe(data);
  });
});

describe("ritmul cerut de asistent", () => {
  it("socotește „600 pe săptămână” pe zilele rămase, nu pe cele 26 din calendar", () => {
    // 600 × 23 / 7 = 1971, nu 600 × 26 / 7 = 2229 și cu atât mai puțin 600.
    expect(totalForWeeklyPace(house(0), 600, TODAY)).toBe(1971);
  });

  it("înainte de începerea perioadei numără perioada întreagă", () => {
    expect(totalForWeeklyPace(house(0), 600, "2026-09-14")).toBe(2229);
  });

  /**
   * Scenariul pe care l-a cerut familia: „folosesc cam 600 pe săptămână”. Plicul cerut prin
   * asistent trebuie să iasă la fel ca cel făcut de mână pe ecranul Plan.
   */
  it("un plic cerut cu 600 pe săptămână iese 343 / 600 / 600 / 428", () => {
    const data = house(0);
    const total = totalForWeeklyPace(data, 600, TODAY)!;
    data.settings.salaryPlan.allocations = [{ id: "env-food", label: "Alimente", category: "Alimente", amount: total, sourceId: "card", weeklyPace: true }];
    // Coada de 5 zile primește 600 × 5 / 7, minus leul pierdut la rotunjirea totalului.
    expect(weeks(levelStartedWeek(data, "env-food", TODAY))).toEqual([343, 600, 600, 428]);
  });

  it("fără perioadă nu ghicește", () => {
    const data = house(0);
    data.settings.salaryPlan.nextPayday = "";
    data.settings.salaryPlan.earliestPayday = "";
    expect(totalForWeeklyPace(data, 600, TODAY)).toBeUndefined();
  });
});
