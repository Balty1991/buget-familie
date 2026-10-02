import { describe, expect, it } from "vitest";
import type { Transaction } from "./finance-data";
import { smallSpends } from "./small-spends";

let n = 0;
const tx = (date: string, title: string, amount: number, extra: Partial<Transaction> = {}) => ({ id: `t${++n}`, date, title, amount, kind: "expense", category: "Alimente", ...extra }) as Transaction;

describe("banii mărunți", () => {
  it("adună ce se repetă mărunt și arată cât face pe an", () => {
    const list = [
      ...["2026-10-01", "2026-09-28", "2026-09-25", "2026-09-20", "2026-09-10"].map((d) => tx(d, "Cafea", 14)),
      tx("2026-10-02", "cafea!", 16),
      ...["2026-10-01", "2026-09-26", "2026-09-21"].map((d) => tx(d, "Covrigi", 5)),
      ...["2026-10-01", "2026-09-26", "2026-09-21", "2026-09-15"].map((d) => tx(d, "Lidl", 240)),
      tx("2026-08-01", "Cafea", 14),
      ...["2026-10-01", "2026-09-26", "2026-09-21", "2026-09-15"].map((d) => tx(d, "Gelato", 20, { tripId: "x" })),
    ];
    const result = smallSpends(list, "2026-10-02");
    expect(result.rows).toEqual([{ key: "cafea", label: "cafea!", count: 6, total: 86, average: 14.33, yearly: Math.round((86 * 365) / 30) }]);
    expect(result.total).toBe(86);
  });

  it("fără repetări nu spune nimic", () => {
    expect(smallSpends([tx("2026-10-01", "Cafea", 14)], "2026-10-02").rows).toEqual([]);
  });
});
