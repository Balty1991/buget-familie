/** Produs #2: banii mutați între surse nu sunt cheltuieli și nici venituri. */
import { describe, expect, it } from "vitest";
import { commitLedgerEntry, createEmptyAppData, financialBalance, sourceBalance, sourceTransferPair, unappliedSalaryIncomes } from "./finance-data";

describe("mutarea între surse", () => {
  it("mută soldul, dar bilanțul și propunerea de repartizare rămân neatinse", () => {
    let data = createEmptyAppData();
    data.settings.paymentSources = [
      { id: "card", name: "Card", kind: "card", memberId: "member-me", openingBalance: 1000 },
      { id: "cash", name: "Cash", kind: "cash", memberId: "member-me", openingBalance: 0 },
    ];
    const before = financialBalance(data, "2026-09-01", "2026-09-30");
    const pair = sourceTransferPair(data, { fromId: "card", toId: "cash", amount: 200, date: "2026-09-20" });
    expect(pair).toHaveLength(2);
    expect(pair[0].transferId).toBe(pair[1].transferId);
    data = pair.reduce((ledger, entry) => commitLedgerEntry(ledger, entry), data);
    expect(sourceBalance(data, "card")).toBe(800);
    expect(sourceBalance(data, "cash")).toBe(200);
    const after = financialBalance(data, "2026-09-01", "2026-09-30");
    expect(after.income).toBe(before.income);
    expect(after.expense).toBe(before.expense);
    expect(unappliedSalaryIncomes(data)).toHaveLength(0);
  });

  it("refuză aceeași sursă și suma zero", () => {
    const data = createEmptyAppData();
    const id = data.settings.paymentSources[0].id;
    expect(() => sourceTransferPair(data, { fromId: id, toId: id, amount: 10, date: "2026-09-20" })).toThrow();
  });
});
