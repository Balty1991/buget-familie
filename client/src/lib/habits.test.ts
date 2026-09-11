import { describe, expect, it } from "vitest";
import { emptyGuideMemory, isCorrection, rememberExpense, understand, type FinancialUpdate } from "./understand";
import { createEmptyAppData, type AppData } from "./finance-data";

const spend = (over: Partial<Extract<FinancialUpdate, { kind: "expense" }>> = {}): Extract<FinancialUpdate, { kind: "expense" }> =>
  ({ kind: "expense", amount: 40, title: "Cafea", category: "Alimente", allocationId: "env-food", sourceId: "card", ...over });

describe("ce reține din alegerile tale", () => {
  it("reține denumirea, categoria, plicul și sursa", () => {
    const memory = rememberExpense(emptyGuideMemory(), spend());
    expect(memory.phrases).toHaveLength(1);
    expect(memory.phrases[0]).toMatchObject({ title: "Cafea", category: "Alimente", allocationId: "env-food", sourceId: "card", count: 1 });
  });

  it("nu reține denumirile fără conținut", () => {
    expect(rememberExpense(emptyGuideMemory(), spend({ title: "Altele" })).phrases).toHaveLength(0);
    expect(rememberExpense(emptyGuideMemory(), spend({ title: "Cheltuială" })).phrases).toHaveLength(0);
  });

  it("actualizează obiceiul în loc să-l dubleze", () => {
    let memory = rememberExpense(emptyGuideMemory(), spend());
    memory = rememberExpense(memory, spend({ allocationId: "env-fun" }));
    expect(memory.phrases).toHaveLength(1);
    expect(memory.phrases[0].allocationId).toBe("env-fun");
    expect(memory.phrases[0].count).toBe(2);
  });

  it("o corectură cântărește cât două acorduri", () => {
    const acord = rememberExpense(emptyGuideMemory(), spend(), 1);
    const corectura = rememberExpense(emptyGuideMemory(), spend(), 2);
    expect(corectura.phrases[0].count).toBe(2 * acord.phrases[0].count);
  });

  it("nu ține minte la nesfârșit", () => {
    let memory = emptyGuideMemory();
    for (let index = 0; index < 90; index += 1) memory = rememberExpense(memory, spend({ title: `Magazin ${index}` }));
    expect(memory.phrases.length).toBeLessThanOrEqual(80);
  });
});

describe("ce este o corectură", () => {
  it("alt plic decât cel propus", () => {
    expect(isCorrection(spend(), spend({ allocationId: "env-fun" }))).toBe(true);
  });

  it("altă sursă decât cea propusă", () => {
    expect(isCorrection(spend(), spend({ sourceId: "cash" }))).toBe(true);
  });

  it("aceeași alegere nu este corectură", () => {
    expect(isCorrection(spend(), spend())).toBe(false);
  });

  it("fără propunere nu există corectură", () => {
    expect(isCorrection(undefined, spend())).toBe(false);
  });

  it("un venit nu se compară cu o cheltuială", () => {
    expect(isCorrection({ kind: "income", amount: 10, title: "x" }, spend())).toBe(false);
  });
});

describe("obiceiul schimbă ce propune asistentul", () => {
  const house = (): AppData => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: data.settings.members[0].id, openingBalance: 3000 }];
    data.settings.salaryPlan.periodStart = "2026-09-01";
    data.settings.salaryPlan.nextPayday = "2026-10-01";
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 800, sourceId: "card", weeklyPace: false },
      { id: "env-fun", label: "Timp liber", category: "Timp liber", amount: 400, sourceId: "card", weeklyPace: false },
    ];
    return data;
  };

  const proposedFor = (memory = emptyGuideMemory()) => {
    const reading = understand("am dat 25 lei pe cafea", house(), { memory, asOf: "2026-09-11" }).find((item) => item.kind === "expense");
    return reading?.kind === "expense" ? reading.proposal.text : "";
  };

  it("fără obicei, propune după categorie", () => {
    expect(proposedFor()).toContain("Alimente");
  });

  it("după două corecturi, spune că de obicei scoți de acolo", () => {
    let memory = emptyGuideMemory();
    memory = rememberExpense(memory, spend({ title: "Cafea", allocationId: "env-fun", category: "Timp liber" }), 2);
    expect(proposedFor(memory)).toContain("De obicei");
    expect(proposedFor(memory)).toContain("Timp liber");
  });
});
