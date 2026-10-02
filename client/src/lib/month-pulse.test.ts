import { describe, expect, it } from "vitest";
import { dayLabel, monthPulse } from "./month-pulse";

let n = 0;
const tx = (date: string, category: string, amount: number, kind: "expense" | "income" = "expense", extra = {}) => ({ id: `t${++n}`, date, category, amount, kind, ...extra });

describe("pulsul lunii", () => {
  it("adună luna curentă pe categorii și compară cu luna trecută până în aceeași zi", () => {
    const pulse = monthPulse([
      tx("2026-10-01", "Alimente", 100), tx("2026-10-02", "Alimente", 50.5), tx("2026-10-02", "Transport", 30),
      tx("2026-10-01", "Salariu", 5000, "income"),
      tx("2026-09-01", "Alimente", 80), tx("2026-09-02", "Timp liber", 40), tx("2026-09-03", "Alimente", 999),
    ], "2026-10-02");
    expect(pulse.spent).toBe(180.5);
    expect(pulse.income).toBe(5000);
    expect(pulse.lastToDate).toBe(120);
    expect(pulse.slices).toEqual([{ category: "Alimente", amount: 150.5 }, { category: "Transport", amount: 30 }]);
    expect(pulse.rest).toBe(0);
  });

  it("nu numără ajustările de sold și mutările între surse", () => {
    const pulse = monthPulse([tx("2026-10-01", "Alimente", 100, "expense", { adjustment: true }), tx("2026-10-01", "Altele", 200, "expense", { transferId: "x" }), tx("2026-10-01", "Altele", 20)], "2026-10-02");
    expect(pulse.spent).toBe(20);
  });

  it("strânge categoriile mici în rest", () => {
    const pulse = monthPulse(["A", "B", "C"].map((c, i) => tx("2026-10-01", c, 10 * (i + 1))), "2026-10-05", 2);
    expect(pulse.slices.map((s) => s.category)).toEqual(["C", "B"]);
    expect(pulse.rest).toBe(10);
  });

  it("pe 31 martie compară cu toată luna februarie", () => {
    expect(monthPulse([tx("2027-02-28", "Alimente", 70)], "2027-03-31").lastToDate).toBe(70);
  });
});

describe("eticheta zilei", () => {
  it("spune Astăzi, Ieri, apoi ziua din săptămână", () => {
    expect(dayLabel("2026-10-02", "2026-10-02")).toBe("Astăzi");
    expect(dayLabel("2026-10-01", "2026-10-02")).toBe("Ieri");
    expect(dayLabel("2026-09-30", "2026-10-02")).toMatch(/^Miercuri, 30 septembrie$/);
    expect(dayLabel("2025-12-30", "2026-10-02")).toMatch(/2025/);
  });
});

describe("harta lunii", () => {
  it("o zi pe căsuță, cu treapta după cât s-a cheltuit", async () => {
    const { monthHeat } = await import("./month-pulse");
    const heat = monthHeat([tx("2026-10-01", "Alimente", 20), tx("2026-10-02", "Alimente", 40), tx("2026-10-03", "Casă & facturi", 1800), tx("2026-09-30", "Alimente", 99)], "2026-10-04");
    expect(heat).toHaveLength(31);
    expect(heat[0]).toMatchObject({ date: "2026-10-01", amount: 20, future: false });
    expect(heat[2].level).toBe(4);
    expect(heat[1].level).toBeGreaterThan(heat[0].level);
    expect(heat[3]).toMatchObject({ amount: 0, level: 0, future: false });
    expect(heat[4].future).toBe(true);
  });
});
