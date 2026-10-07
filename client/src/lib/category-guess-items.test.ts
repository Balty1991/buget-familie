import { describe, expect, it } from "vitest";
import { guessCategoryFromText } from "./finance-data";

describe("articolele de pe bon își iau categoria lor", () => {
  it.each([
    ["Stalinskaya vodca 0.5L", "Băuturi"],
    ["Vodka", "Băuturi"],
    ["Vin rosu", "Băuturi"],
    ["Kinder Delice", "Dulciuri"],
    ["Ciocolata Milka", "Dulciuri"],
    ["Garantie sticla SGR", "SGR și sacoșe"],
    ["Sacoșă", "SGR și sacoșe"],
    ["Familiaro sacosa maieu bio", "SGR și sacoșe"],
    ["Paine 500g", "Alimente"],
  ])("%s → %s", (label, category) => {
    expect(guessCategoryFromText(label)).toBe(category);
  });
});
