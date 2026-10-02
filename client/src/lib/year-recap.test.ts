import { describe, expect, it } from "vitest";
import { recapReady, recapYearFor, yearRecap } from "./year-recap";

let n = 0;
const tx = (date: string, title: string, category: string, amount: number, kind: "expense" | "income" = "expense", extra = {}) => ({ id: `t${++n}`, date, title, category, amount, kind, ...extra });

describe("anul vostru", () => {
  const items = [
    tx("2026-01-05", "Salariu", "Salariu", 5000, "income"),
    tx("2026-01-05", "Lidl", "Alimente", 300),
    tx("2026-01-06", "Lidl Discount 0123", "Alimente", 200),
    tx("2026-01-07", "lidl", "Alimente", 100),
    tx("2026-01-09", "Benzină", "Transport", 400),
    tx("2026-02-05", "Salariu", "Salariu", 5000, "income"),
    tx("2026-02-06", "Kaufland", "Alimente", 2500),
    tx("2026-02-07", "Ajustare", "Altele", 999, "expense", { adjustment: true }),
    tx("2025-12-30", "Lidl", "Alimente", 700),
  ];
  const recap = yearRecap(items, 2026, "2026-02-10");

  it("numără zilele, seria și zilele fără cheltuieli", () => {
    expect(recap.moves).toBe(7);
    expect(recap.loggedDays).toBe(6);
    expect(recap.longestStreak).toBe(3);
    // 5 ian – 10 feb = 37 de zile, cu cheltuieli în 5.
    expect(recap.noSpendDays).toBe(32);
  });

  it("strânge cheltuielile, veniturile și categoriile", () => {
    expect(recap.spent).toBe(3500);
    expect(recap.income).toBe(10000);
    expect(recap.keptShare).toBeCloseTo(0.65);
    expect(recap.categories[0]).toMatchObject({ name: "Alimente", amount: 3100 });
  });

  it("recunoaște același magazin scris diferit", () => {
    expect(recap.topPlace).toEqual({ name: "Lidl", visits: 3 });
  });

  it("alege luna în care a rămas cea mai mare parte din venit", () => {
    expect(recap.bestMonth).toMatchObject({ month: "2026-01", spent: 1000 });
    expect(recap.bestMonth?.keptShare).toBeCloseTo(0.8);
  });

  it("în ianuarie arată anul care s-a încheiat", () => {
    expect(recapYearFor("2027-01-12")).toBe(2026);
    expect(recapYearFor("2026-12-20")).toBe(2026);
  });

  it("nu se arată pentru câteva zile de registru", () => {
    expect(recapReady(recap)).toBe(false);
  });
});
