import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { matchExpectedIncome } from "./monthly-needs";
import { statementDrafts } from "./statement-import";

const family = () => {
  const data = createEmptyAppData();
  data.settings.members = [{ id: "eu", name: "Eu" }, { id: "sotia", name: "Soția" }];
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", openingBalance: 0 }];
  data.settings.salaryPlan = { ...data.settings.salaryPlan, paydayFlexDays: 3, incomes: [{ id: "i1", memberId: "eu", label: "Salariul meu", amount: 4700, day: 10 }, { id: "i2", memberId: "sotia", label: "Salariul soției", amount: 2800, day: 12 }] };
  return data;
};

describe("salariul recunoscut după sumă și zi", () => {
  it("suma apropiată, în fereastra zilei", () => {
    expect(matchExpectedIncome(family(), { amount: 4650, date: "2026-10-08" })?.label).toBe("Salariul meu");
    expect(matchExpectedIncome(family(), { amount: 2800, date: "2026-10-13" })?.label).toBe("Salariul soției");
  });
  it("nu confundă alte încasări", () => {
    expect(matchExpectedIncome(family(), { amount: 4700, date: "2026-10-25" })).toBeUndefined();
    expect(matchExpectedIncome(family(), { amount: 900, date: "2026-10-10" })).toBeUndefined();
  });
  it("în extras, rândul de salariu primește numele și membrul lui", () => {
    const { drafts } = statementDrafts(family(), [{ line: 2, date: "2026-10-12", amount: 2790, kind: "income", description: "Transfer ACME SRL" }], { sourceId: "card", memberId: "eu" });
    expect(drafts[0].transaction).toMatchObject({ title: "Salariul soției", memberId: "sotia" });
    expect(drafts[0].reason).toMatch(/pare Salariul soției/);
  });
});
