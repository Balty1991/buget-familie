import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, sourceBalance, sourceBalanceInCurrency, type AppData, type Transaction } from "./finance-data";
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

describe("Închide anul: runda a treia de audit", () => {
  it("nu închide anul cât timp ciclul de salariu curent a început în el", () => {
    const data = family();
    data.settings.salaryPlan.periodStart = "2025-12-25";
    data.settings.salaryPlan.nextPayday = "2026-01-25";
    expect(closableYears(data, "2026-01-05")).toEqual([]);
    data.settings.salaryPlan.periodStart = "2026-01-25";
    expect(closableYears(data, "2026-01-26")).toEqual(["2025"]);
  });

  it("o cheltuială din decembrie venită de la partener după închidere rămâne și scade soldul", () => {
    const partner = family();
    partner.transactions.push({ ...tx("late", "2025-12-30", 250), createdAt: "2025-12-30T10:00:00.000Z" });
    const expected = sourceBalance(partner, "source-debit");
    const { data: closed } = closeYear(family(), "2025", "2026-09-27");
    const merged = mergeFamilyData(closed, partner);
    expect(merged.transactions.some((item) => item.id === "late")).toBe(true);
    expect(merged.transactions.some((item) => item.id === "a")).toBe(false);
    expect(sourceBalance(merged, "source-debit")).toBe(expected);
  });

  it("o mișcare importată după închidere, cu dată din anul închis, nu dispare la repornire", () => {
    const { data: closed } = closeYear(family(), "2025", "2026-09-27");
    closed.transactions.push(tx("import", "2025-12-15", 90));
    const reloaded = normalizeAppData(JSON.parse(JSON.stringify(closed)));
    expect(reloaded.transactions.some((item) => item.id === "import")).toBe(true);
  });

  it("soldul în euro nu se schimbă după curs la închidere", () => {
    const data = family();
    data.settings.paymentSources.push({ id: "eur", name: "Revolut EUR", kind: "card", currency: "EUR", memberId: "member-me", openingBalance: 0 });
    data.settings.exchangeRates = [{ currency: "EUR", rate: 4.97, updatedAt: "2025-06-01T00:00:00.000Z" }] as AppData["settings"]["exchangeRates"];
    data.transactions.push({ ...tx("eur-in", "2025-06-01", 4970, "income", "Venit"), sourceId: "eur", originalAmount: 1000, originalCurrency: "EUR", exchangeRate: 4.97 });
    const { data: closed } = closeYear(data, "2025", "2026-09-27");
    closed.settings.exchangeRates = [{ currency: "EUR", rate: 5.1, updatedAt: "2026-09-01T00:00:00.000Z" }] as AppData["settings"]["exchangeRates"];
    expect(sourceBalanceInCurrency(closed, "eur")?.amount).toBe(1000);
  });
});
