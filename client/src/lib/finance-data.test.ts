import { describe, expect, it } from "vitest";
import { allocationBudget, allocationSpent, allocationStatus, answerBudgetQuestion, autoPostDueRecurring, createEmptyAppData, financialBalance, inPlanPeriod, isoToday, normalizeAppData, parseNaturalSpendScenario, parseRomanianAmount, pendingRecurringInPlan, planForecast, recordDebtPayment, savingSuggestions, sourceBalance } from "./finance-data";
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

  it("separă fluxul perioadei de ratele declarate și datoria rămasă în bilanț", () => {
    const data = createEmptyAppData(); const source = data.settings.paymentSources[0]; source.openingBalance = 1000;
    data.transactions = [{ id: "income", title: "Salariu", amount: 3000, kind: "income", category: "Venit", source: source.name, sourceId: source.id, person: "Eu", memberId: "member-me", date: "2026-08-01" }, { id: "expense", title: "Alimente", amount: 900, kind: "expense", category: "Alimente", source: source.name, sourceId: source.id, person: "Eu", memberId: "member-me", date: "2026-08-02" }];
    data.debts = [{ id: "loan", name: "Credit", remaining: 38000, monthly: 650, due: "29 august" }]; data.savings = [{ id: "fund", name: "Fond", current: 2000, target: 5000, due: "Decembrie", tone: "honey" }];
    expect(financialBalance(data, "2026-08-01", "2026-08-31")).toMatchObject({ income: 3000, expense: 900, cashflow: 2100, monthlyRates: 650, debtRemaining: 38000, savingsCurrent: 2000, liquidFunds: 3100, netLiquidPosition: -34900 });
  });

  it("înregistrează plata unei rate și reduce exact datoria aleasă, fără a depăși soldul rămas", () => {
    const data = createEmptyAppData(); const source = data.settings.paymentSources[0]; source.openingBalance = 1200;
    data.debts = [{ id: "credit", name: "Credit auto", remaining: 1000, monthly: 400, due: "28 august", tone: "coral" }];
    const paid = recordDebtPayment(data, { debtId: "credit", amount: 400, sourceId: source.id, memberId: "member-me", date: "2026-08-27" });
    expect(paid?.debts[0].remaining).toBe(600);
    expect(paid?.transactions[0]).toMatchObject({ kind: "expense", category: "Rate produse", amount: 400, sourceId: source.id, memberId: "member-me" });
    expect(sourceBalance(paid!, source.id)).toBe(800);
    expect(recordDebtPayment(paid!, { debtId: "credit", amount: 601, sourceId: source.id, memberId: "member-me" })).toBeUndefined();
    paid!.settings.members.push({ id: "member-wife", name: "Soție" });
    expect(recordDebtPayment(paid!, { debtId: "credit", amount: 100, sourceId: source.id, memberId: "member-wife" })).toBeUndefined();
    const finalPayment = recordDebtPayment(paid!, { debtId: "credit", amount: 600, sourceId: source.id, memberId: "member-me" });
    expect(finalPayment?.debts[0].remaining).toBe(0);
  });

  it("filtrează bilanțul pe membru, incluzând doar sursele și obligațiile personale sau comune", () => {
    const data = createEmptyAppData(); data.settings.members.push({ id: "member-partner", name: "Soție" });
    data.settings.paymentSources.push({ id: "source-partner", name: "Card soție", kind: "card", memberId: "member-partner", openingBalance: 500 });
    data.transactions = [{ id: "me-expense", title: "Taxi", amount: 100, kind: "expense", category: "Transport", sourceId: "source-debit", source: "Card debit", memberId: "member-me", person: "Eu", date: "2026-08-10" }, { id: "partner-income", title: "Venit", amount: 700, kind: "income", category: "Venit", sourceId: "source-partner", source: "Card soție", memberId: "member-partner", person: "Soție", date: "2026-08-10" }];
    data.debts = [{ id: "me-debt", name: "Rată eu", remaining: 200, monthly: 50, due: "28 august", memberId: "member-me", tone: "coral" }, { id: "shared", name: "Chirie", remaining: 400, monthly: 100, due: "1 septembrie", tone: "coral" }];
    const mine = financialBalance(data, undefined, undefined, "member-me");
    expect(mine).toMatchObject({ income: 0, expense: 100, debtRemaining: 600, monthlyRates: 150, liquidFunds: -100 });
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

  it("separă plicurile de transport pe membri", () => {
    const data = createEmptyAppData(); const [card] = data.settings.paymentSources;
    const wife = { id: "member-wife", name: "Soție" }; data.settings.members.push(wife);
    const mine = { id: "transport-me", label: "Transport · Eu", amount: 70, category: "Transport", memberId: "member-me", sourceId: card.id };
    const hers = { id: "transport-wife", label: "Transport · Soție", amount: 430, category: "Transport", memberId: wife.id, sourceId: card.id };
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-31", sourceIds: [], totalLimit: 500, weeklyLimit: 0, allocations: [mine, hers], transfers: [] };
    data.transactions = [{ id: "wife-taxi", title: "Taxi soție", amount: 60, kind: "expense", category: "Transport", sourceId: card.id, source: card.name, memberId: wife.id, person: wife.name, date: "2026-08-04" }, { id: "my-taxi", title: "Taxi eu", amount: 15, kind: "expense", category: "Transport", sourceId: card.id, source: card.name, memberId: "member-me", person: "Eu", date: "2026-08-05" }];
    expect(allocationSpent(data, hers)).toBe(60);
    expect(allocationSpent(data, mine)).toBe(15);
  });

  it("realocă limita între plicuri fără a schimba nicio tranzacție sau sursă", () => {
    const data = createEmptyAppData(); const [card] = data.settings.paymentSources;
    const transport = { id: "transport", label: "Transport", amount: 500, category: "Transport", sourceId: card.id };
    const food = { id: "food", label: "Alimente", amount: 300, category: "Alimente", sourceId: card.id };
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-10", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [transport, food], transfers: [{ id: "move", fromAllocationId: "transport", toAllocationId: "food", amount: 120, note: "Taxi mai puțin", createdAt: "2026-08-02T12:00:00.000Z" }] };
    expect(allocationBudget(data, transport)).toBe(380);
    expect(allocationBudget(data, food)).toBe(420);
    expect(data.transactions).toHaveLength(0);
  });

  it("semnalizează plicul la 80% și la depășirea limitei", () => {
    const data = createEmptyAppData(); const [card] = data.settings.paymentSources; const transport = { id: "transport", label: "Transport", amount: 100, category: "Transport", sourceId: card.id };
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-31", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [transport], transfers: [] };
    data.transactions = [{ id: "near", title: "Taxi", amount: 80, kind: "expense", category: "Transport", source: card.name, sourceId: card.id, person: "Eu", memberId: "member-me", date: "2026-08-12" }];
    expect(allocationStatus(data, transport).state).toBe("watch");
    data.transactions.push({ id: "over", title: "Taxi", amount: 25, kind: "expense", category: "Transport", source: card.name, sourceId: card.id, person: "Eu", memberId: "member-me", date: "2026-08-13" });
    expect(allocationStatus(data, transport).state).toBe("over");
  });

  it("consumă numai plicul selectat expres și lasă plata din afara plicurilor în soldul sursei", () => {
    const data = createEmptyAppData(); const [card, cash] = data.settings.paymentSources;
    const cashTaxi = { id: "taxi-cash", label: "Taxi cash", amount: 400, category: "Transport", sourceId: cash.id, memberId: "member-me" };
    const cardTaxi = { id: "taxi-card", label: "Taxi card", amount: 300, category: "Transport", sourceId: card.id, memberId: "member-me" };
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-31", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [cashTaxi, cardTaxi], transfers: [] };
    data.transactions = [{ id: "cash-budget", title: "Taxi cash", amount: 50, kind: "expense", category: "Transport", sourceId: cash.id, source: cash.name, memberId: "member-me", person: "Eu", date: "2026-08-10", allocationId: "taxi-cash" }, { id: "cash-outside", title: "Taxi nebugetat", amount: 30, kind: "expense", category: "Transport", sourceId: cash.id, source: cash.name, memberId: "member-me", person: "Eu", date: "2026-08-11", allocationId: "outside" }];
    expect(allocationSpent(data, cashTaxi)).toBe(50);
    expect(allocationSpent(data, cardTaxi)).toBe(0);
    expect(sourceBalance(data, cash.id)).toBe(-80);
  });

  it("migrează o dată veche ne-normalizată într-un format ISO", () => {
    const migrated = normalizeAppData({ version: 5, transactions: [{ id: "legacy", title: "Bon", amount: 20, kind: "expense", category: "Alimente", source: "Bon", person: "Eu", date: "26 aug." }], settings: {} });
    expect(migrated.version).toBe(8);
    expect(migrated.transactions[0].date).toBe(isoToday());
    expect(migrated.transactions[0].sourceId).toBe(migrated.settings.paymentSources.find((source) => source.kind === "meal")?.id);
    expect(migrated.deleted).toEqual([]);
  });

  it("elimină defensiv prima dată de venit dacă ar începe înaintea planului", () => {
    const migrated = normalizeAppData({ settings: { salaryPlan: { periodStart: "2026-08-05", nextPayday: "2026-08-10", earliestPayday: "2026-08-02", sourceIds: [], totalLimit: 0, weeklyLimit: 0, allocations: [] } } });
    expect(migrated.settings.salaryPlan.earliestPayday).toBeUndefined();
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

  it("folosește prima dată posibilă din fereastra de venit pentru un plan prudent", () => {
    const data = createEmptyAppData();
    const source = data.settings.paymentSources[0];
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-10", earliestPayday: "2026-08-07", sourceIds: [], totalLimit: 700, weeklyLimit: 0, allocations: [], transfers: [] };
    data.transactions = [{ id: "pace", title: "Cheltuială", amount: 100, kind: "expense", category: "Altele", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-02" }];
    expect(inPlanPeriod("2026-08-08", data.settings.salaryPlan)).toBe(false);
    expect(planForecast(data, "2026-08-02").remainingDays).toBe(6);
  });

  it("interpretează local o cheltuială descrisă în limbaj natural", () => {
    expect(parseNaturalSpendScenario("Dacă plătesc 120 lei pe taxi mâine")).toMatchObject({ amount: 120, category: "Transport", timing: "mâine", understood: true });
    expect(parseNaturalSpendScenario("o cafea mâine")).toMatchObject({ amount: 0, category: "Băuturi", understood: false });
  });

  it("calculează media zilnică pentru un buget săptămânal fără a interpreta întrebarea ca o cheltuială", () => {
    const answer = answerBudgetQuestion("La un buget alimente cu de 600 pe săptămână, cât e media de cheltuit pe zi?", createEmptyAppData());
    expect(answer).toMatchObject({ kind: "daily-average", amount: 600, days: 7, result: 600 / 7, category: "Alimente", source: "declared" });
  });

  it("propune economisire doar din plan și mișcările reale", () => {
    const data = createEmptyAppData(); const source = data.settings.paymentSources[0];
    data.settings.salaryPlan = { periodStart: "2026-08-01", nextPayday: "2026-08-10", sourceIds: [], totalLimit: 1000, weeklyLimit: 0, allocations: [] };
    data.transactions = [{ id: "food", title: "Alimente", amount: 400, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-02" }];
    const suggestions = savingSuggestions(data, "2026-08-02");
    expect(suggestions.some((item) => item.id === "category" && item.potential === 40)).toBe(true);
    expect(suggestions.some((item) => item.id === "pace")).toBe(true);
  });

  it("explică presiunea bilanțului și a ratelor din istoricul personal", () => {
    const data = createEmptyAppData(); const source = data.settings.paymentSources[0]; source.openingBalance = 300;
    data.debts = [{ id: "credit", name: "Credit", remaining: 2600, monthly: 500, due: "28 august" }];
    data.transactions = [{ id: "salary", title: "Salariu", amount: 1200, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-10" }];
    const suggestions = savingSuggestions(data, "2026-08-20");
    expect(suggestions.find((item) => item.id === "net-position")).toMatchObject({ tone: "risk", potential: 1100, nextStep: "Revizuiește ratele și planul" });
    expect(suggestions.find((item) => item.id === "rate-pressure")).toMatchObject({ tone: "watch", potential: 500 });
  });

  it("semnalează o categorie care a crescut între două săptămâni din istoric", () => {
    const data = createEmptyAppData(); const source = data.settings.paymentSources[0];
    data.transactions = [{ id: "old-transport", title: "Taxi", amount: 60, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-02" }, { id: "new-transport", title: "Taxi", amount: 170, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-12" }];
    const trend = savingSuggestions(data, "2026-08-14").find((item) => item.id === "history-trend");
    expect(trend).toMatchObject({ tone: "watch", potential: 110, nextStep: "Vezi mișcările categoriei" });
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

  it("nu reintroduce o scadență recurentă ștearsă pe un alt telefon", () => {
    const local = createEmptyAppData(); const remote = createEmptyAppData(); const source = local.settings.paymentSources[0];
    remote.recurring = [{ id: "subscription", name: "Abonament", amount: 50, category: "Casă & facturi", sourceId: source.id, memberId: "member-me", dueDay: 8, active: true, updatedAt: "2026-08-08T08:00:00.000Z" }];
    local.deleted = [{ entity: "recurring", id: "subscription", deletedAt: "2026-08-08T09:00:00.000Z" }];
    expect(mergeFamilyData(local, remote).recurring).toEqual([]);
  });

  it("propune produse și prețuri individuale, fără totaluri sau plăți", () => {
    const items = parseReceiptItems(["LAPTE 1.5% 7,49", "APA MINERALA 2 x 3,50 7,00", "DETergent 18,99", "TOTAL 33,48", "CARD 33,48"]);
    expect(items).toEqual([{ label: "LAPTE 1.5%", amount: 7.49, category: "Alimente", raw: "LAPTE 1.5% 7,49" }, { label: "APA MINERALA", amount: 7, category: "Băuturi", raw: "APA MINERALA 2 x 3,50 7,00" }, { label: "DETergent", amount: 18.99, category: "Casă & facturi", raw: "DETergent 18,99" }]);
  });
});
