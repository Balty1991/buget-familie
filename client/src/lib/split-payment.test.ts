import { describe, expect, it } from "vitest";
import type { Transaction } from "./finance-data";
import { mergeSplitPayments, splitGroupIds } from "./split-payment";

const tx = (id: string, amount: number, source: string, extra: Partial<Transaction> = {}): Transaction => ({ id, title: "Exflor", kind: "expense", category: "Alimente", amount, date: "2026-10-06", sourceId: source, source, memberId: "m", person: "Alin", createdAt: "2026-10-06T10:00:00.000Z", ...extra });

describe("bonul plătit din două surse e un singur rând", () => {
  it("leagă părțile după splitId și le arată ca un bon cu totalul", () => {
    const list = [tx("a", 28.5, "Voucher SGR", { splitId: "s", receiptId: "r" }), tx("b", 11.26, "Cash Alin", { splitId: "s" }), tx("c", 13, "Cash Alin", { title: "Patiserie" })];
    const merged = mergeSplitPayments(list);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: "a", amount: 39.76, source: "Voucher SGR + Cash Alin" });
    expect(splitGroupIds(list, "b").sort()).toEqual(["a", "b"]);
  });

  it("recunoaște perechile vechi după nota bonului", () => {
    const note = "Bon de 39,76 RON: 28,50 RON din Voucher SGR și 11,26 RON din Cash Alin.";
    const merged = mergeSplitPayments([tx("b", 11.26, "Cash Alin", { note }), tx("a", 28.5, "Voucher SGR", { note })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(39.76);
  });
});

describe("storedMove", () => {
  it("corectura bonului unit pornește de la partea salvată, nu de la totalul afișat", async () => {
    const { storedMove, mergeSplitPayments } = await import("./split-payment");
    const base = { id: "a", title: "Exflor", amount: 28.5, kind: "expense", category: "Alimente", source: "Voucher SGR", sourceId: "v", date: "2026-10-06", createdAt: "2026-10-06T10:00:00Z", splitId: "s1", receiptId: "r1" } as Transaction;
    const cash = { ...base, id: "b", amount: 11.26, source: "Cash Alin", sourceId: "c", receiptId: undefined } as Transaction;
    const [row] = mergeSplitPayments([base, cash]);
    expect(row.amount).toBe(39.76);
    const opened = storedMove([base, cash], row);
    expect(opened.amount).toBe(28.5);
    expect("splitParts" in opened).toBe(false);
  });
});
