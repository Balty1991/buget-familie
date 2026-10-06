import { describe, expect, it } from "vitest";
import { collapseSplitReceipts, createEmptyAppData, type AppData, type Transaction } from "./finance-data";

const tx = (id: string, title: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, title, kind: "expense", category: "Alimente", amount, date: "2026-10-05", sourceId: "source-debit", source: "Card", memberId: "member-me", person: "Eu", createdAt: "2026-10-05T10:00:00.000Z", ...extra });
const receipt = (id: string, vendor: string, amount: number, extra = {}) => ({ id, vendor, amount, category: "Alimente", date: "2026-10-05", sourceId: "source-debit", memberId: "member-me", ...extra });
const ids = (data: AppData) => data.transactions.map((item) => item.id).sort();

describe("curățenia bonurilor de la pornire nu șterge cheltuieli reale", () => {
  it("bonul confirmat rămâne lângă o altă cheltuială cu aceeași sumă", () => {
    const data = createEmptyAppData();
    data.receipts = [receipt("lidl", "Lidl", 50, { linkedTransactionId: "receipt-tx-lidl", linkedTransactionIds: ["receipt-tx-lidl"] })];
    data.transactions = [tx("receipt-tx-lidl", "Bon — Lidl", 50, { receiptId: "lidl" }), tx("tx-farmacie", "Farmacie", 50)];
    const after = collapseSplitReceipts(data);
    expect(ids(after)).toEqual(["receipt-tx-lidl", "tx-farmacie"]);
    expect(after.deleted).toHaveLength(0);
  });

  it("cheltuiala cu bonul atașat nu e înlocuită de alta din aceeași zi", () => {
    const data = createEmptyAppData();
    data.receipts = [receipt("k", "Kaufland", 100, { linkedTransactionId: "tx-k", linkedTransactionIds: ["tx-k"] })];
    data.transactions = [tx("tx-k", "Kaufland", 100, { receiptId: "k" }), tx("tx-alt", "Benzină", 100.5)];
    const after = collapseSplitReceipts(data);
    expect(ids(after)).toEqual(["tx-alt", "tx-k"]);
    expect(after.deleted).toHaveLength(0);
  });

  it("bonul vechi spart pe produse se strânge, iar cu cheltuiala notată de mână se leagă de ea", () => {
    const data = createEmptyAppData();
    data.receipts = [receipt("ex", "Exflor", 64.95)];
    data.transactions = [tx("receipt-tx-ex-a", "Bon — Exflor · Flori", 40), tx("receipt-tx-ex-b", "Bon — Exflor · Ghiveci", 24.95), tx("tx-ex", "Exflor", 64.95)];
    const after = collapseSplitReceipts(data);
    expect(ids(after)).toEqual(["tx-ex"]);
    expect(after.transactions[0].receiptId).toBe("ex");
  });
});
