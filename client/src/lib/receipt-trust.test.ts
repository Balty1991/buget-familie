import { describe, expect, it } from "vitest";
import { looksLikeKnownProduct, receiptReadIsTrustworthy } from "./receipt-trust";

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
