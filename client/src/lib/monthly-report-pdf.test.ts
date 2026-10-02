import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { monthlyReportModel } from "./monthly-report-pdf";

const tx = (id: string, date: string, category: string, amount: number, kind: "expense" | "income" = "expense", memberId = "m1", extra = {}) => ({ id, date, title: id, category, amount, kind, memberId, person: memberId, sourceId: "s", source: "Card", ...extra });

describe("raportul lunar", () => {
  const data = createEmptyAppData();
  data.settings.members = [{ id: "m1", name: "Andrei" }, { id: "m2", name: "Maria" }] as typeof data.settings.members;
  data.transactions = [
    tx("salariu", "2026-09-10", "Salariu", 5000, "income"),
    tx("lidl", "2026-09-12", "Alimente", 300),
    tx("omv", "2026-09-14", "Transport", 200, "expense", "m2"),
    tx("ajustare", "2026-09-15", "Altele", 999, "expense", "m1", { adjustment: true }),
    tx("august", "2026-08-12", "Alimente", 400),
  ] as typeof data.transactions;

  it("adună luna, pe categorii, față de luna trecută, fără ajustări", () => {
    const model = monthlyReportModel(data, "2026-09");
    expect(model.income).toBe(5000);
    expect(model.expense).toBe(500);
    expect(model.cashflow).toBe(4500);
    expect(model.priorExpense).toBe(400);
    expect(model.categories.map((item) => [item.name, item.amount, item.prior])).toEqual([["Alimente", 300, 400], ["Transport", 200, 0]]);
    expect(model.moves.map((item) => item.id)).not.toContain("ajustare");
    expect(model.title).toMatch(/2026/);
  });

  it("pentru un singur membru, doar mișcările lui", () => {
    const model = monthlyReportModel(data, "2026-09", "m2");
    expect(model.expense).toBe(200);
    expect(model.perspective).toBe("Maria");
    expect(model.envelopes).toEqual([]);
  });
});
