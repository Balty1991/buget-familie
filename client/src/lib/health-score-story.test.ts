import { describe, expect, it } from "vitest";
import { createEmptyAppData, healthScoreStory } from "./finance-data";

describe("povestea scorului pe cicluri", () => {
  it("întoarce o serie pe cicluri și scorul curent", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources[0].openingBalance = 4000;
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: "2026-08-25",
      nextPayday: "2026-09-25",
      allocations: [{ id: "a1", label: "Alimente", category: "Alimente", amount: 800 }],
    };
    data.transactions = [{
      id: "t1", title: "Lidl", amount: 200, kind: "expense", category: "Alimente",
      source: "Card", sourceId: "source-debit", person: "Eu", memberId: "member-me", date: "2026-09-10",
    }];
    const story = healthScoreStory(data, "2026-09-12", 3);
    expect(story.series).toHaveLength(3);
    expect(story.current.score === null || story.current.score >= 0).toBe(true);
    expect(story.series.at(-1)?.label).toBeTruthy();
  });
});
