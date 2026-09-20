/**
 * Propunerea de împărțire atinge toți banii unui ciclu, deci greșelile ei sunt scumpe:
 * o sumă care nu se închide, o scadență reîmpărțită sau procente inventate din nimic.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { proposeSplit } from "./split-proposal";

const house = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: "member-me", openingBalance: 2000 }];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.sourceIds = ["card"];
  return data;
};

const suma = (lines: Array<{ amount: number }>) => lines.reduce((total, line) => total + line.amount, 0);

describe("împărțirea unei sume în plicuri", () => {
  it("pleacă de la plicurile pe care omul le are deja", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [
      { id: "a1", label: "Alimente", category: "Alimente", amount: 600 },
      { id: "a2", label: "Transport", category: "Transport", amount: 200 },
    ];
    const split = proposeSplit(data, 1600, "2026-09-20");
    expect(split.basis).toBe("envelopes");
    // 3:1, ca înainte — nu procente din cărți.
    expect(split.lines.map((line) => `${line.label}=${line.amount}`)).toEqual(["Alimente=1200", "Transport=400"]);
    expect(suma(split.lines)).toBe(1600);
  });

  it("scade scadențele rezervate înainte de a împărți", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", category: "Alimente", amount: 600 }];
    data.recurring = [{ id: "r1", name: "Chirie", amount: 500, category: "Casă & facturi", sourceId: "card", memberId: "member-me", dueDay: 28, active: true }];
    const split = proposeSplit(data, 1500, "2026-09-20");
    expect(split.reserved).toBe(500);
    expect(split.spendable).toBe(1000);
    expect(suma(split.lines)).toBe(1000);
  });

  it("fără plicuri, se uită la ce a cheltuit în ultimele 90 de zile", () => {
    const data = house();
    data.transactions = [
      { id: "t1", title: "Lidl", amount: 300, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: "Eu", date: "2026-09-10" },
      { id: "t2", title: "Taxi", amount: 100, kind: "expense", category: "Transport", source: "Card debit", sourceId: "card", person: "Eu", date: "2026-09-12" },
    ];
    const split = proposeSplit(data, 800, "2026-09-20");
    expect(split.basis).toBe("history");
    expect(split.lines.map((line) => line.label)).toEqual(["Alimente", "Transport"]);
    expect(suma(split.lines)).toBe(800);
  });

  it("nu numără de două ori o plată recurentă din istoric", () => {
    const data = house();
    data.recurring = [{ id: "r1", name: "Chirie", amount: 500, category: "Casă & facturi", sourceId: "card", memberId: "member-me", dueDay: 28, active: true }];
    data.transactions = [
      { id: "t1", title: "Chirie", amount: 500, kind: "expense", category: "Casă & facturi", source: "Card debit", sourceId: "card", person: "Eu", date: "2026-08-28", recurringId: "r1" },
      { id: "t2", title: "Lidl", amount: 200, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: "Eu", date: "2026-09-10" },
    ];
    const split = proposeSplit(data, 1000, "2026-09-20");
    expect(split.lines.every((line) => line.category !== "Casă & facturi")).toBe(true);
  });

  it("nu inventează procente când nu știe nimic despre familie", () => {
    const split = proposeSplit(house(), 1800, "2026-09-20");
    expect(split.basis).toBe("none");
    expect(split.lines).toEqual([]);
  });

  it("nu propune nimic când scadențele mănâncă toată suma", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", category: "Alimente", amount: 600 }];
    data.recurring = [{ id: "r1", name: "Chirie", amount: 1500, category: "Casă & facturi", sourceId: "card", memberId: "member-me", dueDay: 28, active: true }];
    const split = proposeSplit(data, 1400, "2026-09-20");
    expect(split.spendable).toBe(0);
    expect(split.lines).toEqual([]);
  });

  it("rotunjește la 10 lei, dar suma rămâne închisă", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [
      { id: "a1", label: "Alimente", category: "Alimente", amount: 733 },
      { id: "a2", label: "Transport", category: "Transport", amount: 267 },
      { id: "a3", label: "Timp liber", category: "Timp liber", amount: 111 },
    ];
    const split = proposeSplit(data, 1777, "2026-09-20");
    expect(suma(split.lines)).toBe(1777);
    expect(split.lines.slice(0, -1).every((line) => line.amount % 10 === 0)).toBe(true);
  });
});
