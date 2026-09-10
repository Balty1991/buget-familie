import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { childMembers, childPocket } from "./allowance";

const expense = (id: string, memberId: string, amount: number, date: string, allocationId?: string): Transaction => ({
  id, title: "Gustare", amount, kind: "expense", category: "Dulciuri",
  source: "Cash", sourceId: "source-cash", person: "Rareș", memberId, date, allocationId,
});

const family = (): AppData => {
  const data = createEmptyAppData();
  data.settings.members = [
    { id: "member-me", name: "Eu" },
    { id: "member-copil", name: "Rareș", kind: "child" },
  ];
  data.settings.salaryPlan = {
    ...data.settings.salaryPlan,
    periodStart: "2026-09-01",
    nextPayday: "2026-09-30",
    allocations: [
      { id: "buzunar", label: "Banii lui Rareș", category: "Dulciuri", amount: 120, memberId: "member-copil" },
      { id: "alimente", label: "Alimente", category: "Alimente", amount: 1000, memberId: "member-me" },
    ],
  };
  return data;
};

describe("membrii marcați drept copii", () => {
  it("îi separă de adulți", () => {
    expect(childMembers(family()).map((item) => item.name)).toEqual(["Rareș"]);
  });

  it("nu marchează pe nimeni într-o familie fără copii", () => {
    expect(childMembers(createEmptyAppData())).toEqual([]);
  });
});

describe("buzunarul copilului", () => {
  it("adună doar plicurile de pe numele lui", () => {
    const pocket = childPocket(family(), "member-copil", "2026-09-10")!;
    expect(pocket.envelopes.map((item) => item.allocation.id)).toEqual(["buzunar"]);
    expect(pocket.budget).toBe(120);
    expect(pocket.remaining).toBe(120);
  });

  it("scade cheltuielile copilului și calculează suma pe zi până la reumplere", () => {
    const data = family();
    data.transactions = [expense("t1", "member-copil", 30, "2026-09-05", "buzunar")];
    const pocket = childPocket(data, "member-copil", "2026-09-10")!;
    expect(pocket.spent).toBe(30);
    expect(pocket.remaining).toBe(90);
    expect(pocket.refillsOn).toBe("2026-09-30");
    expect(pocket.daysLeft).toBe(20);
    // 90 lei peste 21 de zile, ziua de azi inclusă.
    expect(pocket.perDay).toBe(4.29);
  });

  it("nu propune nimic pe zi când plicul este gol", () => {
    const data = family();
    data.transactions = [expense("t1", "member-copil", 150, "2026-09-05", "buzunar")];
    const pocket = childPocket(data, "member-copil", "2026-09-10")!;
    expect(pocket.remaining).toBe(-30);
    expect(pocket.perDay).toBe(0);
  });

  it("nu numără cheltuielile altui membru", () => {
    const data = family();
    data.transactions = [expense("t1", "member-me", 50, "2026-09-05", "alimente")];
    const pocket = childPocket(data, "member-copil", "2026-09-10")!;
    expect(pocket.spent).toBe(0);
    expect(pocket.recent).toEqual([]);
  });

  it("listează ultimele cheltuieli ale copilului, cele mai noi întâi", () => {
    const data = family();
    data.transactions = [
      expense("t1", "member-copil", 10, "2026-09-03", "buzunar"),
      expense("t2", "member-copil", 12, "2026-09-08", "buzunar"),
    ];
    expect(childPocket(data, "member-copil", "2026-09-10")!.recent.map((item) => item.id)).toEqual(["t2", "t1"]);
  });

  it("tace pentru un membru fără plic propriu", () => {
    const data = family();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, allocations: data.settings.salaryPlan.allocations.filter((item) => item.id !== "buzunar") };
    expect(childPocket(data, "member-copil", "2026-09-10")).toBeUndefined();
  });

  it("tace pentru un membru care nu există", () => {
    expect(childPocket(family(), "member-inexistent", "2026-09-10")).toBeUndefined();
  });
});
