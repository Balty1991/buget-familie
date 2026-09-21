/**
 * Ce a învățat aplicația trebuie să se poată citi și șterge. Altfel nu e învățare,
 * e ghicit cu memorie.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { emptyGuideMemory, type GuideMemory } from "./understand";
import { forgetHabit, forgetRule, learnedRules } from "./learned-rules";

const casa = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: data.settings.members[0].id, openingBalance: 0 }];
  data.settings.salaryPlan.allocations = [{ id: "env-food", label: "Alimente", category: "Alimente", amount: 900 }];
  data.settings.merchantRules = [{ id: "rule-lidl", match: "Lidl", category: "Alimente", allocationId: "env-food" }];
  return data;
};

const memorie = (): GuideMemory => ({
  ...emptyGuideMemory(),
  phrases: [
    { key: "benzina", title: "Benzină", category: "Transport", sourceId: "card", count: 4, lastAt: "2026-09-20T10:00:00.000Z" },
    { key: "cafea", title: "Cafea", category: "Băuturi", count: 1, lastAt: "2026-09-19T10:00:00.000Z" },
  ],
});

describe("ce am învățat de la tine", () => {
  it("arată regulile scrise și obiceiurile repetate, cu numele lucrurilor din aplicație", () => {
    const rows = learnedRules(casa(), memorie());
    expect(rows.map((item) => item.id)).toEqual(["rule-lidl", "benzina"]);
    expect(rows[0]).toMatchObject({ kind: "rule", match: "Lidl", allocationLabel: "Alimente" });
    expect(rows[1]).toMatchObject({ kind: "habit", match: "Benzină", sourceLabel: "Card", count: 4 });
  });

  it("o alegere unică nu e încă un obicei", () => {
    expect(learnedRules(casa(), memorie()).some((item) => item.id === "cafea")).toBe(false);
  });

  it("regula uitată pleacă din registru, obiceiul uitat pleacă din memorie", () => {
    const data = casa();
    expect(forgetRule(data, "rule-lidl").settings.merchantRules).toEqual([]);
    expect(forgetRule(data, "inexistent")).toBe(data);
    expect(forgetHabit(memorie(), "benzina").phrases.map((item) => item.key)).toEqual(["cafea"]);
  });
});
