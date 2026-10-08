import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { sgrBalance } from "./sgr-balance";

const tx = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, title: "Profi", amount, kind: "expense", category: "Alimente", source: "Card", sourceId: "source-debit", person: "Eu", date: "2026-10-08", ...extra });

describe("bilanțul SGR", () => {
  it("adună garanția de pe bonuri și voucherele de la reciclare", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [...data.settings.paymentSources, { id: "v", name: "Voucher SGR", kind: "voucher", openingBalance: 0 }];
    data.receipts = [{ id: "r", vendor: "Profi", amount: 20, category: "Alimente", date: "2026-10-08", lines: [{ id: "a", category: "Alimente", amount: 18.5, label: "Apă" }, { id: "b", category: "SGR", amount: 1.5, label: "Garanție SGR" }] }];
    data.transactions = [
      tx("t1", 20, { receiptId: "r" }),
      tx("t2", 0.5, { category: "SGR", title: "Garanție" }),
      tx("t3", 6, { kind: "income", category: "Venit", title: "Voucher reciclare", sourceId: "v" }),
      tx("t4", 1, { category: "SGR", date: "2026-09-01" }),
    ];
    expect(sgrBalance(data, "2026-10-01")).toEqual({ paid: 2, recovered: 6, net: -4 });
  });
});
