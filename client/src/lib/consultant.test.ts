import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { consultContext, consultReady, consultTeaser, groundReport } from "./consultant";

const tx = (id: string, date: string, amount: number, kind: "income" | "expense", category = "Alimente", extra: Partial<Transaction> = {}): Transaction => ({ id, title: `Kaufland Ana ${id}`, amount, kind, category, source: "Card", person: "Ana", date, note: "nota secretă", ...extra });

describe("consultantul financiar", () => {
  const data = createEmptyAppData();
  data.transactions = [
    tx("s1", "2026-09-05", 5000, "income", "Salariu"),
    tx("a1", "2026-09-10", 400, "expense"),
    tx("a2", "2026-10-02", 300, "expense"),
    tx("t1", "2026-10-03", 1000, "expense", "Altele", { transferId: "pair" }),
    tx("f1", "2026-10-20", 999, "expense"),
  ];
  data.debts = [{ id: "d", name: "Credit la Ion", remaining: 8000, monthly: 500, due: "", tone: "coral" }];

  it("trimite doar cifre și categorii, fără titluri, notițe sau nume", () => {
    const context = consultContext(data, "2026-10-08");
    const text = JSON.stringify(context);
    expect(text).not.toMatch(/Kaufland|Ana|secret|Ion/);
    expect(context.month.expense).toBe(300);
    expect(context.previousMonths).toEqual([{ month: "2026-09", income: 5000, expense: 400 }]);
    expect(context.categories[0]).toEqual({ name: "Alimente", thisMonth: 300, monthlyAverage: 400 });
    expect(context.debts).toEqual([{ kind: "credit", remaining: 8000, monthly: 500 }]);
  });

  it("nu lasă pași mai mari decât venitul lunar", () => {
    const context = consultContext(data, "2026-10-08");
    const report = groundReport({ headline: "x", status: "bine", summary: "y", watch: [], praise: "", actions: [{ title: "a", detail: "", amount: 300 }, { title: "b", detail: "", amount: 90000 }] }, context);
    expect(report.actions.map((action) => action.amount)).toEqual([300, 0]);
  });

  it("cere câteva zile de mișcări înainte de raport", () => {
    expect(consultReady(data, "2026-10-08")).toBe(false);
  });

  it("dă o primă frază calculată pe telefon pentru cine nu are Familia", () => {
    const teaser = consultTeaser(data, "2026-10-08");
    expect(teaser).toMatch(/luna se încheie/);
    expect(teaser).toMatch(/media lunilor trecute/);
  });
});
