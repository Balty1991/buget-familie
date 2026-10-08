import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { readRemovedBin, recordRemovals, removedBetween, repairSplit, restoreRemoved } from "./removed-bin";
import { brokenSplits, isSplitPartner } from "./split-payment";

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } } });
});

const tx = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, title: "Exflor", amount, kind: "expense", category: "Dulciuri", source: "Card", sourceId: "source-debit", person: "Eu", date: "2026-10-08", ...extra });
const withTx = (transactions: Transaction[], receipts: AppData["receipts"] = []): AppData => ({ ...createEmptyAppData(), transactions, receipts });

describe("„Șterse recent”", () => {
  it("ține minte mișcările și bonurile dispărute, nu și pe cele corectate", () => {
    const before = withTx([tx("a", 12), tx("b", 8.36)], [{ id: "r", vendor: "Exflor", amount: 20.36, category: "Dulciuri", date: "2026-10-08", linkedTransactionId: "a" }]);
    const after = withTx([{ ...tx("b", 8.36), amount: 9 }]);
    recordRemovals(before, after);
    expect(readRemovedBin().map((entry) => `${entry.entity}:${entry.row.id}`)).toEqual(["transactions:a", "receipts:r"]);
  });

  it("o operație în masă (închiderea anului) nu umple coșul", () => {
    const many = Array.from({ length: 60 }, (_, index) => tx(`t${index}`, 1));
    expect(removedBetween(withTx(many), withTx([]))).toEqual([]);
  });

  it("pune înapoi și ridică piatra de mormânt", () => {
    recordRemovals(withTx([tx("a", 12)]), withTx([]));
    const [entry] = readRemovedBin();
    const restored = restoreRemoved({ ...withTx([]), deleted: [{ entity: "transactions", id: "a", deletedAt: "2026-10-08T10:00:00.000Z" }] }, [entry.key]);
    expect(restored.transactions.map((item) => item.id)).toEqual(["a"]);
    expect(restored.deleted).toEqual([]);
    expect(readRemovedBin()).toEqual([]);
  });
});

describe("repararea bonului pe două surse", () => {
  it("aduce din coș partea de voucher, cu bonul și articolele ei", () => {
    const voucher = tx("a", 12, { splitId: "s", splitTotal: 20.36, source: "Voucher SGR", sourceId: "v", receiptId: "detail-a" });
    const card = tx("b", 8.36, { splitId: "s", splitTotal: 20.36 });
    const receipt = { id: "detail-a", vendor: "Exflor", amount: 20.36, category: "Dulciuri", date: "2026-10-08", linkedTransactionId: "a", lines: [{ id: "l1", category: "Dulciuri", amount: 20.36, label: "Kinder" }] };
    recordRemovals(withTx([voucher, card], [receipt]), withTx([card]));
    const now = withTx([card]);
    const [broken] = brokenSplits(now.transactions);
    const repaired = repairSplit(now, broken, isSplitPartner, () => "new")!;
    expect(repaired.transactions.map((item) => `${item.id}:${item.amount}`).sort()).toEqual(["a:12", "b:8.36"]);
    expect(repaired.receipts[0].lines).toHaveLength(1);
    expect(brokenSplits(repaired.transactions)).toEqual([]);
  });

  it("fără coș, reface partea din nota veche, pe sursa numită acolo", () => {
    const note = "Bon de 20,36 RON: 12,00 RON din Voucher SGR și 8,36 RON din Card debit.";
    const data = withTx([tx("b", 8.36, { note, source: "Card debit" })]);
    data.settings.paymentSources = [...data.settings.paymentSources, { id: "v", name: "Voucher SGR", kind: "voucher", openingBalance: 40 }];
    const [broken] = brokenSplits(data.transactions);
    const repaired = repairSplit(data, broken, isSplitPartner, () => "new")!;
    expect(repaired.transactions.find((item) => item.id === "new")).toMatchObject({ amount: 12, sourceId: "v", splitId: "new" });
    expect(brokenSplits(repaired.transactions)).toEqual([]);
  });
});
