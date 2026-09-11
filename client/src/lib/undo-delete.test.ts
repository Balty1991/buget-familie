import { describe, expect, it } from "vitest";
import { buildUndo } from "./undo-delete";
import { createEmptyAppData, newId, type AppData, type Transaction } from "./finance-data";

const tx = (id: string, title: string): Transaction => ({
  id, title, amount: 100, kind: "expense", category: "Alimente",
  source: "Card", sourceId: "s1", person: "Eu", memberId: "m1", date: "2026-09-05",
});

const withRows = (): AppData => {
  const data = createEmptyAppData();
  data.transactions = [tx("t1", "Lidl"), tx("t2", "Benzină")];
  return data;
};

describe("anularea unei ștergeri", () => {
  it("pune mișcarea la loc", () => {
    const before = withRows();
    const removed = before.transactions.find((item) => item.id === "t1")!;
    const after: AppData = {
      ...before,
      transactions: before.transactions.filter((item) => item.id !== "t1"),
      deleted: [{ entity: "transactions", id: "t1", deletedAt: new Date().toISOString() }],
    };

    const undo = buildUndo("Mișcarea a fost ștearsă.", { transactions: [removed] })!;
    const restored = undo.apply(after);
    expect(restored.transactions.map((item) => item.id).sort()).toEqual(["t1", "t2"]);
    expect(restored.transactions.find((item) => item.id === "t1")!.title).toBe("Lidl");
  });

  it("ridică „tombstone”-ul, altfel sincronizarea ar șterge la loc", () => {
    const removed = tx("t1", "Lidl");
    const after: AppData = {
      ...createEmptyAppData(),
      transactions: [],
      deleted: [
        { entity: "transactions", id: "t1", deletedAt: "2026-09-05T10:00:00.000Z" },
        { entity: "transactions", id: "altceva", deletedAt: "2026-09-01T10:00:00.000Z" },
      ],
    };
    const restored = buildUndo("x", { transactions: [removed] })!.apply(after);
    expect(restored.deleted.map((item) => item.id)).toEqual(["altceva"]);
  });

  it("nu pierde mișcările adăugate între timp", () => {
    const removed = tx("t1", "Lidl");
    const after: AppData = { ...createEmptyAppData(), transactions: [tx("t9", "Adăugată după ștergere")] };
    const restored = buildUndo("x", { transactions: [removed] })!.apply(after);
    expect(restored.transactions.map((item) => item.id).sort()).toEqual(["t1", "t9"]);
  });

  it("nu dublează dacă rândul a revenit între timp prin sincronizare", () => {
    const removed = tx("t1", "Lidl");
    const after: AppData = { ...createEmptyAppData(), transactions: [tx("t1", "Lidl")] };
    const restored = buildUndo("x", { transactions: [removed] })!.apply(after);
    expect(restored.transactions).toHaveLength(1);
  });

  it("readuce un bon împreună cu mișcările lui", () => {
    const receipt = { id: "r1", vendor: "Lidl", amount: 240, date: "2026-09-05", memberId: "m1", sourceId: "s1" } as AppData["receipts"][number];
    const linked = tx("receipt-tx-r1", "Lidl");
    const after: AppData = {
      ...createEmptyAppData(), receipts: [], transactions: [],
      deleted: [
        { entity: "receipts", id: "r1", deletedAt: "2026-09-05T10:00:00.000Z" },
        { entity: "transactions", id: "receipt-tx-r1", deletedAt: "2026-09-05T10:00:00.000Z" },
      ],
    };
    const restored = buildUndo("Bonul a fost șters.", { receipts: [receipt], transactions: [linked] })!.apply(after);
    expect(restored.receipts).toHaveLength(1);
    expect(restored.transactions).toHaveLength(1);
    expect(restored.deleted).toHaveLength(0);
  });

  it("readuce datorii, obiective și scadențe", () => {
    const debt = { id: "d1", name: "Card", remaining: 1000, monthly: 100 } as AppData["debts"][number];
    const goal = { id: "g1", name: "Vacanță", target: 5000, current: 100 } as AppData["savings"][number];
    const rec = { id: "rc1", name: "Netflix", amount: 55, category: "Abonamente", sourceId: "s1", memberId: "m1", dueDay: 20, active: true } as AppData["recurring"][number];
    const after = createEmptyAppData();
    const restored = buildUndo("x", { debts: [debt], savings: [goal], recurring: [rec] })!.apply(after);
    expect(restored.debts).toHaveLength(1);
    expect(restored.savings).toHaveLength(1);
    expect(restored.recurring).toHaveLength(1);
  });

  it("nu propune anulare când nu s-a șters nimic", () => {
    expect(buildUndo("x", {})).toBeUndefined();
    expect(buildUndo("x", { transactions: [] })).toBeUndefined();
  });

  it("nu atinge restul registrului", () => {
    const before = withRows();
    before.settings.familyName = "Familia Popescu";
    const restored = buildUndo("x", { transactions: [tx("t3", "Nouă")] })!.apply(before);
    expect(restored.settings).toBe(before.settings);
    expect(restored.savings).toBe(before.savings);
  });
});
