import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { decide, emptyGuideMemory, understand, type Reading } from "./understand";
import { rememberPhrasing } from "./guide-learning";
import { WIDE_CORPUS } from "./understand.corpus-wide";

/** Aceeași gospodărie pentru tot setul: patru plicuri, trei surse, o chirie, o cheltuială. */
const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.members.push({ id: "m2", name: "Ana" });
  data.settings.paymentSources = [
    { id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 4450 },
    { id: "cash", name: "Cash", kind: "cash", memberId: me.id, openingBalance: 300 },
    { id: "tichete", name: "Bonuri de masă", kind: "meal", memberId: me.id, openingBalance: 400 },
  ];
  data.settings.salaryPlan.periodStart = "2026-09-11";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 1600, sourceId: "card", weeklyPace: true },
    { id: "env-trans", label: "Transport", category: "Transport", amount: 500, sourceId: "card", weeklyPace: true },
    { id: "env-house", label: "Casă & facturi", category: "Casă & facturi", amount: 900, sourceId: "card", weeklyPace: true },
    { id: "env-kids", label: "Copii", category: "Copii", amount: 400, sourceId: "card", weeklyPace: false },
  ];
  data.recurring = [{ id: "rec-chirie", name: "Chirie", amount: 1500, dueDay: 5, category: "Casă & facturi", sourceId: "card", memberId: me.id, active: true }];
  data.transactions = [
    { id: "tx-1", title: "Lidl", amount: 240, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-08", allocationId: "env-food" },
  ];
  return data;
};

type Got = { kind: string; amount?: number; category?: string };
const read = (reading?: Reading): Got => {
  if (!reading) return { kind: "none" };
  if (reading.kind === "intents") {
    const first = reading.intents[0].intent as Record<string, unknown>;
    return { kind: String(first.kind), amount: (first.amount ?? first.remaining ?? first.target ?? first.estimate) as number | undefined, category: first.category as string | undefined };
  }
  if ("proposal" in reading) {
    const up = (reading.proposal.choices?.[0]?.update || (reading.proposal as { spend?: unknown }).spend) as Record<string, unknown> | undefined;
    return { kind: reading.kind, amount: up?.amount as number | undefined, category: up?.category as string | undefined };
  }
  return { kind: reading.kind === "insight" || reading.kind === "question" ? "answer" : reading.kind };
};

describe("setul larg de fraze", () => {
  const results = WIDE_CORPUS.map((item) => {
    const got = read(decide(understand(item.text, house(), { asOf: "2026-09-29" })).winner);
    const ok = [item.want].flat().includes(got.kind)
      && (item.amount === undefined || got.amount === item.amount)
      && (item.category === undefined || got.category === item.category);
    return { ...item, got, ok };
  });

  it("înțelege felul, suma și categoria", () => {
    const wrong = results.filter((item) => !item.ok);
    console.log(`\nsetul larg: ${results.length - wrong.length}/${results.length}\n${wrong.map((item) => `  „${item.text}” → ${item.got.kind} ${item.got.amount ?? ""} ${item.got.category ?? ""}`).join("\n")}\n`);
    expect(wrong.filter((item) => !item.pending).map((item) => item.text)).toEqual([]);
  });

  it("nu scrie o cheltuială când omul a întrebat ceva sau a primit bani", () => {
    const dangerous = results.filter((item) => item.got.kind === "expense" && ["answer", "income", "transfer"].includes([item.want].flat()[0]));
    expect(dangerous.map((item) => item.text)).toEqual([]);
  });
});

describe("ghidul folosește ce a învățat", () => {
  it("o frază necunoscută, învățată de la model, se înțelege pe telefon", () => {
    const unknown = "am facut 40 la tombola";
    expect(read(decide(understand(unknown, house(), { asOf: "2026-09-29" })).winner).kind).not.toBe("income");
    const memory = { ...emptyGuideMemory(), learned: rememberPhrasing([], "am facut 25 la tombola", { kind: "income", amount: 25, title: "Tombolă", date: "2026-09-20" }) };
    const winner = decide(understand(unknown, house(), { asOf: "2026-09-29", memory })).winner;
    expect(read(winner)).toMatchObject({ kind: "income", amount: 40 });
    expect(winner?.why).toContain("învățat");
  });
});
