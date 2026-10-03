import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { heatOf, moneyCalendar } from "./money-calendar";

let n = 0;
const tx = (date: string, amount: number, kind: "income" | "expense" = "expense") => ({ id: `t${++n}`, date, amount, kind, category: "Alimente", title: "x", sourceId: "card", source: "Card", person: "A" }) as Transaction;

describe("calendarul banilor", () => {
  it("pune zilele pe hartă după pragurile familiei", () => {
    expect(heatOf(0, [50, 150, 400])).toBe(0);
    expect(heatOf(30, [50, 150, 400])).toBe(1);
    expect(heatOf(100, [50, 150, 400])).toBe(2);
    expect(heatOf(300, [50, 150, 400])).toBe(3);
    expect(heatOf(900, [50, 150, 400])).toBe(4);
  });

  it("arată luna: cheltuieli, zile fără, săptămâni, facturile care vin și soldul estimat", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", openingBalance: 3000 }];
    data.transactions = [tx("2026-10-01", 100), tx("2026-10-02", 250), tx("2026-10-02", 50), tx("2026-10-01", 4000, "income")];
    data.recurring = [{ id: "net", name: "Internet", amount: 60, category: "Casă & facturi", sourceId: "card", memberId: "m", dueDay: 15, active: true }];
    const cal = moneyCalendar(data, "2026-10", "2026-10-03");
    // 1 octombrie 2026 e joi: trei celule goale înainte.
    expect(cal.offset).toBe(3);
    expect(cal.days).toHaveLength(31);
    expect(cal.spent).toBe(400);
    expect(cal.income).toBe(4000);
    expect(cal.noSpendDays).toBe(1);
    expect(cal.priciest).toEqual({ date: "2026-10-02", spent: 300 });
    expect(cal.weeks[0]).toEqual({ label: "1–4", spent: 400, future: false, due: 0 });
    expect(cal.weeks[2]).toMatchObject({ label: "12–18", future: true, due: 60 });
    expect(cal.days[2].balance).toBe(6600);
    const bill = cal.days[14];
    expect(bill.future).toBe(true);
    expect(bill.upcoming.map((item) => item.title)).toEqual(["Internet"]);
    expect(bill.balance).toBeLessThan(6600);
    expect(cal.days[0].heat).toBeGreaterThan(0);
  });

  it("lunile trecute nu au sold estimat", () => {
    const cal = moneyCalendar(createEmptyAppData(), "2026-08", "2026-10-03");
    expect(cal.days.every((day) => day.balance === undefined && !day.future)).toBe(true);
  });
});
