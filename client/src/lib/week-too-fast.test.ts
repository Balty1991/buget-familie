import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { weekTooFast } from "./household-insights";

const family = (spent: number, date: string) => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-01", nextPayday: "2026-10-28", paydayFlexDays: 0, allocations: [{ id: "m", label: "Mâncare", amount: 2400, category: "Alimente", weeklyPace: true, weeklyAmount: 600 }] };
  data.transactions = [{ id: "a", title: "Lidl", amount: spent, kind: "expense", category: "Alimente", source: "", person: "", date, allocationId: "m" }];
  return data;
};

describe("săptămâna merge prea repede", () => {
  it("450 din 600 în a patra zi: avertizează, cu cât mai e pe zi", () => {
    expect(weekTooFast(family(450, "2026-10-02"), "2026-10-04")[0]).toMatchObject({ weekIndex: 1, spent: 450, daysLeft: 4, perDay: 37, over: false });
  });
  it("o cumpărătură normală nu sună alarma", () => {
    expect(weekTooFast(family(250, "2026-10-02"), "2026-10-04")).toEqual([]);
    expect(weekTooFast(family(500, "2026-10-02"), "2026-10-06")).toEqual([]);
  });
  it("tranșa depășită apare mereu", () => {
    expect(weekTooFast(family(650, "2026-10-02"), "2026-10-07")[0]).toMatchObject({ over: true, remaining: -50 });
  });
});

describe("rândurile adăugate la bilanțul familiei", () => {
  it("zilele până la salariu și săptămâna care merge repede", async () => {
    const { familyWeekExtras } = await import("./household-insights");
    const lines = familyWeekExtras(family(450, "2026-10-02"), "2026-10-04");
    expect(lines[0]).toMatch(/Până la salariu: 24 de zile/);
    expect(lines[1]).toMatch(/Mâncare: 450 lei din 600 lei, cel mult 37 lei pe zi/);
  });
});
