import { describe, expect, it } from "vitest";
import { createEmptyAppData, type Transaction } from "./finance-data";
import { moneyFlow, squarify, yearHeat } from "./chart-data";

let n = 0;
const tx = (date: string, amount: number, kind: "income" | "expense", category: string, title = category) => ({ id: `t${++n}`, date, amount, kind, category, title, sourceId: "c", source: "Card", person: "A" }) as Transaction;

describe("datele graficelor", () => {
  it("fluxul banilor: venituri pe nume, cheltuieli pe categorii, ce a rămas", () => {
    const data = createEmptyAppData();
    data.transactions = [tx("2026-09-10", 6000, "income", "Salariu"), tx("2026-09-25", 1000, "income", "Salariu"), tx("2026-09-12", 2000, "expense", "Alimente"), tx("2026-09-13", 1500, "expense", "Transport"), tx("2026-10-01", 999, "expense", "Alimente")];
    const flow = moneyFlow(data, "2026-09-01", "2026-09-30");
    expect(flow.income).toEqual([{ name: "Salariu", amount: 7000 }]);
    expect(flow.spend).toEqual([{ name: "Alimente", amount: 2000 }, { name: "Transport", amount: 1500 }, { name: "Rămas", amount: 3500 }]);
    expect(flow).toMatchObject({ total: 7000, kept: 3500, fromSavings: 0 });
  });

  it("fluxul banilor: când iese mai mult decât intră, diferența vine din economii", () => {
    const data = createEmptyAppData();
    data.transactions = [tx("2026-09-10", 1000, "income", "Salariu"), tx("2026-09-12", 1600, "expense", "Alimente")];
    const flow = moneyFlow(data, "2026-09-01", "2026-09-30");
    expect(flow.income.at(-1)).toEqual({ name: "Din economii", amount: 600 });
    expect(flow.total).toBe(1600);
  });

  it("harta anului: 53 de săptămâni, de luni până duminică, fără zile după azi", () => {
    const data = createEmptyAppData();
    data.transactions = [tx("2026-10-03", 120, "expense", "Alimente"), tx("2026-09-28", 40, "expense", "Alimente")];
    const heat = yearHeat(data, "2026-10-03");
    expect(heat.weeks).toHaveLength(53);
    const last = heat.weeks[52];
    // 3 octombrie 2026 e sâmbătă: luni 28 septembrie e prima zi din ultima coloană, duminica e goală.
    expect(last[0]?.date).toBe("2026-09-28");
    expect(last[5]?.date).toBe("2026-10-03");
    expect(last[6]).toBeNull();
    expect(heat).toMatchObject({ total: 160, activeDays: 2 });
    expect(heat.months.at(-1)?.month).toBe("2026-10");
  });

  it("treemap: dreptunghiurile acoperă tot și au aria pe măsura sumei", () => {
    const rects = squarify([{ name: "A", amount: 6 }, { name: "B", amount: 6 }, { name: "C", amount: 4 }, { name: "D", amount: 3 }, { name: "E", amount: 2 }, { name: "F", amount: 2 }, { name: "G", amount: 1 }], 600, 400);
    expect(rects).toHaveLength(7);
    const area = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(Math.abs(area - 240000)).toBeLessThan(5);
    const a = rects.find((r) => r.name === "A")!, g = rects.find((r) => r.name === "G")!;
    expect(Math.round((a.w * a.h) / (g.w * g.h))).toBe(6);
    for (const r of rects) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(600.01); expect(r.y + r.h).toBeLessThanOrEqual(400.01); }
    // Pătrățos: niciun dreptunghi nu e de peste 4 ori mai lung decât lat.
    for (const r of rects) expect(Math.max(r.w / r.h, r.h / r.w)).toBeLessThan(4);
  });
});
