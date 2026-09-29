import { describe, expect, it } from "vitest";
import { checkModelReceipt, looksLikeKnownProduct, printedReceiptTotal, receiptReadIsTrustworthy } from "./receipt-trust";

describe("citirea de pe telefon decide singură doar când se leagă", () => {
  it("bonul Mega Image mototolit: Mentos ca magazin și 7,99/kg ca total merg la model", () => {
    const local = {
      text: "Mentos peppermint\n1,000 Buc x 5,45 5,45 B\nPortocale\n0,506 Kg x 7,99 4,04 B\nTOTAL 66,00\nCASH 200,00",
      vendor: "Mentos peppermint",
      amount: 7.99,
      items: [
        { label: "Mentos peppermint", amount: 5.45, category: "Alimente", raw: "" },
        { label: "Portocale", amount: 4.04, category: "Alimente", raw: "" },
      ],
    };
    expect(receiptReadIsTrustworthy(local)).toBe(false);
  });

  it("un bon clar, cu produsele care dau totalul și magazinul corect, rămâne pe telefon", () => {
    const local = {
      text: "PROFI\nPaine 4,50\nLapte 7,20\nTOTAL 11,70",
      vendor: "Profi",
      amount: 11.7,
      items: [
        { label: "Paine", amount: 4.5, category: "Alimente", raw: "" },
        { label: "Lapte", amount: 7.2, category: "Alimente", raw: "" },
      ],
    };
    expect(receiptReadIsTrustworthy(local)).toBe(true);
  });

  it("magazinul cunoscut nu e luat drept produs", () => {
    expect(looksLikeKnownProduct("Mega Image")).toBe(false);
    expect(looksLikeKnownProduct("Mentos peppermint")).toBe(true);
  });
});

const megaLines = [
  { name: "Mentos peppermint", amount: 5.45 }, { name: "Portocale", amount: 4.04 }, { name: "Delaco lapte cafea", amount: 6.98 },
  { name: "Kinder Delice cocos", amount: 2.89 }, { name: "Univer ketchup dulce", amount: 9.49 }, { name: "Banane", amount: 7.2 },
  { name: "Crenvursti pui", amount: 6.99 }, { name: "Actimel Actikids", amount: 12.69 }, { name: "Oly iaurt grecesc", amount: 7.7 },
  { name: "Akadika acadele", amount: 2.19 }, { name: "Punga biodegradabila", amount: 0.38 },
];

describe("ce citește modelul de pe poză trece prin reguli fixe", () => {
  it("bonul Mega Image citit corect: 66 lei, sigur", () => {
    const read = checkModelReceipt({ amount: 66, vendor: "Mega Image", totalLabel: "TOTAL", cashGiven: 200, receiptLines: megaLines });
    expect(read).toMatchObject({ amount: 66, vendor: "Mega Image", confidence: "high" });
  });

  it("CASH 200 nu e totalul: suma vine din produse", () => {
    expect(checkModelReceipt({ amount: 200, vendor: "SULTING S.R.L.", totalLabel: "CASH", receiptLines: megaLines })?.amount).toBe(66);
    expect(checkModelReceipt({ amount: 200, cashGiven: 200, totalLabel: "TOTAL", receiptLines: megaLines })?.amount).toBe(66);
    expect(checkModelReceipt({ amount: 200, totalLabel: "NUMERAR" })).toBeUndefined();
  });

  it("plata exactă: CASH egal cu totalul rămâne total", () => {
    expect(checkModelReceipt({ amount: 66, cashGiven: 66, totalLabel: "TOTAL", receiptLines: megaLines })).toMatchObject({ amount: 66, confidence: "high" });
  });

  it("produsele care nu dau totalul: suma se arată ca „verifică”", () => {
    expect(checkModelReceipt({ amount: 66, totalLabel: "TOTAL", receiptLines: megaLines.slice(0, 3) })?.confidence).toBe("low");
  });

  it("un produs nu devine magazin", () => {
    expect(checkModelReceipt({ amount: 66, vendor: "Mentos peppermint", receiptLines: megaLines })?.vendor).toBeUndefined();
  });

  it("fără total și fără produse nu propune nimic", () => {
    expect(checkModelReceipt({ vendor: "Mega Image" })).toBeUndefined();
    expect(checkModelReceipt(undefined)).toBeUndefined();
  });
});

describe("citirea de pe telefon are nevoie de rândul TOTAL", () => {
  it("găsește TOTAL, nu TOTAL TVA", () => {
    expect(printedReceiptTotal("SUBTOTAL 66,00\nTOTAL 66,00\nTOTAL TVA 7,65\nCASH 200,00")).toBe(66);
    expect(printedReceiptTotal("TOTAL TVA 7,65")).toBeUndefined();
  });

  it("câteva produse care se adună (14,97) fără rândul TOTAL nu sunt un bon", () => {
    const local = {
      text: "MEGA IMAGE SRL\nMentos 5,45\nPortocale 4,04\nKinder 2,89\nAkadika 2,19\nPunga 0,38",
      vendor: "Mega Image",
      amount: 14.95,
      items: [
        { label: "Mentos", amount: 5.45, category: "Alimente", raw: "" },
        { label: "Portocale", amount: 4.04, category: "Alimente", raw: "" },
        { label: "Kinder", amount: 2.89, category: "Alimente", raw: "" },
        { label: "Akadika", amount: 2.19, category: "Alimente", raw: "" },
        { label: "Punga", amount: 0.38, category: "Alimente", raw: "" },
      ],
    };
    expect(receiptReadIsTrustworthy(local)).toBe(false);
  });
});
