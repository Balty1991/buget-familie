/**
 * Testarea cu utilizatori, #7: RCA, impozitul și facturile cu sumă variabilă.
 */
import { describe, expect, it } from "vitest";
import { autoPostDueRecurring, confirmRecurringPayment, createEmptyAppData, pendingRecurringInPlan, recurringDueForMonth, recurringNextDue, recurringOccursInMonth, type AppData, type RecurringPayment } from "./finance-data";

const plan = (data: AppData, periodStart: string, nextPayday: string) => {
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart, nextPayday, paydayFlexDays: 0 };
  data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 5000 : 0 }));
  return data;
};
const due = (patch: Partial<RecurringPayment>): RecurringPayment => ({ id: "r", name: "Plată", amount: 100, category: "Casă & facturi", sourceId: "source-debit", memberId: "member-me", dueDay: 10, active: true, ...patch });

describe("frecvența scadențelor", () => {
  it("trimestrial și anual cad doar în lunile lor", () => {
    const quarterly = { frequency: "quarterly" as const, month: 2 };
    expect([1, 2, 5, 8, 11, 12].map((month) => recurringOccursInMonth(quarterly, month))).toEqual([false, true, true, true, true, false]);
    const yearly = { frequency: "yearly" as const, month: 3 };
    expect([2, 3, 4].map((month) => recurringOccursInMonth(yearly, month))).toEqual([false, true, false]);
    expect(recurringOccursInMonth({}, 7)).toBe(true);
  });

  it("RCA anual se rezervă doar în perioada în care cade", () => {
    const data = plan(createEmptyAppData(), "2026-09-24", "2026-10-22");
    data.recurring = [due({ id: "rca", name: "RCA", amount: 900, dueDay: 15, frequency: "yearly", month: 10 })];
    expect(pendingRecurringInPlan(data).map((item) => [item.id, item.dueDate])).toEqual([["rca", "2026-10-15"]]);
    data.recurring = [due({ id: "rca", name: "RCA", amount: 900, dueDay: 15, frequency: "yearly", month: 3 })];
    expect(pendingRecurringInPlan(data)).toEqual([]);
  });

  it("o scadență anuală nu se adaugă automat într-o lună care nu e a ei", () => {
    const item = due({ frequency: "yearly", month: 3, autoPost: true });
    expect(recurringDueForMonth(item, "2026-09-24")).toBeUndefined();
    expect(recurringDueForMonth(item, "2026-03-24")).toBe("2026-03-10");
  });
});

describe("sumă variabilă", () => {
  it("se rezervă estimarea, iar la plată se înregistrează suma de pe factură", () => {
    const data = plan(createEmptyAppData(), "2026-09-24", "2026-10-22");
    data.recurring = [due({ id: "curent", name: "Curent", amount: 180, dueDay: 20, variable: true })];
    expect(pendingRecurringInPlan(data)[0].amount).toBe(180);
    const paid = confirmRecurringPayment(data, "curent", 213.4)!;
    expect(paid.transactions.find((item) => item.recurringId === "curent")?.amount).toBe(213.4);
    expect(pendingRecurringInPlan(paid)).toEqual([]);
  });

  it("nu se adaugă niciodată automat, chiar dacă era bifat", () => {
    const data = plan(createEmptyAppData(), "2026-09-01", "2026-10-22");
    data.recurring = [due({ id: "gaz", name: "Gaz", amount: 150, dueDay: 5, variable: true, autoPost: true })];
    expect(autoPostDueRecurring(data, "2026-09-24").transactions).toHaveLength(0);
  });
});

describe("următoarea scadență a unei plăți care nu vine lunar", () => {
  it("anual: luna ei, anul acesta sau anul viitor", () => {
    expect(recurringNextDue({ dueDay: 15, frequency: "yearly", month: 3 }, "2026-09-24")).toBe("2027-03-15");
    expect(recurringNextDue({ dueDay: 15, frequency: "yearly", month: 10 }, "2026-09-24")).toBe("2026-10-15");
    expect(recurringNextDue({ dueDay: 24, frequency: "yearly", month: 9 }, "2026-09-24")).toBe("2026-09-24");
  });

  it("trimestrial: următoarea lună din ciclul ei; ziua 31 cade pe ultima zi a lunii", () => {
    expect(recurringNextDue({ dueDay: 10, frequency: "quarterly", month: 1 }, "2026-09-24")).toBe("2026-10-10");
    expect(recurringNextDue({ dueDay: 31, frequency: "quarterly", month: 2 }, "2026-09-24")).toBe("2026-11-30");
  });
});
