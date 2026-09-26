import { describe, expect, it } from "vitest";
import { adjustDebtsForLedgerEdits, amountInput, autoPostDueRecurring, commitLedgerEntry, createEmptyAppData, parseRomanianAmount, recordDebtPayment, type AppData } from "./finance-data";

const withDebt = (): AppData => {
  const data = createEmptyAppData();
  const member = data.settings.members[0];
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: member.id, openingBalance: 3000 }];
  data.debts = [{ id: "d1", name: "Credit IFN", remaining: 5000, monthly: 500, dueDate: "2026-10-05" } as AppData["debts"][number]];
  return data;
};

describe("plata unei rate corectată sau ștearsă", () => {
  it("soldul datoriei urmează corectura și ștergerea, dar nu se dublează la plata nouă", () => {
    const start = withDebt();
    const member = start.settings.members[0];
    const paid = recordDebtPayment(start, { debtId: "d1", amount: 500, sourceId: "card", memberId: member.id })!;
    expect(adjustDebtsForLedgerEdits(start, paid).debts[0].remaining).toBe(4500);
    const payment = paid.transactions.find((item) => item.debtId === "d1")!;
    const edited = { ...paid, transactions: paid.transactions.map((item) => item.id === payment.id ? { ...item, amount: 50 } : item) };
    const afterEdit = adjustDebtsForLedgerEdits(paid, edited);
    expect(afterEdit.debts[0].remaining).toBe(4950);
    const removed = { ...afterEdit, transactions: afterEdit.transactions.filter((item) => item.id !== payment.id) };
    expect(adjustDebtsForLedgerEdits(afterEdit, removed).debts[0].remaining).toBe(5000);
  });
});

describe("sume la bani", () => {
  it("12,345 se salvează 12,35 și se corectează fără să devină 12.345 lei", () => {
    const data = createEmptyAppData();
    const saved = commitLedgerEntry(data, { id: "t1", title: "Pâine", amount: 12.345, kind: "expense", category: "Alimente", source: "", person: "", date: "2026-09-26" });
    expect(saved.transactions[0].amount).toBe(12.35);
    expect(parseRomanianAmount(amountInput(saved.transactions[0].amount))).toBe(12.35);
  });
});

describe("plată recurentă adăugată automat", () => {
  it("odată ștearsă, nu mai reapare", () => {
    const data = withDebt();
    const member = data.settings.members[0];
    data.recurring = [{ id: "net", name: "Internet", amount: 60, dueDay: 24, category: "Casă & facturi", sourceId: "card", memberId: member.id, active: true, autoPost: true, frequency: "monthly" } as AppData["recurring"][number]];
    const posted = autoPostDueRecurring(data, "2026-09-26");
    const auto = posted.transactions.find((item) => item.recurringId === "net");
    expect(auto).toBeDefined();
    const deleted: AppData = { ...posted, transactions: [], deleted: [{ entity: "transactions", id: auto!.id, deletedAt: "2026-09-26T10:00:00.000Z" }] };
    expect(autoPostDueRecurring(deleted, "2026-09-26").transactions).toHaveLength(0);
  });
});
