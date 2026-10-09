import { describe, expect, it } from "vitest";
import { isMonthLong, monthLongPart } from "./month-long";

describe("ce de pe bon ține o lună", () => {
  it("bonul Mega Image din 9 oct: detergentul și hrana pisicii, nu mâncarea", () => {
    const lines = [
      { label: "PAINE ALBA FELII", category: "Alimente", amount: 2.69 },
      { label: "M&M'S CIOCOLATA 82G", category: "Dulciuri", amount: 8.75 },
      { label: "KINDER JOY 20G", category: "Dulciuri", amount: 6.79 },
      { label: "ACTIMEL ACTIKIDS CAP", category: "Alimente", amount: 12.69 },
      { label: "ARIEL PODS EXTRA CLE", category: "Altele", amount: 32.09 },
      // Cititorul pune des hrana pisicii la Alimente: o recunoaștem după nume.
      { label: "ONE JUN PISICA PUI", category: "Alimente", amount: 32.49 },
      { label: "ARIEL PODS COLOR, 76", category: "Altele", amount: 70 },
    ];
    const part = monthLongPart(lines);
    expect(part.amount).toBeCloseTo(134.58, 2);
    expect(part.labels).toEqual(["ARIEL PODS EXTRA CLE", "ONE JUN PISICA PUI", "ARIEL PODS COLOR, 76"]);
  });

  it("igienă, haine, jucării: pe toată luna; apă, băuturi, fructe, SGR, sacoșă: pe săptămână", () => {
    expect(isMonthLong({ label: "Hârtie igienică Zewa", category: "Altele" })).toBe(true);
    expect(isMonthLong({ label: "Gel de duș Dove", category: "Alimente" })).toBe(true);
    expect(isMonthLong({ label: "Săpun lichid", category: "Altele" })).toBe(true);
    expect(isMonthLong({ label: "Odorizant cameră", category: "Altele" })).toBe(true);
    expect(isMonthLong({ label: "Body bebe", category: "Haine" })).toBe(true);
    expect(isMonthLong({ label: "Mașinuță", category: "Timp liber" })).toBe(true);
    expect(isMonthLong({ label: "Scutece Pampers 4", category: "Consumabile copil" })).toBe(true);
    expect(isMonthLong({ label: "Banane", category: "Alimente" })).toBe(false);
    expect(isMonthLong({ label: "Apă plată 2 L", category: "Apă" })).toBe(false);
    expect(isMonthLong({ label: "Vodka", category: "Băuturi" })).toBe(false);
    expect(isMonthLong({ label: "Garanție SGR", category: "SGR" })).toBe(false);
    expect(isMonthLong({ label: "Sacoșă", category: "Sacoșe" })).toBe(false);
  });

  it("bonul Familia RO din 9 oct: doar hârtia igienică și săpunul lichid, prescurtate pe bon", () => {
    const lines = [
      { label: "CODY H.IG.CELULOZA PIERSICA 3STR.10ROLE/SET 115FOI", category: "Altele", amount: 8.68 },
      { label: "BANEASA CONCHIGLIE 500G", category: "Alimente", amount: 4.88 },
      { label: "NUTLINE SEMINTE PESTRITE XXL USOR SARATE 135G", category: "Alimente", amount: 6.08 },
      { label: "FAMILIARO SACOSA MAIEU BIO 35X60CM", category: "Sacoșe", amount: 1 },
      { label: "REGAL OTET ALIM. 9 1L", category: "Alimente", amount: 4.38 },
      // Cititorul poate pune săpunul la Alimente: îl recunoaștem după prescurtare.
      { label: "TEO REZ.SAP.LICHID PURE SENSITIVE ALOE VERA 900ML", category: "Alimente", amount: 9.48 },
      { label: "KINDER BUENO WHITE T2 39G", category: "Dulciuri", amount: 4.48 },
      { label: "CORONITA ZAHAR ALB DE SEZON 1KG", category: "Alimente", amount: 4.88 },
      { label: "MAGGI SCRG GAINA -20 200G", category: "Alimente", amount: 9.88 },
      { label: "SUGUS JELEURI URSI 75G", category: "Dulciuri", amount: 5.78 },
      { label: "JACOBS 3IN1 INTENSE 11.1G", category: "Băuturi", amount: 1.96 },
      { label: "MEGGLE CREME PATISSERIE SPRAY 250ML", category: "Alimente", amount: 13.98 },
      { label: "MADELEINES CIOCOLATA 250G", category: "Dulciuri", amount: 5.98 },
      { label: "7DAYS MAX CROISSANT CACAO 80G", category: "Dulciuri", amount: 3.48 },
      { label: "OLYMPIA PASTA DE TOMATE 28 314GR", category: "Alimente", amount: 7.08 },
      { label: "BARILLA SOS BASILICO 400GR", category: "Alimente", amount: 9.48 },
      { label: "CHUPA CHUPS ACADELE WHEEL 12G", category: "Dulciuri", amount: 4.72 },
    ];
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBeCloseTo(106.2, 2);
    const part = monthLongPart(lines);
    expect(part.amount).toBeCloseTo(18.16, 2);
    expect(part.labels).toEqual(["CODY H.IG.CELULOZA PIERSICA 3STR.10ROLE/SET 115FOI", "TEO REZ.SAP.LICHID PURE SENSITIVE ALOE VERA 900ML"]);
  });
});
