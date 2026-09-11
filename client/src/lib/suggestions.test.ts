import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { buildSuggestions } from "./suggestions";
import { understand } from "./understand";

const AZI = "2026-09-11";

const base = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 4000 }];
  data.settings.salaryPlan.periodStart = "2026-09-01";
  data.settings.salaryPlan.nextPayday = "2026-10-01";
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 1600, sourceId: "card", weeklyPace: false },
  ];
  data.transactions = [
    { id: "t1", title: "Lidl", amount: 240, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: me.name, memberId: me.id, date: "2026-09-08", allocationId: "env-food" },
  ];
  return data;
};

/** O sugestie pe care asistentul nu o poate răspunde e mai rea decât niciuna. */
const raspundeLa = (text: string, data: AppData) =>
  understand(text, data, { asOf: AZI }).some((item) => item.kind === "question" || item.kind === "insight" || item.kind === "intents" || item.kind === "expense" || item.kind === "income");

describe("sugestiile vin din situația reală", () => {
  it("un registru gol primește exemple de cum se vorbește cu el, nu întrebări", () => {
    const gol = createEmptyAppData();
    const out = buildSuggestions(gol, AZI);
    expect(out).toHaveLength(2);
    expect(out.every((item) => raspundeLa(item.text, gol))).toBe(true);
  });

  it("un plic aproape gol urcă în capul listei", () => {
    const data = base();
    data.transactions.push({ id: "t2", title: "Kaufland", amount: 1100, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: "Eu", memberId: data.settings.members[0].id, date: "2026-09-09", allocationId: "env-food" });
    expect(buildSuggestions(data, AZI)[0].text).toContain("Alimente");
  });

  it("salariul aproape schimbă întrebarea despre ritm", () => {
    const data = base();
    data.settings.salaryPlan.nextPayday = "2026-09-14";
    const texts = buildSuggestions(data, AZI).map((item) => item.text);
    expect(texts).toContain("Ajung până la salariu?");
    expect(texts).not.toContain("Cât pot cheltui pe zi?");
  });

  it("fără datorii nu întreabă de datorii", () => {
    expect(buildSuggestions(base(), AZI).map((item) => item.text).join(" ")).not.toMatch(/datorii/);
  });

  it("cu datorii, întreabă", () => {
    const data = base();
    data.debts = [{ id: "d1", name: "Card credit", remaining: 3400, monthly: 350 }];
    expect(buildSuggestions(data, AZI).map((item) => item.text).join(" ")).toMatch(/datorii/);
  });

  it("fără al doilea membru nu întreabă despre el", () => {
    expect(buildSuggestions(base(), AZI).map((item) => item.text).join(" ")).not.toMatch(/a cheltuit/);
  });

  it("un magazin în care intri des devine sugestie", () => {
    const data = base();
    for (const day of ["2026-09-02", "2026-09-04", "2026-09-06"]) {
      data.transactions.push({ id: `k-${day}`, title: "Profi", amount: 60, kind: "expense", category: "Alimente", source: "Card debit", sourceId: "card", person: "Eu", memberId: data.settings.members[0].id, date: day });
    }
    expect(buildSuggestions(data, AZI).map((item) => item.text).join(" ")).toContain("Profi");
  });

  it("nu repetă aceeași sugestie și nu umple ecranul", () => {
    const out = buildSuggestions(base(), AZI);
    expect(new Set(out.map((item) => item.text)).size).toBe(out.length);
    expect(out.length).toBeLessThanOrEqual(6);
  });

  it("fiecare sugestie are un motiv scris", () => {
    expect(buildSuggestions(base(), AZI).every((item) => item.why.length > 3)).toBe(true);
  });
});

describe("orice sugestie propusă primește un răspuns", () => {
  const cazuri: Array<[string, AppData]> = [
    ["gospodărie obișnuită", base()],
    ["cu datorii și obiective", (() => {
      const data = base();
      data.debts = [{ id: "d1", name: "Card credit", remaining: 3400, monthly: 350 }];
      data.savings = [{ id: "s1", name: "Concediu", current: 500, target: 5000 }];
      data.recurring = [{ id: "r1", name: "Chirie", amount: 1500, dueDay: 5, category: "Casă & facturi", sourceId: "card", memberId: "member-me", active: true }];
      return data;
    })()],
    ["familie cu doi membri", (() => {
      const data = base();
      data.settings.members.push({ id: "m2", name: "Ioana" });
      return data;
    })()],
    ["salariul peste trei zile", (() => {
      const data = base();
      data.settings.salaryPlan.nextPayday = "2026-09-14";
      return data;
    })()],
  ];

  for (const [nume, data] of cazuri) {
    it(nume, () => {
      const fara = buildSuggestions(data, AZI).filter((item) => !raspundeLa(item.text, data));
      expect(fara.map((item) => item.text)).toEqual([]);
    });
  }
});
