import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { yearRecap } from "./year-recap";
import { yearStoryExtras } from "./year-story";

let n = 0;
const tx = (date: string, amount: number, kind: "income" | "expense" = "expense", extra: Partial<Transaction> = {}) => ({ id: `t${++n}`, date, amount, kind, category: "Alimente", title: "Lidl", sourceId: "card", source: "Card", person: "A", ...extra }) as Transaction;

describe("povestea anului: ce mai spune", () => {
  it("datorii plătite, obiective atinse, cea mai mare cheltuială și personalitatea", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", openingBalance: 0 }];
    data.transactions = [tx("2026-03-02", 5000, "income"), tx("2026-03-03", 1200), tx("2026-03-04", 300), tx("2026-03-05", 1000, "expense", { debtId: "d" }), tx("2025-12-31", 9000)];
    data.savings = [{ id: "a", name: "Vacanță", current: 3000, target: 3000, due: "", tone: "forest" }, { id: "b", name: "Mașină", current: 500, target: 10000, due: "", tone: "forest" }];
    const recap = yearRecap(data.transactions, 2026, "2026-10-03");
    const extras = yearStoryExtras(data, recap, "2026-10-03");
    expect(extras.debtPaid).toBe(1000);
    expect(extras.goalsReached).toEqual(["Vacanță"]);
    expect(extras.goalsSaved).toBe(3500);
    expect(extras.biggest?.amount).toBe(1200);
    // 2 martie 2026 e luni; 3 martie, marți: cea mai scumpă zi.
    expect(extras.priciestWeekday).toBe(1);
    expect(extras.persona).toBe("savers");
  });
});
