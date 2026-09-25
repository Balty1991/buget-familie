import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { analyze } from "./analyst";

const family = () => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-01", nextPayday: "2026-10-28", paydayFlexDays: 0, allocations: [
    { id: "m", label: "Mâncare", amount: 2400, category: "Alimente", weeklyPace: true, weeklyAmount: 600 },
    { id: "t", label: "Taxi", amount: 500, category: "Transport", weeklyPace: false },
  ] };
  data.transactions = [
    { id: "a", title: "Lidl", amount: 450, kind: "expense", category: "Alimente", source: "", person: "", date: "2026-10-02", allocationId: "m" },
    { id: "b", title: "Bolt", amount: 120, kind: "expense", category: "Transport", source: "", person: "", date: "2026-10-03", allocationId: "t" },
  ];
  return data;
};

describe("ghidul și plicurile", () => {
  it("„cât mai am la mâncare?” răspunde din săptămâna în curs și din plic", () => {
    const answer = analyze("cât mai am la mâncare?", family(), "2026-10-04")!;
    expect(answer.kind).toBe("envelope-left");
    expect(answer.headline).toMatch(/Mâncare: mai ai 150 RON săptămâna asta \(S1\) și 1\.950 RON în tot plicul/);
    expect(answer.detail).toMatch(/azi poți da cel mult 37,50 RON/);
    expect(answer.detail).toMatch(/Mai sunt 24 de zile până la salariu/);
  });
  it("„cât pot cheltui azi pe taxi?” împarte ce a rămas până la salariu", () => {
    const answer = analyze("cât pot cheltui azi pe taxi?", family(), "2026-10-04")!;
    expect(answer.kind).toBe("envelope-left");
    expect(answer.headline).toMatch(/Taxi: mai ai 380 RON din 500 RON/);
    expect(answer.detail).toMatch(/cam 15 RON pe zi/);
  });
  it("fără plic numit, rămâne răspunsul general", () => {
    expect(analyze("cât pot cheltui azi?", family(), "2026-10-04")?.kind).not.toBe("envelope-left");
  });
});

describe("prin ghid", () => {
  it("întrebarea ajunge la răspunsul plicului, nu la o cheltuială", async () => {
    const { understand } = await import("./understand");
    const top = understand("cât mai am la mâncare?", family(), { asOf: "2026-10-04" }).sort((a, b) => b.score - a.score)[0];
    expect(top.kind).toBe("question");
    expect(top.kind === "question" && top.answer.kind).toBe("envelope-left");
  });
});
