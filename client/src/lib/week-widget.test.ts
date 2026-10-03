import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { weekWidgetData } from "./week-widget";

let n = 0;
const tx = (date: string, amount: number) => ({ id: `t${++n}`, date, amount, kind: "expense", category: "Alimente", title: "x", sourceId: "c", source: "Card", person: "A" }) as Transaction;

describe("widgetul „Săptămâna banilor”", () => {
  it("ultimele 7 zile, azi la dreapta, cu total și comparație", () => {
    const data = createEmptyAppData();
    data.transactions = [tx("2026-10-03", 1250), tx("2026-09-30", 80), tx("2026-09-26", 999), tx("2026-09-23", 500)];
    const week = weekWidgetData(data, "2026-10-03");
    expect(week.days.map((d) => d.label)).toEqual(["D", "L", "Ma", "Mi", "J", "V", "S"]);
    expect(week.days[6]).toMatchObject({ amount: 1250, short: "1.3k", today: true });
    expect(week.days[3]).toMatchObject({ amount: 80, short: "80", today: false });
    expect(week.days[0].short).toBe("");
    expect(week).toMatchObject({ total: 1330, previous: 1499, change: -11 });
  });
});
