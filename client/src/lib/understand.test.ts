import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { decide, understand, type Reading } from "./understand";
import { CORPUS, CORPUS_EXTRA, CORPUS_PARTIAL, type Outcome } from "./understand.corpus";

/** O gospodărie obișnuită: două persoane, patru locuri cu bani, trei plicuri. */
const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.members.push({ id: "m2", name: "Soția" });
  data.settings.paymentSources = [
    { id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 4450 },
    { id: "cash", name: "Cash", kind: "cash", memberId: me.id, openingBalance: 0 },
    { id: "tichete", name: "Bonuri de masă", kind: "meal", memberId: me.id, openingBalance: 0 },
    { id: "comun", name: "Transfer comun", kind: "card", openingBalance: 0 },
  ];
  data.settings.salaryPlan.periodStart = "2026-09-11";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 1600, sourceId: "card", weeklyPace: true },
    { id: "env-trans", label: "Transport", category: "Transport", amount: 500, sourceId: "card", weeklyPace: true },
    { id: "env-house", label: "Casă & facturi", category: "Casă & facturi", amount: 900, sourceId: "card", weeklyPace: true },
  ];
  data.recurring = [
    { id: "rec-chirie", name: "Chirie", amount: 1500, dueDay: 5, category: "Casă & facturi", sourceId: "card", memberId: me.id, active: true },
  ];
  data.transactions = [
    { id: "tx-1", title: "Lidl", amount: 240, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-08", allocationId: "env-food" },
    { id: "tx-2", title: "Taxi", amount: 50, kind: "expense", category: "Transport", source: "Card debit", sourceId: "card", person: "Soția", memberId: "m2", date: "2026-09-09", allocationId: "env-trans" },
  ];
  return data;
};

/** Ce înseamnă o citire pentru om, dincolo de cine a produs-o. */
const outcomeOf = (reading?: Reading): Outcome => {
  if (!reading) return "none";
  switch (reading.kind) {
    case "confirm": return "confirm";
    case "revise": return "revise";
    case "due": return "due";
    case "question": case "insight": return "answer";
    case "expense": return "expense";
    case "income": return "income";
    case "transfer": return "transfer";
    case "intents": {
      const kind = reading.intents[0].intent.kind;
      return kind === "envelope" ? "envelope" : kind as Outcome;
    }
  }
};

const read = (text: string, data = house()) => outcomeOf(decide(understand(text, data, { asOf: "2026-09-11" })).winner);

describe("corpusul de fraze", () => {
  const results = [...CORPUS, ...CORPUS_EXTRA, ...CORPUS_PARTIAL].map((item) => ({ ...item, got: read(item.text) }));
  const ok = (item: { want: Outcome | Outcome[]; got: Outcome }) => (Array.isArray(item.want) ? item.want.includes(item.got) : item.want === item.got);
  const wrong = results.filter((item) => !ok(item));

  it("spune cât înțelege, de fiecare dată", () => {
    const scor = Math.round(((results.length - wrong.length) / results.length) * 100);
    const raport = wrong.map((item) => `  „${item.text}” → ${item.got}, ar trebui ${[item.want].flat().join(" sau ")}${item.note ? ` (${item.note})` : ""}`).join("\n");
    console.log(`\nînțelegere: ${results.length - wrong.length}/${results.length} (${scor}%)\n${raport}\n`);
    expect(results.length).toBeGreaterThan(50);
  });

  it("nu înțelege mai prost decât ieri", () => {
    // Un caz nou care pică se marchează `pending` pe față, cu motiv — nu se strecoară.
    const regresii = wrong.filter((item) => !item.pending).map((item) => `„${item.text}” → ${item.got}, ar trebui ${[item.want].flat().join(" sau ")}`);
    expect(regresii).toEqual([]);
  });

  it("nu confundă niciodată o întrebare sau o mutare cu o cheltuială", () => {
    // Cele două confuzii care costă bani: scriu în registru ceva ce omul nu a cerut.
    const periculoase = results.filter((item) => item.got === "expense" && ["answer", "transfer"].includes([item.want].flat()[0]));
    expect(periculoase.map((item) => item.text)).toEqual([]);
  });
});

describe("o citire nu se ia pe tăcute", () => {
  it("întoarce toate citirile posibile, nu doar prima", () => {
    const readings = understand("am dat 50 lei pe benzină", house(), { asOf: "2026-09-11" });
    expect(readings.length).toBeGreaterThan(0);
    expect(readings.every((item) => typeof item.score === "number" && item.why.length > 3)).toBe(true);
  });

  it("le dă în ordinea scorului", () => {
    const readings = understand("cât pot cheltui pe zi?", house(), { asOf: "2026-09-11" });
    const scores = readings.map((item) => item.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("spune că nu e sigur când primele două sunt aproape la fel", () => {
    const apropiate: Reading[] = [
      { kind: "expense", score: 70, why: "x", proposal: { text: "", choices: [] } },
      { kind: "income", score: 68, why: "y", proposal: { text: "", choices: [] } },
    ];
    expect(decide(apropiate).ambiguous).toBe(true);
    expect(decide(apropiate.slice(0, 1)).ambiguous).toBe(false);
  });

  it("un mesaj gol nu produce nicio citire", () => {
    expect(understand("   ", house())).toEqual([]);
  });
});
