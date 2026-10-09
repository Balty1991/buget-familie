import { describe, expect, it } from "vitest";
import { createEmptyAppData, debtsOutsideTrackedMoney, planAllocationMath, recordDebtPayment, type AppData, type Debt } from "./finance-data";
import { buildTodaySummary } from "./today-summary";

const ASOF = "2026-10-09";
const debt = (id: string, monthly: number, dueDate: string, remaining = 5000): Debt => ({ id, name: id, remaining, monthly, due: "", tone: "coral", dueDate });

/** Ca în backup-ul din 9 oct: 165,73 în surse, salariul pus pe 9 nov dar nenotat, 7 rate până atunci, niciun plic. */
const family = (): AppData => {
  const data = createEmptyAppData();
  data.transactions = [
    { id: "in", title: "Buget rămas", amount: 612.5, kind: "income", category: "Venit", source: "Card", person: "Eu", date: "2026-10-05", sourceId: "source-debit" },
    { id: "out", title: "Cumpărături", amount: 446.77, kind: "expense", category: "Alimente", source: "Card", person: "Eu", date: "2026-10-08", sourceId: "source-debit" },
  ];
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: ASOF, nextPayday: "2026-11-09", earliestPayday: undefined, paydayFlexDays: 0 };
  data.debts = [debt("a", 90.25, "2026-10-10"), debt("b", 32.83, "2026-10-17"), debt("c", 250.18, "2026-10-24"), debt("d", 672.96, "2026-10-30"), debt("e", 179, "2026-10-25"), debt("f", 580.68, "2026-10-17"), debt("g", 166.04, "2026-10-13")];
  return data;
};

describe("ratele unui membru fără bani notați (Angi, 9 oct)", () => {
  const withAngi = () => {
    const data = family();
    data.settings.members = [...data.settings.members, { id: "angi", name: "Angi" }];
    data.settings.paymentSources = [...data.settings.paymentSources, { id: "src-angi", name: "Raiffeisen Angi", kind: "card", memberId: "angi", openingBalance: 0 }];
    data.debts = data.debts.map((item) => ["e", "f", "g"].includes(item.id) ? { ...item, memberId: "angi" } : item);
    return data;
  };

  it("nu le scade din banii notați, dar le spune pe nume", () => {
    const data = withAngi();
    expect(debtsOutsideTrackedMoney(data).map((item) => item.id).sort()).toEqual(["e", "f", "g"]);
    expect(planAllocationMath(data).scheduled).toBeCloseTo(1971.94 - 925.72, 2);
    const summary = buildTodaySummary(data, ASOF);
    expect(summary.heroValue).toBeCloseTo(1971.94 - 925.72 - 165.73, 2);
    expect(summary.heroHint).toMatch(/Nu sunt scăzute ratele pe numele Angi \(925,72\)/);
  });

  it("o rată de-a ei confirmată din cardul altcuiva le aduce înapoi la socoteală", () => {
    const data = withAngi();
    const paid = recordDebtPayment(data, { debtId: "g", amount: 166.04, sourceId: "source-debit", memberId: "member-me", date: ASOF })!;
    expect(debtsOutsideTrackedMoney(paid)).toEqual([]);
    expect(planAllocationMath(paid).scheduled).toBeCloseTo(1971.94 - 166.04, 2);
  });

  it("o mișcare pe sursa ei le aduce înapoi", () => {
    const data = withAngi();
    data.transactions.push({ id: "angi-in", title: "Salariu Angi", amount: 3000, kind: "income", category: "Salariu", source: "Raiffeisen Angi", person: "Angi", date: ASOF, sourceId: "src-angi" });
    expect(debtsOutsideTrackedMoney(data)).toEqual([]);
  });
});

describe("lipsa care vine doar din rate (9 oct)", () => {
  it("nu mai spune „Peste limita planului” fără plicuri, ci cât lipsește pentru rate", () => {
    const summary = buildTodaySummary(family(), ASOF);
    expect(summary.overPlan).toBe(true);
    expect(summary.duesShort).toBe(true);
    expect(summary.heroValue).toBeCloseTo(1806.21, 2);
    expect(summary.heroLabel).toBe("Lipsesc pentru rate și facturi");
    expect(summary.heroHint).toMatch(/sunt de plătit 1\.971,94.*în surse ai 165,73.*Venitul acestui ciclu nu e notat/);
  });

  it("după ce salariul e notat, cifra se reface", () => {
    const data = family();
    data.transactions.push({ id: "sal", title: "Salariu", amount: 5000, kind: "income", category: "Salariu", source: "Card", person: "Eu", date: ASOF, sourceId: "source-debit" });
    const summary = buildTodaySummary(data, ASOF);
    expect(summary.overPlan).toBe(false);
    expect(summary.duesShort).toBe(false);
  });
});
