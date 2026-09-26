import { describe, expect, it } from "vitest";
import { projectCashflow } from "./cashflow-projection";
import { createEmptyAppData, type AppData } from "./finance-data";

const ASOF = "2026-09-24";

const family = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 2500 : 0 }));
  const member = data.settings.members[0].id;
  data.settings.salaryPlan = { ...data.settings.salaryPlan, incomes: [{ id: "sal", memberId: member, label: "Salariu", amount: 5000, day: 5 }] };
  data.recurring = [{ id: "rent", name: "Chirie", amount: 1800, category: "Casă & facturi", sourceId: "source-debit", memberId: member, dueDay: 1, active: true }];
  data.debts = [{ id: "card", name: "Card", remaining: 300, monthly: 200, due: "", tone: "coral", dueDate: "2026-09-28" }];
  return data;
};

describe("soldul estimat în calendar", () => {
  it("scade facturile și ratele, adaugă salariul declarat", () => {
    const projection = projectCashflow(family(), ASOF, 45);
    expect(projection.start).toBe(2500);
    const at = (date: string) => projection.days.find((day) => day.date === date)!.balance;
    expect(at("2026-09-27")).toBe(2500);
    expect(at("2026-09-28")).toBe(2300);
    expect(at("2026-10-01")).toBe(500);
    expect(at("2026-10-05")).toBe(5500);
    // A doua rată e doar restul datoriei: 100, nu 200.
    expect(at("2026-10-28")).toBe(5400);
    expect(at("2026-11-01")).toBe(3600);
    expect(projection.lowest).toEqual({ date: "2026-10-01", balance: 500 });
  });

  it("nu mai numără factura plătită sau salariul intrat devreme", () => {
    const data = family();
    const member = data.settings.members[0];
    data.transactions = [
      { id: "t1", recurringId: "rent", title: "Chirie", amount: 1800, kind: "expense", category: "Casă & facturi", sourceId: "source-debit", source: "Card", memberId: member.id, person: member.name, date: "2026-10-01", note: "", createdAt: "2026-10-01T10:00:00Z" },
      { id: "t2", title: "Salariu", amount: 5000, kind: "income", category: "Venit", sourceId: "source-debit", source: "Card", memberId: member.id, person: member.name, date: "2026-10-02", note: "", createdAt: "2026-10-02T10:00:00Z" },
    ];
    const october = projectCashflow(data, "2026-10-03", 5);
    expect(october.days.flatMap((day) => day.items)).toEqual([]);
  });
});
