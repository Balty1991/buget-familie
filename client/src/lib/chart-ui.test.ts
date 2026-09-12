import { describe, expect, it } from "vitest";
import { chartBarHeight, hasChartValues, leiAxisTicks, leiLabel } from "./chart-ui";

describe("bare și etichete lei", () => {
  it("nu inventează înălțime pentru luni goale", () => {
    expect(chartBarHeight(0, 4000)).toBe(0);
    expect(chartBarHeight(-12, 4000)).toBe(0);
    expect(chartBarHeight(2000, 0)).toBe(0);
    expect(chartBarHeight(Number.NaN, 100)).toBe(0);
  });

  it("păstrează scara pentru valori reale", () => {
    expect(chartBarHeight(2000, 4000)).toBe(50);
    expect(chartBarHeight(40, 4000)).toBe(6);
    expect(chartBarHeight(4000, 4000)).toBe(100);
  });

  it("marchează un an gol fără bare false", () => {
    expect(hasChartValues([0, 0, 0])).toBe(false);
    expect(hasChartValues([0, 12, 0])).toBe(true);
  });

  it("axe lei: max / jumătate / 0", () => {
    expect(leiAxisTicks(0)).toEqual([0]);
    expect(leiAxisTicks(4000)).toEqual([4000, 2000, 0]);
  });

  it("etichete compacte în lei", () => {
    expect(leiLabel(0)).toMatch(/0/);
    expect(leiLabel(1480)).toMatch(/lei/);
    expect(leiLabel(4200, true)).toBe("4.2k lei");
    expect(leiLabel(12000, true)).toBe("12k lei");
  });
});
