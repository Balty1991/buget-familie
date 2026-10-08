import { describe, expect, it } from "vitest";
import type { Transaction } from "./finance-data";
import { brokenSplits } from "./split-payment";

const tx = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, title: "Exflor", amount, kind: "expense", category: "Dulciuri", source: "Card", sourceId: "card", person: "Eu", date: "2026-10-08", ...extra });

describe("bonul pe două surse rămas incomplet", () => {
  it("un bon întreg nu e semnalat", () => {
    expect(brokenSplits([tx("a", 12, { splitId: "s", splitTotal: 20.36, source: "Voucher SGR" }), tx("b", 8.36, { splitId: "s", splitTotal: 20.36 })])).toEqual([]);
  });

  it("partea lipsă se vede din total", () => {
    const [broken] = brokenSplits([tx("b", 8.36, { splitId: "s", splitTotal: 20.36 })]);
    expect(broken).toMatchObject({ total: 20.36, missing: 12 });
  });

  it("la mișcările vechi, totalul și sursa lipsă vin din notă", () => {
    const note = "Bon de 20,36 RON: 12,00 RON din Voucher SGR și 8,36 RON din Card Raiffeisen Alin.";
    const [broken] = brokenSplits([tx("b", 8.36, { splitId: "s", note, source: "Card Raiffeisen Alin" })]);
    expect(broken).toMatchObject({ total: 20.36, missing: 12, missingSource: "Voucher SGR" });
    const full = brokenSplits([tx("a", 12, { splitId: "s", note, source: "Voucher SGR" }), tx("b", 8.36, { splitId: "s", note, source: "Card Raiffeisen Alin" })]);
    expect(full).toEqual([]);
  });

  it("mii cu punct: „Bon de 1.039,76 RON” se citește corect", () => {
    const note = "Bon de 1.039,76 RON: 28,50 RON din Voucher SGR și 1.011,26 RON din Cash.";
    const [broken] = brokenSplits([tx("b", 1011.26, { note, source: "Cash" })]);
    expect(broken).toMatchObject({ total: 1039.76, missing: 28.5, missingSource: "Voucher SGR" });
  });
});

describe("cheltuiala cu categoria „Venit”", () => {
  it("la încărcare primește categoria după nume (Taxi → Transport)", async () => {
    const { normalizeAppData, createEmptyAppData } = await import("./finance-data");
    const data = normalizeAppData({ ...createEmptyAppData(), transactions: [{ id: "x", title: "Taxi", amount: 45, kind: "expense", category: "Venit", source: "Cash", person: "Eu", date: "2026-10-08" }] });
    expect(data.transactions[0].category).toBe("Transport");
  });
});
