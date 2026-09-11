/**
 * Ecranul Analiză compară luni calendaristice, dar aplicația este construită pe cicluri
 * de salariu. Testul fixează regula care deosebește „venitul nu a intrat încă” de
 * „ai cheltuit peste ce ai încasat”, ca alarma să nu mai pornească singură în fiecare lună.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, isoDate, newId, type AppData } from "./finance-data";

const monthRange = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return { start: `${year}-${String(index).padStart(2, "0")}-01`, end: isoDate(new Date(year, index, 0)) };
};

/** Aceeași condiție ca în ReportsPanel. */
const awaitingIncome = (data: AppData, month: string) => {
  const range = monthRange(month);
  const inMonth = data.transactions.filter((item) => item.date >= range.start && item.date <= range.end);
  const income = inMonth.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = inMonth.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const payday = data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday;
  return income === 0 && expense > 0 && Boolean(payday) && payday >= range.start && payday <= range.end;
};

const house = (): AppData => {
  const data = createEmptyAppData();
  const source = data.settings.paymentSources[0];
  const member = data.settings.members[0];
  const tx = (title: string, amount: number, kind: "income" | "expense", date: string) => ({
    id: newId("tx"), title, amount, kind, category: kind === "income" ? "Venit" : "Alimente",
    source: source.name, sourceId: source.id, person: member.name, memberId: member.id, date,
  });
  // Casa este plătită pe 25: salariul lunii august a intrat pe 25 august.
  data.transactions = [tx("Salariu august", 5200, "income", "2026-08-25"), tx("Lidl", 240, "expense", "2026-09-02"), tx("Kaufland", 315, "expense", "2026-09-05")];
  data.settings.salaryPlan.nextPayday = "2026-09-25";
  return data;
};

describe("luna calendaristică nu trebuie să dea alarme false", () => {
  it("pe 11 septembrie, o casă plătită pe 25 nu a „depășit veniturile”", () => {
    expect(awaitingIncome(house(), "2026-09")).toBe(true);
  });

  it("după ce intră salariul, comparația redevine obișnuită", () => {
    const data = house();
    const source = data.settings.paymentSources[0];
    data.transactions.push({
      id: newId("tx"), title: "Salariu septembrie", amount: 5200, kind: "income", category: "Venit",
      source: source.name, sourceId: source.id, person: data.settings.members[0].name,
      memberId: data.settings.members[0].id, date: "2026-09-25",
    });
    expect(awaitingIncome(data, "2026-09")).toBe(false);
  });

  it("o depășire adevărată rămâne o depășire", () => {
    const data = house();
    const source = data.settings.paymentSources[0];
    // Venit încasat în lună, dar cheltuit peste el: aici alarma este corectă.
    data.transactions.push({
      id: newId("tx"), title: "Salariu septembrie", amount: 400, kind: "income", category: "Venit",
      source: source.name, sourceId: source.id, person: data.settings.members[0].name,
      memberId: data.settings.members[0].id, date: "2026-09-03",
    });
    expect(awaitingIncome(data, "2026-09")).toBe(false);
  });

  it("o lună fără cheltuieli nu declanșează nimic", () => {
    const data = house();
    data.transactions = data.transactions.filter((item) => item.kind === "income");
    expect(awaitingIncome(data, "2026-09")).toBe(false);
  });

  it("fără o dată de salariu stabilită nu presupunem nimic", () => {
    const data = house();
    data.settings.salaryPlan.nextPayday = "";
    expect(awaitingIncome(data, "2026-09")).toBe(false);
  });
});
