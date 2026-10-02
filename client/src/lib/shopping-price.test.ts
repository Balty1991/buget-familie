import { describe, expect, it } from "vitest";
import { estimateShopping, shoppingQuery } from "./shopping-price";
import type { Receipt } from "./finance-data";

const receipt = (id: string, vendor: string, date: string, lines: Array<[string, number]>): Receipt => ({ id, vendor, date, amount: lines.reduce((s, [, a]) => s + a, 0), category: "Alimente", lines: lines.map(([label, amount], i) => ({ id: `${id}-${i}`, label, amount, category: "Alimente" })) });

describe("coșul estimat", () => {
  it("citește cantitatea și cuvintele", () => {
    expect(shoppingQuery("2 x Ouă")).toEqual({ qty: 2, words: ["oua"] });
    expect(shoppingQuery("Lapte Zuzu")).toEqual({ qty: 1, words: ["lapte", "zuzu"] });
  });

  it("ia ultimul preț și arată unde a fost mai ieftin", () => {
    const receipts = [
      receipt("r1", "Lidl", "2026-09-10", [["LAPTE ZUZU 1,5% 1L", 7.2], ["PAINE FELIATA", 5]]),
      receipt("r2", "Kaufland", "2026-09-25", [["Lapte Zuzu 1L", 8.1], ["Paine alba", 4.5]]),
      receipt("r3", "Lidl", "2026-01-01", [["CAFEA", 30]]),
    ];
    const est = estimateShopping([{ id: "a", text: "Lapte" }, { id: "b", text: "2 x pâine" }, { id: "c", text: "Cafea" }, { id: "d", text: "Ou" }], receipts, "2026-10-02");
    expect(est.prices.a).toEqual({ price: 8.1, vendor: "Kaufland", date: "2026-09-25", cheapest: { vendor: "Lidl", price: 7.2 } });
    expect(est.prices.b.price).toBe(9);
    expect(est.prices.c).toBeUndefined();
    expect(est.prices.d).toBeUndefined();
    expect(est.known).toBe(2);
    expect(est.total).toBe(17.1);
    expect(est.bestVendor).toBeUndefined();
  });

  it("recomandă magazinul doar dacă are toate produsele și economisește măcar un leu", () => {
    const receipts = [
      receipt("r1", "Lidl", "2026-09-10", [["Lapte", 6], ["Detergent Ariel", 40]]),
      receipt("r2", "Profi", "2026-09-28", [["Lapte", 8], ["Detergent Ariel", 52]]),
    ];
    const est = estimateShopping([{ id: "a", text: "lapte" }, { id: "b", text: "Ariel" }], receipts, "2026-10-02");
    expect(est.total).toBe(60);
    expect(est.bestVendor).toEqual({ vendor: "Lidl", total: 46, saves: 14 });
  });
});
