/**
 * Închiderea ciclului: ce a rămas, ce s-a învățat și cum începe următorul.
 * Regula care contează: nu se învață din întâmplări, ci din obiceiuri.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { cycleClose, nextMonthSameDay, startNextCycle } from "./cycle-close";

const cheltuiala = (id: string, amount: number, date: string, category: string, allocationId: string): Transaction => ({
  id, title: category, amount, kind: "expense", category, source: "Card", sourceId: "card",
  person: "Eu", memberId: "member-me", date, allocationId,
});

const casa = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  me.id = "member-me";
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: me.id, openingBalance: 4000 }];
  data.settings.salaryPlan.periodStart = "2026-08-09";
  data.settings.salaryPlan.nextPayday = "2026-09-09";
  data.settings.salaryPlan.sourceIds = ["card"];
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 2000, sourceId: "card" },
    { id: "env-trans", label: "Transport", category: "Transport", amount: 500, sourceId: "card" },
  ];
  return data;
};

describe("închiderea ciclului", () => {
  it("nu se închide un ciclu care încă merge", () => {
    expect(cycleClose(casa(), "2026-09-01")).toBeUndefined();
    expect(cycleClose(casa(), "2026-09-09")).toBeUndefined();
  });

  it("spune ce a rămas în plicuri după ce ciclul s-a terminat", () => {
    const data = casa();
    data.transactions = [
      cheltuiala("t1", 400, "2026-08-12", "Alimente", "env-food"),
      cheltuiala("t2", 300, "2026-08-20", "Alimente", "env-food"),
      cheltuiala("t3", 200, "2026-09-02", "Alimente", "env-food"),
      cheltuiala("t4", 150, "2026-08-15", "Transport", "env-trans"),
    ];
    const close = cycleClose(data, "2026-09-10");
    expect(close).toBeDefined();
    expect(close!.spent).toBe(1050);
    expect(close!.envelopes.find((item) => item.id === "env-food")).toMatchObject({ budget: 2000, spent: 900, left: 1100 });
    expect(close!.leftInEnvelopes).toBe(1450);
  });

  it("propune plicul mai mic doar când obiceiul o arată", () => {
    const data = casa();
    data.transactions = [
      cheltuiala("t1", 400, "2026-08-12", "Alimente", "env-food"),
      cheltuiala("t2", 300, "2026-08-20", "Alimente", "env-food"),
      cheltuiala("t3", 200, "2026-09-02", "Alimente", "env-food"),
      // O singură mișcare pe Transport: prea puțin ca să învățăm ceva.
      cheltuiala("t4", 100, "2026-08-15", "Transport", "env-trans"),
    ];
    const close = cycleClose(data, "2026-09-10")!;
    expect(close.lessons.map((item) => item.allocationId)).toEqual(["env-food"]);
    const lectie = close.lessons[0];
    expect(lectie.current).toBe(2000);
    expect(lectie.suggested).toBeGreaterThan(800);
    expect(lectie.suggested).toBeLessThan(1200);
  });

  it("propune plicul mai mare când s-a cheltuit peste el", () => {
    const data = casa();
    data.settings.salaryPlan.allocations[1].amount = 200;
    data.transactions = [
      cheltuiala("t1", 300, "2026-08-12", "Transport", "env-trans"),
      cheltuiala("t2", 250, "2026-08-22", "Transport", "env-trans"),
      cheltuiala("t3", 200, "2026-09-03", "Transport", "env-trans"),
    ];
    const lectie = cycleClose(data, "2026-09-10")!.lessons.find((item) => item.allocationId === "env-trans");
    expect(lectie).toBeDefined();
    expect(lectie!.suggested).toBeGreaterThan(200);
  });

  it("ciclul următor pornește din ziua venitului, cu aceeași zi luna viitoare", () => {
    const data = casa();
    data.transactions = [
      cheltuiala("t1", 400, "2026-08-12", "Alimente", "env-food"),
      cheltuiala("t2", 300, "2026-08-20", "Alimente", "env-food"),
      cheltuiala("t3", 200, "2026-09-02", "Alimente", "env-food"),
    ];
    const next = startNextCycle(data, ["env-food"], "2026-09-10");
    const plan = next.settings.salaryPlan;
    expect(plan.periodStart).toBe("2026-09-09");
    expect(plan.nextPayday).toBe("2026-10-09");
    expect(plan.allocations.find((item) => item.id === "env-food")!.amount).toBeLessThan(2000);
    // Plicul neales rămâne neatins, iar mutările ciclului vechi nu trec mai departe.
    expect(plan.allocations.find((item) => item.id === "env-trans")!.amount).toBe(500);
    expect(plan.transfers).toEqual([]);
    expect((plan.allocationHistory || [])[0]).toMatchObject({ kind: "updated", allocationId: "env-food", previousAmount: 2000 });
  });

  it("o întârziere mare mută startul pe azi, ca planul să nu se nască consumat", () => {
    const data = casa();
    expect(startNextCycle(data, [], "2026-10-20").settings.salaryPlan.periodStart).toBe("2026-10-20");
  });

  it("31 ianuarie devine sfârșitul lui februarie, nu 3 martie", () => {
    expect(nextMonthSameDay("2026-01-31")).toBe("2026-02-28");
    expect(nextMonthSameDay("2026-12-15")).toBe("2027-01-15");
  });

  it("propune pe plic, nu pe categorie: facturile din aceeași categorie nu primesc suma întregii categorii", () => {
    const data = casa();
    data.settings.salaryPlan.allocations = [
      { id: "env-rent", label: "Chirie", category: "Casă & facturi", amount: 2000, sourceId: "card" },
      { id: "env-power", label: "Lumină", category: "Casă & facturi", amount: 250, sourceId: "card" },
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 2000, sourceId: "card" },
    ];
    data.transactions = [
      cheltuiala("r1", 2000, "2026-06-15", "Casă & facturi", "env-rent"),
      cheltuiala("r2", 2000, "2026-07-15", "Casă & facturi", "env-rent"),
      cheltuiala("r3", 2000, "2026-08-15", "Casă & facturi", "env-rent"),
      cheltuiala("p1", 240, "2026-06-15", "Casă & facturi", "env-power"),
      cheltuiala("p2", 250, "2026-07-15", "Casă & facturi", "env-power"),
      cheltuiala("p3", 260, "2026-08-15", "Casă & facturi", "env-power"),
    ];
    const close = cycleClose(data, "2026-09-10")!;
    expect(close.lessons.find((item) => item.allocationId === "env-power")).toBeUndefined();
    expect(close.lessons.find((item) => item.allocationId === "env-rent")).toBeUndefined();
  });
});
