import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, parseRomanianAmount, sourceBalance, allocationStatus, planForecast, calculateHealthScore, newId, type AppData } from "./finance-data";

const src = (d: AppData) => d.settings.paymentSources[0];
const tx = (d: AppData, over: Partial<AppData["transactions"][0]>) => ({
  id: newId("tx"), title: "X", amount: 10, kind: "expense" as const, category: "Alimente",
  source: src(d).name, sourceId: src(d).id, person: d.settings.members[0].name,
  memberId: d.settings.members[0].id, date: "2026-09-05", ...over,
});

describe("sume scrise de om", () => {
  const cases: Array<[unknown, number]> = [
    ["1.234,56", 1234.56], ["1234.56", 1234.56], ["1 234,56", 1234.56],
    ["1,5", 1.5], ["-50", -50], ["abc", 0], ["", 0], [null, 0], [undefined, 0],
    ["12,345", 12.345], ["1.000", 1000], ["  99  ", 99], [NaN, 0], [Infinity, 0],
  ];
  for (const [input, expected] of cases) {
    it(`„${String(input)}” → ${expected}`, () => expect(parseRomanianAmount(input)).toBeCloseTo(expected, 3));
  }
});

describe("date ostile nu rup registrul", () => {
  it("o sumă negativă nu creează bani din aer", () => {
    const d = createEmptyAppData();
    d.transactions = [tx(d, { amount: -500, kind: "income" })];
    const clean = normalizeAppData(d);
    expect(clean.transactions[0].amount).toBeGreaterThanOrEqual(0);
    expect(sourceBalance(clean, src(clean).id)).toBeGreaterThanOrEqual(0);
  });

  it("o dată imposibilă este înlocuită, nu propagată", () => {
    const d = createEmptyAppData();
    d.transactions = [tx(d, { date: "2026-13-45" })];
    const clean = normalizeAppData(d);
    expect(clean.transactions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(new Date(clean.transactions[0].date).getTime())).toBe(false);
  });

  it("un plic cu buget zero nu face împărțire la zero", () => {
    const d = createEmptyAppData();
    d.settings.salaryPlan.periodStart = "2026-08-25";
    d.settings.salaryPlan.nextPayday = "2026-09-25";
    d.settings.salaryPlan.allocations = [{ id: "a", label: "Gol", category: "Alimente", amount: 0, sourceId: src(d).id }];
    d.transactions = [tx(d, { amount: 100 })];
    const status = allocationStatus(d, d.settings.salaryPlan.allocations[0]);
    expect(Number.isFinite(status.usage)).toBe(true);
    expect(Number.isFinite(status.remaining)).toBe(true);
  });

  it("o sumă uriașă nu devine NaN sau Infinity", () => {
    const d = createEmptyAppData();
    d.transactions = [tx(d, { amount: 9e15, kind: "income" })];
    const clean = normalizeAppData(d);
    const balance = sourceBalance(clean, src(clean).id);
    expect(Number.isFinite(balance)).toBe(true);
  });

  it("un plan fără venit stabilit nu produce ritm infinit", () => {
    const d = createEmptyAppData();
    d.transactions = [tx(d, { amount: 100 })];
    const forecast = planForecast(d, "2026-09-11");
    for (const [key, value] of Object.entries(forecast)) {
      if (typeof value === "number") expect(Number.isFinite(value), `${key} = ${value}`).toBe(true);
    }
  });

  it("scorul rămâne între 0 și 100 oricât s-ar cheltui peste", () => {
    const d = createEmptyAppData();
    d.settings.salaryPlan.periodStart = "2026-08-25";
    d.settings.salaryPlan.nextPayday = "2026-09-25";
    d.settings.salaryPlan.allocations = [{ id: "a", label: "A", category: "Alimente", amount: 100, sourceId: src(d).id }];
    d.transactions = [tx(d, { amount: 999999 })];
    const h = calculateHealthScore(d, "2026-09-11");
    expect(h.score === null || (h.score >= 0 && h.score <= 100)).toBe(true);
  });

  it("un nume foarte lung nu sparge normalizarea", () => {
    const d = createEmptyAppData();
    d.transactions = [tx(d, { title: "x".repeat(5000) })];
    expect(() => normalizeAppData(d)).not.toThrow();
  });

  it("o listă coruptă (null în mijloc) nu aruncă și nu păstrează gunoi", () => {
    const d = createEmptyAppData() as unknown as Record<string, unknown>;
    d.transactions = [null, undefined, { id: "ok", title: "Pâine", amount: 12, kind: "expense", category: "Alimente", date: "2026-09-05" }];
    const clean = normalizeAppData(d);
    // Rândurile nule dispar; nu devin mișcări fantomă „Mișcare — 0 RON”.
    expect(clean.transactions).toHaveLength(1);
    expect(clean.transactions[0].title).toBe("Pâine");
  });

  it("o mișcare fără sumă nu pierde restul importului", () => {
    const d = createEmptyAppData() as unknown as Record<string, unknown>;
    d.transactions = [
      { id: "bad", title: "Fără sumă", kind: "expense", category: "Alimente", date: "2026-09-04" },
      { id: "good", title: "Lidl", amount: "240,50", kind: "expense", category: "Alimente", date: "2026-09-05" },
    ];
    const clean = normalizeAppData(d);
    expect(clean.transactions.find((item) => item.id === "good")?.amount).toBeCloseTo(240.5, 2);
    expect(clean.transactions.find((item) => item.id === "bad")?.amount).toBe(0);
  });
});
