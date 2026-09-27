import { describe, expect, it } from "vitest";
import { createEmptyAppData, recordDebtPayment, type AppData } from "@/lib/finance-data";
import { mergeFamilyData, syncBaseOf } from "@/lib/family-crypto";

const shared = (): AppData => {
  const data = createEmptyAppData();
  data.debts = [{ id: "card", name: "Card de credit", remaining: 10000, monthly: 500, dueDay: 15, updatedAt: "2026-09-01T10:00:00.000Z" } as never];
  return data;
};

describe("R4: două plăți la aceeași datorie, pe telefoane diferite", () => {
  it("soldul datoriei scade cu ambele plăți", async () => {
    const base = syncBaseOf(shared());
    const a = recordDebtPayment(shared(), { debtId: "card", amount: 500, sourceId: "source-debit", memberId: "member-me" })!;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = recordDebtPayment(shared(), { debtId: "card", amount: 300, sourceId: "source-cash", memberId: "member-me" })!;
    const merged = mergeFamilyData(a, b, base);
    expect(merged.transactions.filter((item) => item.debtId === "card")).toHaveLength(2);
    expect(merged.debts[0].remaining).toBe(9200); // primit: 9700 (câștigă ultima scriere, plata de 500 nu mai scade)
  });
});
