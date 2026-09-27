/**
 * Sonde „Închide anul” (runda 3). Fiecare test descrie comportamentul CORECT; dacă pică, bug-ul e confirmat.
 */
import { describe, expect, it } from "vitest";
import { allocationStatus, createEmptyAppData, normalizeAppData, sourceBalance, sourceBalanceInCurrency, type AppData, type Transaction } from "@/lib/finance-data";
import { closeYear } from "@/lib/year-close";
import { mergeFamilyData } from "@/lib/family-crypto";
import { hasNoMoneyYet } from "@/lib/plan-cycle";

const tx = (id: string, date: string, amount: number, kind: "income" | "expense" = "expense", extra: Partial<Transaction> = {}): Transaction => ({ id, title: id, amount, kind, category: "Alimente", source: "Card", sourceId: "source-debit", person: "Eu", memberId: "member-me", date, allocationId: kind === "expense" ? "env-food" : undefined, ...extra });

const withCycle = (): AppData => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2025-12-25", nextPayday: "2026-01-25", allocations: [{ id: "env-food", label: "Mâncare", category: "Alimente", amount: 2000, alertThreshold: 80 }] };
  data.transactions = [tx("salary", "2025-12-25", 6000, "income"), tx("food-dec", "2025-12-28", 900), tx("food-jan", "2026-01-02", 100)];
  return data;
};

describe("Închide anul — sonde", () => {
  it("Y1: închiderea anului în mijlocul unui ciclu nu schimbă ce a rămas în plic", () => {
    const data = withCycle();
    const env = data.settings.salaryPlan.allocations[0];
    const before = allocationStatus(data, env);
    const { data: closed } = closeYear(data, "2025", "2026-01-03");
    const after = allocationStatus(closed, closed.settings.salaryPlan.allocations[0]);
    expect(before.remaining).toBe(1000);
    expect(after.remaining).toBe(before.remaining); // primit: 1900 (cei 900 din 28.12 au dispărut din plic)
  });

  it("Y2: o mișcare din anul închis, încă netrimisă de partener, nu se pierde și soldul rămâne corect", () => {
    const partner = withCycle();
    partner.transactions.push(tx("late-dec", "2025-12-30", 250)); // notată offline de partener, înainte de închidere
    const { data: closed } = closeYear(withCycle(), "2025", "2026-01-03");
    const merged = mergeFamilyData(partner, closed);
    const truth = sourceBalance(partner, "source-debit");
    expect(sourceBalance(merged, "source-debit")).toBe(truth); // primit: +250 (cheltuiala a dispărut)
  });

  it("Y3: o cheltuială cu dată din anul închis, adăugată după închidere, nu dispare la normalizare", () => {
    const { data: closed } = closeYear(withCycle(), "2025", "2026-01-03");
    const added = { ...closed, transactions: [...closed.transactions, tx("stmt-dec", "2025-12-31", 75)] };
    const reloaded = normalizeAppData(JSON.parse(JSON.stringify(added)));
    expect(reloaded.transactions.some((item) => item.id === "stmt-dec")).toBe(true);
  });

  it("Y4: soldul în valută al unei surse EUR nu se schimbă după închiderea anului", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources.push({ id: "eur", name: "Cont EUR", kind: "card", openingBalance: 0, currency: "EUR" });
    data.settings.exchangeRates = [{ currency: "EUR", rate: 5.1, updatedAt: "2026-02-01T00:00:00.000Z" } as never];
    data.transactions = [tx("eur-in", "2025-06-01", 4970, "income", { sourceId: "eur", originalCurrency: "EUR", originalAmount: 1000 } as Partial<Transaction>)];
    const before = sourceBalanceInCurrency(data, "eur")!;
    const { data: closed } = closeYear(data, "2025", "2026-02-02");
    const after = sourceBalanceInCurrency(closed, "eur")!;
    expect(before.amount).toBe(1000);
    expect(after.amount).toBe(before.amount); // primit: 974.51
  });

  it("Y5: după închiderea anului, Astăzi nu spune „nu știm câți bani sunt”", () => {
    const data = createEmptyAppData();
    data.transactions = [tx("in", "2025-11-10", 5000, "income"), tx("out", "2025-11-12", 300)];
    const { data: closed } = closeYear(data, "2025", "2026-01-01");
    expect(sourceBalance(closed, "source-debit")).toBe(4700);
    expect(hasNoMoneyYet(closed)).toBe(false); // primit: true
  });
});
