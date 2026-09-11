import { describe, expect, it } from "vitest";
import { dateCopy, noDoubleStop, retimeText, shiftDay, today } from "./proposal-date";

const AZI = "2026-09-11";

describe("cum se scrie ziua unei propuneri", () => {
  it("spune zilele apropiate în cuvinte, nu în cifre", () => {
    expect(dateCopy("2026-09-11", AZI)).toBe("azi");
    expect(dateCopy("2026-09-10", AZI)).toBe("ieri");
    expect(dateCopy("2026-09-09", AZI)).toBe("alaltăieri");
    expect(dateCopy("2026-09-12", AZI)).toBe("mâine");
  });

  it("scrie data pentru orice altă zi", () => {
    expect(dateCopy("2026-09-03", AZI)).toMatch(/3/);
    expect(dateCopy("2026-09-03", AZI)).not.toBe("azi");
  });

  it("pornește de la ziua curentă când nu i se dă alta", () => {
    expect(dateCopy(today())).toBe("azi");
    expect(dateCopy(shiftDay(-1))).toBe("ieri");
  });
});

describe("punctul abrevierii", () => {
  it("nu dublează punctul după o lună scurtată", () => {
    expect(noDoubleStop("Am înțeles Taxi, 59 RON, 3 sept.. Alege sursa.")).toBe("Am înțeles Taxi, 59 RON, 3 sept. Alege sursa.");
  });

  it("îl curăță și când data este îngroșată, cu asteriscuri între puncte", () => {
    expect(noDoubleStop("Am înțeles **3 sept.**. Alege sursa.")).toBe("Am înțeles **3 sept.** Alege sursa.");
  });

  it("lasă neatins un text fără abreviere", () => {
    expect(noDoubleStop("Am înțeles **azi**. Alege sursa.")).toBe("Am înțeles **azi**. Alege sursa.");
  });

  it("nu strică punctele de suspensie", () => {
    expect(noDoubleStop("Citim fișierul... gata.")).toBe("Citim fișierul... gata.");
  });
});

describe("mutarea zilei într-o propunere deja afișată", () => {
  const text = "Am înțeles **Taxi**, 59 RON, **azi**. Alege de unde scoatem banii.";

  it("schimbă exact ziua scrisă, nimic altceva", () => {
    expect(retimeText(text, AZI, "2026-09-10", AZI)).toBe("Am înțeles **Taxi**, 59 RON, **ieri**. Alege de unde scoatem banii.");
  });

  it("nu lasă două puncte când ziua nouă e o lună scurtată", () => {
    const mutat = retimeText(text, AZI, "2026-09-03", AZI);
    expect(mutat).not.toMatch(/\.\./);
    expect(mutat).toMatch(/Alege de unde scoatem banii\.$/);
  });

  it("lasă textul neatins când ziua nu se schimbă", () => {
    expect(retimeText(text, AZI, AZI, AZI)).toBe(text);
  });

  it("nu inventează nimic dacă ziua veche nu apare în text", () => {
    const fara = "Am înțeles o cheltuială. Alege sursa.";
    expect(retimeText(fara, AZI, "2026-09-03", AZI)).toBe(fara);
  });
});
