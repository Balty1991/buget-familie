import { describe, expect, it } from "vitest";
import { createEmptyAppData, guessAllocationFromText, guessCategoryFromText, matchMerchantRule } from "./finance-data";
import { statementDrafts } from "./statement-import";

describe("reguli locale comerciant", () => {
  it("matchMerchantRule găsește textul în titlu", () => {
    const rule = matchMerchantRule("Plata Glovo seara", [
      { id: "1", match: "glovo", category: "Alimente" },
    ]);
    expect(rule?.category).toBe("Alimente");
  });

  it("guessCategoryFromText prioritează regula utilizatorului", () => {
    expect(guessCategoryFromText("ENEL factură", expenseCats(), [
      { id: "1", match: "enel", category: "Casă & facturi" },
    ])).toBe("Casă & facturi");
  });

  it("statementDrafts aplică regula și plicul", () => {
    const data = createEmptyAppData();
    data.settings.merchantRules = [{ id: "r1", match: "starbucks", category: "Băuturi", allocationId: "env-drinks" }];
    data.settings.salaryPlan.allocations = [
      { id: "env-drinks", label: "Băuturi", category: "Băuturi", amount: 200, sourceId: "source-debit" },
    ];
    const { drafts } = statementDrafts(data, [
      { line: 2, date: "2026-09-10", description: "STARBUCKS RO", amount: 18, kind: "expense" },
    ], { sourceId: "source-debit", memberId: "member-me", fileName: "extras.csv" });
    expect(drafts[0].transaction.category).toBe("Băuturi");
    expect(drafts[0].transaction.allocationId).toBe("env-drinks");
    expect(guessAllocationFromText(data, "Starbucks")).toBe("env-drinks");
  });
});

const expenseCats = () => ["Alimente", "Băuturi", "Casă & facturi", "Transport", "Altele"];
