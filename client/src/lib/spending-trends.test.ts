import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { spendingTrends } from "./spending-trends";

let n = 0;
const tx = (date: string, amount: number, category = "Alimente", title = "Lidl", extra: Partial<Transaction> = {}) => ({ id: `t${++n}`, date, amount, kind: "expense", category, title, sourceId: "card", source: "Card", person: "A", ...extra }) as Transaction;

describe("tendințe și obiceiuri", () => {
  const data = () => {
    const d = createEmptyAppData();
    d.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", openingBalance: 0 }];
    // Aprilie–septembrie: Alimente stabil, Timp liber dublat în ultimele 3 luni, Transport la jumătate.
    for (const [month, fun, car] of [["2026-04", 300, 800], ["2026-05", 300, 800], ["2026-06", 300, 800], ["2026-07", 600, 400], ["2026-08", 600, 400], ["2026-09", 600, 400]] as const) {
      d.transactions.push(tx(`${month}-04`, 500), tx(`${month}-11`, 500), tx(`${month}-05`, fun, "Timp liber", "Cinema"), tx(`${month}-06`, car, "Transport", "OMV"));
    }
    d.transactions.push(tx("2026-09-20", 9999, "Credite", "Rată", { debtId: "d" }), tx("2026-10-01", 5000, "Alimente"));
    return d;
  };

  it("găsește categoriile care cresc și care scad, doar din lunile întregi", () => {
    const trends = spendingTrends(data(), "2026-10-03")!;
    expect(trends.months.map((row) => row.key)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(trends.months[5].total).toBe(2000);
    expect(trends.rising.map((row) => row.name)).toEqual(["Timp liber"]);
    expect(trends.rising[0]).toMatchObject({ recent: 600, before: 300, change: 1 });
    expect(trends.falling.map((row) => row.name)).toEqual(["Transport"]);
    expect(trends.categories.find((row) => row.name === "Alimente")?.trend).toBe("flat");
    expect(trends.categories.some((row) => row.name === "Credite")).toBe(false);
  });

  it("socotește săptămâna și magazinele de bază", () => {
    const trends = spendingTrends(data(), "2026-10-03")!;
    expect(trends.weekdays).toHaveLength(7);
    expect(trends.weekendShare).toBeGreaterThan(0);
    expect(trends.weekendShare).toBeLessThan(1);
    expect(trends.places[0]).toMatchObject({ name: "Lidl", visits: 12, total: 6000, average: 500 });
    expect(trends.largest[0].amount).toBe(800);
  });

  it("nu spune nimic fără istoric", () => {
    expect(spendingTrends(createEmptyAppData(), "2026-10-03")).toBeUndefined();
  });
});
