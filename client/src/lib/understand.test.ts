import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { decide, understand, compactGuideContext, shouldAskWhichReading, readingLabel, expenseProposal, emptyGuideMemory, canCommitGuideSpend, isDatedSpendChoice, type Reading } from "./understand";
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

describe("ce pleacă către model", () => {
  it("nu conține mișcările din jurnal", () => {
    const ctx = compactGuideContext(house(), { view: "today", income: 0, expense: 290 });
    const dumped = JSON.stringify(ctx);
    expect(dumped).not.toMatch(/Lidl|Taxi/);
    expect(ctx.envelopes.some((item) => item.label === "Alimente")).toBe(true);
    expect(ctx.members).toContain("Soția");
  });

  it("când e nesigur, trebuie întrebat — nu scris tăcut", () => {
    const expense: Reading = { kind: "expense", score: 70, why: "x", proposal: { text: "", choices: [] } };
    const income: Reading = { kind: "income", score: 68, why: "y", proposal: { text: "", choices: [] } };
    expect(shouldAskWhichReading(expense, income)).toBe(true);
    expect(readingLabel(expense)).toBe("Cheltuială");
  });

  it("două citiri de răspuns nu cer o alegere", () => {
    const question: Reading = { kind: "question", score: 80, why: "q", answer: { kind: "next", headline: "x" } };
    const insight: Reading = { kind: "insight", score: 72, why: "i", text: "y" };
    expect(shouldAskWhichReading(question, insight)).toBe(false);
  });
});

describe("cheltuiala din ghid iese din plic, nu din nealocat", () => {
  const tight = (): AppData => {
    const data = createEmptyAppData();
    const me = data.settings.members[0];
    data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 0 }];
    data.settings.salaryPlan.periodStart = "2026-09-12";
    data.settings.salaryPlan.nextPayday = "2026-09-25";
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 500, sourceId: "card", memberId: me.id, weeklyPace: true },
    ];
    data.transactions = [
      { id: "tx-in", title: "Venit rapid", amount: 500, kind: "income", category: "Venit", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-13" },
    ];
    return data;
  };

  it("nu oferă „nealocat” când cei 500 sunt deja în plic", () => {
    const out = expenseProposal("cheltuieli taxi 20 lei", undefined, tight(), emptyGuideMemory(), true);
    expect(out).toBeTruthy();
    expect(out!.choices.map((item) => item.label).join(" | ")).not.toMatch(/nealocat/i);
    expect(out!.choices.every((item) => item.update.kind === "expense" && item.update.allocationId === "env-food")).toBe(true);
  });

  it("oferă ambele săptămâni ale plicului", () => {
    const out = expenseProposal("cheltuieli taxi 20 lei", undefined, tight(), emptyGuideMemory(), true);
    const labels = out?.choices.map((item) => item.label) || [];
    expect(labels.some((label) => /Alimente · S1/.test(label))).toBe(true);
    expect(labels.some((label) => /Alimente · S2/.test(label))).toBe(true);
  });
});

describe("ghidul pe bon spune doar totalul", () => {
  it("la bon, ghidul spune doar totalul și categoria, nu lista de produse", () => {
    const out = expenseProposal("Analizează bonul atașat.", {
      amount: 15.5,
      vendor: "PEPCO",
      title: "PEPCO",
      category: "Timp liber",
      receiptLines: [{ name: "CIORAPI", amount: 6 }, { name: "HANORAC", amount: 9.5 }],
    }, createEmptyAppData(), emptyGuideMemory(), true);
    expect(out?.text).toMatch(/15[,.]50/);
    expect(out?.text).toMatch(/Timp liber/);
    expect(out?.text).toMatch(/Bonuri/);
    expect(out?.text).not.toMatch(/CIORAPI/);
    expect(out?.text).not.toMatch(/HANORAC/);
  });
});

describe("ghidul salvează cheltuiala doar după plic și zi", () => {
  it("nu scrie dacă ai atins doar plicul sau doar ziua", () => {
    expect(canCommitGuideSpend(true, false)).toBe(false);
    expect(canCommitGuideSpend(false, true)).toBe(false);
    expect(canCommitGuideSpend(false, false)).toBe(false);
    expect(canCommitGuideSpend(true, true)).toBe(true);
  });

  it("plicul și venitul cer ziua; un transfer nu", () => {
    expect(isDatedSpendChoice({ label: "Din Alimente", update: { kind: "expense", amount: 10, title: "Taxi", category: "Transport" } })).toBe(true);
    expect(isDatedSpendChoice({ label: "Mută", update: { kind: "transfer", amount: 10, fromId: "a", toId: "b", fromLabel: "A", toLabel: "B" } })).toBe(false);
  });
});
