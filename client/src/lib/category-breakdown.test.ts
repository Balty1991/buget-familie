import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { categoryDetail, categoryTotals, spendPieces } from "./category-breakdown";

const tx = (id: string, amount: number, category: string, title = "Cumpărături Mega Image"): Transaction => ({ id, title, amount, kind: "expense", category, source: "Card", person: "Eu", date: "2026-10-09" });

const mega = (): AppData => {
  const data = createEmptyAppData();
  data.transactions = [tx("t1", 120, "Casă & facturi"), tx("t2", 30, "Alimente", "Lidl")];
  data.receipts = [{ id: "r1", vendor: "Cumpărături Mega Image", amount: 120, category: "Casă & facturi", date: "2026-10-09", linkedTransactionId: "t1", lines: [
    { id: "l1", category: "Casă & facturi", amount: 70, label: "Ariel Pods" },
    { id: "l2", category: "Băuturi", amount: 20, label: "Bere Ursus" },
    { id: "l3", category: "Apă", amount: 10, label: "Apă plată" },
  ] }];
  return data;
};

describe("cheltuieli pe articole", () => {
  it("articolele de pe bon merg la categoria lor; restul rămâne la bon", () => {
    const data = mega();
    expect(categoryTotals(spendPieces(data, data.transactions))).toEqual([["Casă & facturi", 90], ["Alimente", 30], ["Băuturi", 20], ["Apă", 10]]);
  });

  it("bonul pe două surse: fiecare mișcare ia partea ei, totalul nu se dublează", () => {
    const data = mega();
    data.transactions = [tx("t1", 90, "Casă & facturi"), tx("t3", 30, "Casă & facturi")];
    data.receipts[0].linkedTransactionIds = ["t1", "t3"];
    const totals = categoryTotals(spendPieces(data, data.transactions));
    expect(totals.reduce((sum, [, value]) => sum + value, 0)).toBeCloseTo(120, 2);
    expect(Object.fromEntries(totals)["Băuturi"]).toBeCloseTo(20, 2);
  });

  it("bonul deja împărțit pe categorii nu se mai desface", () => {
    const data = mega();
    data.transactions = [tx("t1", 70, "Casă & facturi"), tx("t3", 50, "Băuturi")];
    data.receipts[0].linkedTransactionIds = ["t1", "t3"];
    expect(categoryTotals(spendPieces(data, data.transactions))).toEqual([["Casă & facturi", 70], ["Băuturi", 50]]);
  });

  it("din categorie: pe ce și unde", () => {
    const data = mega();
    data.transactions.push(tx("t4", 8, "Băuturi", "Bere Ursus"));
    const detail = categoryDetail(spendPieces(data, data.transactions), "Băuturi");
    expect(detail.items[0]).toEqual({ label: "Bere Ursus", amount: 28, count: 2 });
    expect(detail.stores.map((item) => item.label)).toEqual(["Mega Image", "Bere Ursus"]);
  });
});
