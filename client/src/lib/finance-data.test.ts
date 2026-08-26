import { describe, expect, it } from "vitest";
import { allocationSpent, autoPostDueRecurring, createEmptyAppData, isoToday, normalizeAppData, parseNaturalSpendScenario, parseRomanianAmount, pendingRecurringInPlan, planForecast, savingSuggestions, sourceBalance } from "./finance-data";
import { mergeFamilyData } from "./github-sync";
import { parseReceiptItems } from "./receipt-utils";

describe("registrul financiar Buget Familie", () => {
  it("interpretează sumele românești cu punct pentru mii și virgulă zecimală", () => {
    expect(parseRomanianAmount("1.234,50")).toBe(1234.5);
    expect(parseRomanianAmount("7 400,00")).toBe(7400);
    expect(parseRomanianAmount("abc")).toBe(0);
  });

  it("derivă soldul sursei din soldul inițial și mișcări", () => {
    const data = createEmptyAppData();
    const source = data.settings.paymentSources[0];
    source.openingBalance = 1000;
    data.transactions = [
      { id: "income", title: "Venit", amount: 500, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-02" },
      { id: "expense", title: "Taxă", amount: 200, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-03" },
    ];
    expect(sourceBalance(data, source.id)).toBe(1300);
  });

  it("calculează cheltuiala pentru alocarea de categorie doar în perioada activă", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-10", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [] };
    const source = data.settings.paymentSources[0];
    data.transactions = [
      { id: "1", title: "Taxi", amount: 100, kind: "expense", category: "Taxi", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-04" },
      { id: "2", title: "Taxi vechi", amount: 75, kind: "expense", category: "Taxi", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-28" },
    ];
    expect(allocationSpent(data, { id: "a", label: "Taxi", amount: 200, category: "Taxi" })).toBe(100);
  });

  it("consumă plicul de transport numai din sursa aleasă", () => {
    const data = createEmptyAppData(); const [card, cash] = data.settings.paymentSources;
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-10", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [] };
    data.transactions = [
      { id: "card-taxi", title: "Taxi card", amount: 120, kind: "expense", category: "Transport", sourceId: card.id, source: card.name, memberId: "member-me", person: "Eu", date: "2026-08-04" },
      { id: "cash-taxi", title: "Taxi cash", amount: 80, kind: "expense", category: "Transport", sourceId: cash.id, source: cash.name, memberId: "member-me", person: "Eu", date: "2026-08-05" },
    ];
    expect(allocationSpent(data, { id: "transport-card", label: "Transport", amount: 500, category: "Transport", sourceId: card.id, note: "Taxi până la venit" })).toBe(120);
  });

  it("migrează o dată veche ne-normalizată într-un format ISO", () => {
    const migrated = normalizeAppData({ version: 5, transactions: [{ id: "legacy", title: "Bon", amount: 20, kind: "expense", category: "Alimente", source: "Bon", person: "Eu", date: "26 aug." }], settings: {} });
    expect(migrated.version).toBe(8);
    expect(migrated.transactions[0].date).toBe(isoToday());
    expect(migrated.transactions[0].sourceId).toBe(migrated.settings.paymentSources.find((source) => source.kind === "meal")?.id);
    expect(migrated.deleted).toEqual([]);
  });

  it("rezervă o scadență activă și o scoate din plan după confirmarea plății", () => {
    const data = createEmptyAppData();
    const source = data.settings.paymentSources[0];
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-20", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [] };
    data.recurring = [{ id: "internet", name: "Internet", amount: 60, category: "Casă & facturi", sourceId: source.id, memberId: "member-me", dueDay: 15, active: true }];
    expect(pendingRecurringInPlan(data)).toHaveLength(1);
    data.transactions = [{ id: "paid", recurringId: "internet", title: "Internet", amount: 60, kind: "expense", category: "Casă & facturi", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-15" }];
    expect(pendingRecurringInPlan(data)).toHaveLength(0);
  });

  it("adaugă automat o scadență o singură dată și adaptează ziua 31 la februarie", () => {
    const data = createEmptyAppData(); const source = data.settings.paymentSources[0];
    data.recurring = [{ id: "rent", name: "Chirie", amount: 1800, category: "Casă & facturi", sourceId: source.id, memberId: "member-me", dueDay: 31, active: true, autoPost: true }];
    const posted = autoPostDueRecurring(data, "2026-02-28");
    expect(posted.transactions).toHaveLength(1); expect(posted.transactions[0]).toMatchObject({ id: "recurring-auto-rent-2026-02-28", recurringId: "rent", date: "2026-02-28", amount: 1800 });
    expect(autoPostDueRecurring(posted, "2026-02-28").transactions).toHaveLength(1);
  });

  it("proiectează explicit ritmul actual până la următorul venit", () => {
    const data = createEmptyAppData();
    const source = data.settings.paymentSources[0];
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-10", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [] };
    data.transactions = [
      { id: "pace-1", title: "Alimente", amount: 100, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-01" },
      { id: "pace-2", title: "Transport", amount: 100, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-02" },
    ];
    const forecast = planForecast(data, "2026-08-02");
    expect(forecast.paceDaily).toBe(100);
    expect(forecast.projectedExpenses).toBe(1000);
    expect(forecast.projectedRemaining).toBe(0);
    expect(forecast.safeDaily).toBeCloseTo(88.8889, 3);
  });

  it("interpretează local o cheltuială descrisă în limbaj natural", () => {
    expect(parseNaturalSpendScenario("Dacă plătesc 120 lei pe taxi mâine")).toMatchObject({ amount: 120, category: "Transport", timing: "mâine", understood: true });
    expect(parseNaturalSpendScenario("o cafea mâine")).toMatchObject({ amount: 0, category: "Băuturi", understood: false });
  });

  it("propune economisire doar din plan și mișcările reale", () => {
    const data = createEmptyAppData(); const source = data.settings.paymentSources[0];
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-10", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [] };
    data.transactions = [{ id: "food", title: "Alimente", amount: 400, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-02" }];
    const suggestions = savingSuggestions(data, "2026-08-02");
    expect(suggestions.some((item) => item.id === "category" && item.potential === 40)).toBe(true);
    expect(suggestions.some((item) => item.id === "pace")).toBe(true);
  });

  it("unește modificările a două telefoane și păstrează ștergerile recente", () => {
    const local = createEmptyAppData(); const remote = createEmptyAppData(); const source = local.settings.paymentSources[0];
    local.transactions = [{ id: "local", title: "Taxi", amount: 25, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-10", updatedAt: "2026-08-10T09:00:00.000Z" }];
    remote.savings = [{ id: "goal", name: "Vacanță", current: 100, target: 1000, due: "Decembrie", tone: "honey", updatedAt: "2026-08-10T10:00:00.000Z" }];
    remote.transactions = [{ id: "deleted", title: "Dublură", amount: 10, kind: "expense", category: "Altele", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-10", updatedAt: "2026-08-10T09:00:00.000Z" }];
    local.deleted = [{ entity: "transactions", id: "deleted", deletedAt: "2026-08-10T11:00:00.000Z" }];
    const merged = mergeFamilyData(local, remote);
    expect(merged.transactions.map((item) => item.id)).toEqual(["local"]);
    expect(merged.savings.map((item) => item.id)).toEqual(["goal"]);
    expect(merged.deleted).toHaveLength(1);
  });

  it("propune produse și prețuri individuale, fără totaluri sau plăți", () => {
    const items = parseReceiptItems(["LAPTE 1.5% 7,49", "APA MINERALA 2 x 3,50 7,00", "DETergent 18,99", "TOTAL 33,48", "CARD 33,48"]);
    expect(items).toEqual([{ label: "LAPTE 1.5%", amount: 7.49, category: "Alimente", raw: "LAPTE 1.5% 7,49" }, { label: "APA MINERALA", amount: 7, category: "Băuturi", raw: "APA MINERALA 2 x 3,50 7,00" }, { label: "DETergent", amount: 18.99, category: "Casă & facturi", raw: "DETergent 18,99" }]);
  });
});
