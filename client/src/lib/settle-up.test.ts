/**
 * Cine cui datorează. Aplicația avea toate cifrele și nu făcea niciodată scăderea.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { applySettlement, settleUp, SETTLE_NOTE } from "./settle-up";

const tx = (id: string, amount: number, memberId: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, title: "Cumpărături", amount, kind: "expense", category: "Alimente", source: "Card",
  sourceId: memberId === "m1" ? "card-1" : "card-2", person: memberId, memberId, date: "2026-09-18", ...extra,
});

const casa = (): AppData => {
  const data = createEmptyAppData();
  data.settings.members = [{ id: "m1", name: "Eu" }, { id: "m2", name: "Ea" }];
  data.settings.paymentSources = [
    { id: "card-1", name: "Card Eu", kind: "card", memberId: "m1", openingBalance: 2000 },
    { id: "card-2", name: "Card Ea", kind: "card", memberId: "m2", openingBalance: 2000 },
  ];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  return data;
};

describe("decontarea între doi oameni", () => {
  it("nu se face socoteala într-o casă cu un singur adult", () => {
    const data = casa();
    data.settings.members = [{ id: "m1", name: "Eu" }];
    expect(settleUp(data, "2026-09-21")).toBeUndefined();
  });

  it("copiii nu intră în decontare", () => {
    const data = casa();
    data.settings.members.push({ id: "m3", name: "Copil", kind: "child" });
    expect(settleUp(data, "2026-09-21")).toBeDefined();
  });

  it("spune cine a pus mai mult și cât are de primit", () => {
    const data = casa();
    data.transactions = [tx("t1", 800, "m1"), tx("t2", 200, "m2")];
    const out = settleUp(data, "2026-09-21")!;
    expect(out.total).toBe(1000);
    expect(out.perPerson).toBe(500);
    expect(out.debt).toMatchObject({ fromName: "Ea", toName: "Eu", amount: 300 });
  });

  it("cheltuielile personale nu intră în socoteală", () => {
    const data = casa();
    data.transactions = [tx("t1", 800, "m1", { shareScope: "personal" }), tx("t2", 200, "m2")];
    const out = settleUp(data, "2026-09-21")!;
    expect(out.total).toBe(200);
    expect(out.debt).toMatchObject({ fromName: "Eu", toName: "Ea", amount: 100 });
  });

  it("o diferență de câțiva bani nu e o datorie", () => {
    const data = casa();
    data.transactions = [tx("t1", 100.5, "m1"), tx("t2", 100, "m2")];
    expect(settleUp(data, "2026-09-21")!.debt).toBeUndefined();
  });

  it("echilibrarea scrie mișcările adevărate și repornește socoteala", () => {
    const data = casa();
    data.transactions = [tx("t1", 800, "m1"), tx("t2", 200, "m2")];
    const next = applySettlement(data, "2026-09-21");
    const scrise = next.transactions.filter((item) => item.note === SETTLE_NOTE);
    expect(scrise).toHaveLength(2);
    expect(scrise.find((item) => item.kind === "expense")).toMatchObject({ memberId: "m2", amount: 300, shareScope: "personal" });
    expect(scrise.find((item) => item.kind === "income")).toMatchObject({ memberId: "m1", amount: 300 });
    // De acum socoteala pornește de la decontare, deci nu mai e nimic de echilibrat.
    expect(settleUp(next, "2026-09-21")!.debt).toBeUndefined();
  });

  it("fără datorie nu se scrie nimic", () => {
    const data = casa();
    data.transactions = [tx("t1", 100, "m1"), tx("t2", 100, "m2")];
    expect(applySettlement(data, "2026-09-21")).toBe(data);
  });
});
