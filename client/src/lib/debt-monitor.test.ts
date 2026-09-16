import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { debtMonitor } from "./debt-monitor";

describe("monitorizare rate", () => {
  it("grupează plățile pe luni și păstrează soldul rămas", () => {
    const data = createEmptyAppData();
    data.debts = [
      { id: "d1", name: "Credit auto", remaining: 12000, monthly: 750, due: "10", tone: "forest" },
      { id: "d2", name: "Card magazin", remaining: 400, monthly: 200, due: "5", tone: "honey" },
    ];
    data.transactions = [
      { id: "t1", title: "Rată", amount: 750, kind: "expense", category: "Rate produse", source: "Card", person: "Eu", date: "2026-08-10", debtId: "d1" },
      { id: "t2", title: "Rată", amount: 200, kind: "expense", category: "Rate produse", source: "Card", person: "Eu", date: "2026-09-05", debtId: "d2" },
      { id: "t3", title: "Rată", amount: 750, kind: "expense", category: "Rate produse", source: "Card", person: "Eu", date: "2026-09-10", debtId: "d1" },
    ];
    const monitor = debtMonitor(data, 3, "2026-09-16");
    expect(monitor.remaining).toBe(12400);
    expect(monitor.monthly).toBe(950);
    expect(monitor.thisMonthPaid).toBe(950);
    expect(monitor.paidTotal).toBe(1700);
    expect(monitor.activeCount).toBe(2);
    const september = monitor.series.find((item) => item.key === "2026-09");
    expect(september?.paid).toBe(950);
    expect(monitor.byDebt[0]?.name).toBe("Credit auto");
    expect(monitor.byDebt[0]?.monthsLeft).toBe(16);
  });

  it("nu inventează monitorizare fără datorii și fără plăți", () => {
    const monitor = debtMonitor(createEmptyAppData(), 6, "2026-09-16");
    expect(monitor.remaining).toBe(0);
    expect(monitor.series).toHaveLength(6);
    expect(monitor.series.every((item) => item.paid === 0)).toBe(true);
  });
});
