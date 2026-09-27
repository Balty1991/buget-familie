import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, sourceBalance, type AppData, type Transaction } from "./finance-data";
import { closableYears, closeYear } from "./year-close";
import { mergeFamilyData } from "./family-crypto";

const tx = (id: string, date: string, amount: number, kind: "income" | "expense" = "expense", category = "Alimente"): Transaction => ({ id, title: id, amount, kind, category, source: "Card", sourceId: "source-debit", person: "Eu", memberId: "member-me", date });

const family = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = data.settings.paymentSources.map((item) => item.id === "source-debit" ? { ...item, openingBalance: 1000 } : item);
  data.transactions = [tx("a", "2025-03-02", 5000, "income", "Venit"), tx("b", "2025-03-05", 800), tx("c", "2025-11-20", 200, "expense", "Transport"), tx("d", "2026-01-04", 100)];
  return data;
};

describe("Închide anul", () => {
  it("scoate mișcările anului, păstrează soldul și rezumatul pe luni", () => {
    const data = family();
    expect(closableYears(data, "2026-09-27")).toEqual(["2025"]);
    const before = sourceBalance(data, "source-debit");
    const { data: closed, archive } = closeYear(data, "2025", "2026-09-27");
    expect(archive.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(closed.transactions.map((item) => item.id)).toEqual(["d"]);
    expect(sourceBalance(closed, "source-debit")).toBe(before);
    const summary = closed.settings.yearSummaries![0];
    expect(summary).toMatchObject({ year: "2025", count: 3, income: 5000, expense: 1000 });
    expect(summary.months.find((item) => item.month === "2025-11")?.categories.Transport).toBe(200);
    expect(closableYears(closed, "2026-09-27")).toEqual([]);
  });

  it("anul în curs nu se poate închide", () => {
    expect(closeYear(family(), "2026", "2026-09-27").archive).toEqual([]);
  });

  it("supraviețuiește normalizării și nu primește înapoi mișcările de la alt telefon", () => {
    const other = family();
    const { data: closed } = closeYear(family(), "2025", "2026-09-27");
    const normalized = normalizeAppData(JSON.parse(JSON.stringify(closed)));
    expect(normalized.settings.archivedThrough).toBe("2025-12-31");
    expect(sourceBalance(normalized, "source-debit")).toBe(sourceBalance(other, "source-debit"));
    const merged = mergeFamilyData(other, normalized);
    expect(merged.transactions.map((item) => item.id)).toEqual(["d"]);
    expect(merged.settings.archivedThrough).toBe("2025-12-31");
    expect(sourceBalance(merged, "source-debit")).toBe(sourceBalance(other, "source-debit"));
  });
});
