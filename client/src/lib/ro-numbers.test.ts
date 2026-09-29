import { describe, expect, it } from "vitest";
import { spokenAmountsToDigits } from "./ro-numbers";

describe("sume spuse în cuvinte", () => {
  it.each([
    ["cincizeci de lei pe benzina", "50 de lei pe benzina"],
    ["am dat o suta de lei la farmacie", "am dat 100 de lei la farmacie"],
    ["am dat o sută de lei la farmacie", "am dat 100 de lei la farmacie"],
    ["douăzeci de lei taxi", "20 de lei taxi"],
    ["am dat două sute pe alimente", "am dat 200 pe alimente"],
    ["o mie de lei pe telefon", "1000 de lei pe telefon"],
    ["două mii cinci sute pe mobilă", "2500 pe mobilă"],
    ["douăzeci și cinci de lei cafea", "25 de lei cafea"],
    ["trei lei apa", "3 lei apa"],
    ["cinspe lei parcare", "15 lei parcare"],
  ])("„%s”", (input, expected) => {
    expect(spokenAmountsToDigits(input)).toBe(expected);
  });

  it("prescurtări: 1,5k, 2k, 2 mii", () => {
    expect(spokenAmountsToDigits("1,5k pe laptop")).toBe("1500 pe laptop");
    expect(spokenAmountsToDigits("2k la vacanta")).toBe("2000 la vacanta");
    expect(spokenAmountsToDigits("2 mii pe frigider")).toBe("2000 pe frigider");
  });

  it("nu atinge ce nu e sumă", () => {
    for (const text of ["am dat de trei ori câte 25 de lei pe cafea", "o cafea 14", "un plic de 600", "pe 3 luni", "am cinci plicuri", "salariu 5000"]) {
      expect(spokenAmountsToDigits(text)).toBe(text);
    }
  });
});
