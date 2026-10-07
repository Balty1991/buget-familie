import { describe, expect, it } from "vitest";
import { guessCategoryFromText } from "./finance-data";

describe("articolele de pe bon își iau categoria lor", () => {
  it.each([
    ["Stalinskaya vodca 0.5L", "Băuturi"],
    ["Vodka", "Băuturi"],
    ["Vin rosu", "Băuturi"],
    ["Kinder Delice", "Dulciuri"],
    ["Ciocolata Milka", "Dulciuri"],
    ["Garantie sticla SGR", "SGR"],
    ["Sacoșă", "Sacoșe"],
    ["Familiaro sacosa maieu bio", "Sacoșe"],
    ["Garantie PET SGR", "SGR"],
    ["Aqua Carpatica Kids plata PET 0.25L SGR", "Apă"],
    ["Paine 500g", "Alimente"],
  ])("%s → %s", (label, category) => {
    expect(guessCategoryFromText(label)).toBe(category);
  });
});

describe("categoria veche „SGR și sacoșe” se desparte", () => {
  it("sacoșa merge la Sacoșe, garanția la SGR", async () => {
    const { splitLegacySgrCategory } = await import("./finance-data");
    expect(splitLegacySgrCategory("SGR și sacoșe", "Familiaro sacosa maieu bio")).toBe("Sacoșe");
    expect(splitLegacySgrCategory("SGR și sacoșe", "Garanție sticlă SGR")).toBe("SGR");
    expect(splitLegacySgrCategory("Alimente", "sacoșă")).toBe("Alimente");
  });
});
