import { describe, expect, it } from "vitest";
import { interpretReceiptText, repairOcrLines, receiptReadIsReconciled } from "./receipt-utils";

const labels = (text: string[]) => interpretReceiptText(text).items.map((item) => `${item.label} ${item.amount}`);

describe("bon Profi de pe ecran", () => {
  const lines = [
    "PROFI ROSIORII DE VEDE",
    "Sep. 13, 2026  01:25PM",
    "Id Unic: 260913000121822",
    "C.I.F RO11607939",
    "LIPICI FIX STRONG 8,98",
    "3 buc @ 5,99",
    "Reducere 17,97 -8,99",
    "PASTE SPAGHETE BANEA 5,25",
    "1 buc @ 5,25",
    "LBP PISICI SNACK PER 5,89",
    "1 buc @ 5,89",
    "DOBROGEA MALAI GRISA 3,29",
    "1 buc @ 3,29",
    "LA MINUT LUX CLASIC 7,49",
    "1 buc @ 7,49",
    "SANT KID PIE MARO.2L 3,75",
    "1 buc @ 3,75",
    "DR.OETKER ZAHAR VANI 0,99",
    "1 buc @ 0,99",
    "KINDER SURPRISE 4,85",
    "1 buc @ 4,85",
    "CEREALE COOKIE CRISP 9,99",
    "1 buc @ 9,99",
    "Reducere 8,99",
    "Total Economisit 8,99",
    "Total 50,48",
    "Card **3286 50,48 lei",
    "TotalTVA 7,05 lei",
    "TVA Net TVA Total",
    "21 % 22,79 4,78 27,57",
    "11 % 20,64 2,27 22,91",
  ];

  it("ia TOTAL-ul plătit, nu economiile sau TVA", () => {
    const result = interpretReceiptText(lines);
    expect(result.vendor).toBe("Profi");
    expect(result.date).toBe("2026-09-13");
    expect(result.amount).toBe(50.48);
  });

  it("ține prețul net de pe ecran și nu scade reducerea a doua oară", () => {
    const result = interpretReceiptText(lines);
    expect(result.items.find((item) => /lipici/i.test(item.label))?.amount).toBe(8.98);
    expect(result.items.find((item) => /cereale/i.test(item.label))?.amount).toBe(9.99);
    expect(result.items.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(50.48, 2);
    expect(result.items.some((item) => /economisit|21 %|total tva/i.test(item.label))).toBe(false);
  });
});

describe("bon Familiaro cu SGR și reducere procentuală", () => {
  const lines = [
    "FAMILIARO",
    "S.C. SALES CONSULTING S.R.L.",
    "STRADA REPUBLICII NUMARUL 2",
    "ROSIORI DE VEDE",
    "JUDETUL TELEORMAN",
    "CIF : RO16929188",
    "AQUA CARPATICA KIDS PLATA PET 0.25L",
    "SGR",
    "1 PET X 2.58= 2.58 B",
    "GARANTIE PET SGR",
    "1 BUC X 0.50= 0.50 E",
    "PRIMOLA PAPI LAPTE 26.8G",
    "1 BUC X 2.98= 2.98 A",
    "PRIMOLA PAPI LAPTE 26.8G",
    "1 BUC X 2.98= 2.98 A",
    "FAMILIARO SACOSA MAIEU BIO 35X60CM",
    "1 BUC X 1.00= 1.00 A",
    "VEL PITAR PAINE ALBA FELIATA 300G",
    "1 BUC X 2.98= 2.98 B",
    "PERLA HARGHITEI APA MINERALA",
    "NATURALA CARBOGAZOASA PET 2L SGR",
    "6 PET X 3.48= 20.88 B",
    "REDUCERE 8.33%",
    "-1.74 B",
    "GARANTIE PET SGR",
    "6 BUC X 0.50= 3.00 E",
    "BUCOVINA APA",
    "MIN.NAT.NECARBOGAZIFICATA PLATA PET",
    "2L SGR",
    "6 PET X 3.48= 20.88 B",
    "REDUCERE 8.33%",
    "-1.74 B",
    "GARANTIE PET SGR",
    "6 BUC X 0.50= 3.00 E",
    "TOTAL LEI",
    "57.30",
    "NUMERAR LEI",
    "100.00",
    "REST LEI",
    "42.70",
    "TOTAL TVA A - 21%",
    "1.21",
    "TOTAL TVA B - 11%",
    "4.34",
    "TOTAL TVA E - 0%",
    "0.00",
    "TOTAL TVA BON",
    "5.55",
  ];

  it("citește magazinul, totalul plătit și garanțiile SGR", () => {
    const result = interpretReceiptText(lines);
    expect(result.vendor).toBe("Familiaro");
    expect(result.amount).toBe(57.3);
    expect(result.items.filter((item) => /garantie|garanție/i.test(item.label)).map((item) => item.amount).sort()).toEqual([0.5, 3, 3]);
  });

  it("aplică -1,74, nu 8,33% ca sumă, și păstrează cele două ape", () => {
    const result = interpretReceiptText(lines);
    const waters = result.items.filter((item) => /perla|bucovina|harghitei/i.test(item.label));
    expect(waters).toHaveLength(2);
    expect(waters.every((item) => item.amount === 19.14)).toBe(true);
    expect(result.items.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(57.3, 2);
    expect(result.items.some((item) => item.amount === 100 || item.amount === 42.7 || item.amount === 5.55)).toBe(false);
  });
});

describe("bon Sinsay mototolit", () => {
  it("scade fiecare REDUCERE din produsul de deasupra", () => {
    const result = interpretReceiptText([
      "sinsay",
      "LPP ROMANIA FASHION S.R.L.",
      "STR.CARPATI NR.132",
      "CENTR.COM.FUNSHOP PARK ROSIORII",
      "CIF: RO22418650",
      "0810B-98X-39H CIORAPI 1 BUC X 11.99= 11.99 E",
      "REDUCERE -3.42 E",
      "841JJ-99X-25 TENISI FE 1 BUC X 45.99= 45.99 E",
      "REDUCERE -13.15 E",
      "809EZ-MLC-ONE JUCARIE 1 BUC X 11.99= 11.99 E",
      "REDUCERE -3.43 E",
      "H6111-XXX-ONE PUNGA DE 1 BUC X 1.00= 1.00 E",
      "TOTAL LEI 50.97",
      "NUMERAR LEI 51.00",
      "REST LEI 0.03",
      "TOTAL TVA E - 21% 8.85",
      "TOTAL TVA BON 8.85",
    ]);
    expect(result.vendor).toBe("Sinsay");
    expect(result.amount).toBe(50.97);
    expect(result.items.map((item) => ({ label: item.label, amount: item.amount }))).toEqual([
      { label: "CIORAPI", amount: 8.57 },
      { label: "TENISI FE", amount: 32.84 },
      { label: "JUCARIE", amount: 8.56 },
      { label: "PUNGA DE", amount: 1 },
    ]);
  });
});

describe("bon Pepco cu numele după preț", () => {
  it("lipește denumirea de pe rândul următor de suma de pe rândul cu buc", () => {
    const result = interpretReceiptText([
      "PEPCO RETAIL SRL",
      "MUNICIPIUL ROSIORI DE VEDE",
      "STRADA CARPATI, NR.132, JUD. TELEORMAN",
      "COD IDENTIFICARE FISCALA: RO31477663",
      "1.000 buc x 3.50 3.50 A",
      "62621203 Chiloti de dama L Me",
      "PLU: 62821203",
      "Extra PLU: 2200362821260",
      "1.000 buc x 12.00 12.00 A",
      "63197402 Tricou barbati cu ri",
      "PLU: 63197402",
      "Extra PLU: 2200263197464",
      "TOTAL 15.50",
      "TOTAL TVA 2.69",
      "TVA A 21.00%",
      "CASH 15.50",
    ]);
    expect(result.vendor).toBe("Pepco");
    expect(result.amount).toBe(15.5);
    expect(labels([
      "PEPCO RETAIL SRL",
      "1.000 buc x 3.50 3.50 A",
      "62621203 Chiloti de dama L Me",
      "PLU: 62821203",
      "1.000 buc x 12.00 12.00 A",
      "63197402 Tricou barbati cu ri",
      "TOTAL 15.50",
      "CASH 15.50",
    ])).toEqual([
      "Chiloti de dama L Me 3.5",
      "Tricou barbati cu ri 12",
    ]);
  });
});

describe("OCR mototolit — aceleași 4 bonuri, text stricat", () => {
  it("reparează T0TAL LEI, sumele despărțite și s:nsay", () => {
    expect(repairOcrLines(["T0TAL LE1 50. 97", "1 BUC X 11.99=", "11.99 E"])).toEqual([
      "TOTAL LEI 50.97",
      "1 BUC X 11.99= 11.99 E",
    ]);
    const result = interpretReceiptText([
      "s:nsay",
      "LPP ROMANIA FASHION S.R.L.",
      "0810B-98X-39H CIORAPI 1 BUC X 11.99=",
      "11.99 E",
      "REDUCERE 3.42 E",
      "841JJ-99X-25 TENISI FE 1 BUC X 45.99= 45.99 E",
      "REDUCERE -13.15 E",
      "809EZ-MLC-ONE JUCARIE 1 BUC X 11.99= 11.99 E",
      "REDUCERE -3.43 E",
      "H6111-XXX-ONE PUNGA DE 1 BUC X 1.00= 1.00 E",
      "T0TAL LE1 50.97",
      "NUMERAR LEI 51.00",
      "REST LEI 0.03",
    ]);
    expect(result.vendor).toBe("Sinsay");
    expect(result.amount).toBe(50.97);
    expect(receiptReadIsReconciled(result)).toBe(true);
    expect(result.items.find((item) => /ciorapi/i.test(item.label))?.amount).toBe(8.57);
  });

  it("nu ia numerarul 100 lei de pe Familiaro, ci 57,30", () => {
    const result = interpretReceiptText([
      "FAMILIA RO",
      "AQUA CARPATICA KIDS PLATA PET 0.25L 1 PET X 2.58= 2.58 B",
      "GARANTIE PET SGR 1 BUC X 0.50= 0.50 E",
      "PRIMOLA PAPI LAPTE 26.8G 1 BUC X 2.98= 2.98 A",
      "PRIMOLA PAPI LAPTE 26.8G 1 BUC X 2.98= 2.98 A",
      "FAMILIARO SACOSA MAIEU BIO 1 BUC X 1.00= 1.00 A",
      "VEL PITAR PAINE ALBA 1 BUC X 2.98= 2.98 B",
      "PERLA HARGHITEI APA 6 PET X 3.48= 20.88 B",
      "REDUCERE 8.33%",
      "-1.74 B",
      "GARANTIE PET SGR 6 BUC X 0.50= 3.00 E",
      "BUCOVINA APA 6 PET X 3.48= 20.88 B",
      "REDUCERE 8.33%",
      "-1.74 B",
      "GARANTIE PET SGR 6 BUC X 0.50= 3.00 E",
      "T0TAL LEI",
      "57.30",
      "NUMERAR LEI 100.00",
      "REST LEI 42.70",
    ]);
    expect(result.vendor).toBe("Familiaro");
    expect(result.amount).toBe(57.3);
    expect(result.items.some((item) => item.amount === 100)).toBe(false);
    expect(receiptReadIsReconciled(result)).toBe(true);
  });

  it("la Pepco, dacă lipsește TOTAL, CASH e totalul plătit", () => {
    const result = interpretReceiptText([
      "PEPCO RETAIL SRL",
      "1.000 buc x 3.50 3.50 A",
      "62621203 Chiloti de dama L Me",
      "PLU: 62821203",
      "1.000 buc x 12.00 12.00 A",
      "63197402 Tricou barbati cu ri",
      "CASH 15.50",
    ]);
    expect(result.vendor).toBe("Pepco");
    expect(result.amount).toBe(15.5);
    expect(result.items).toHaveLength(2);
    expect(receiptReadIsReconciled(result)).toBe(true);
  });

  it("unește două ecrane Profi ale aceluiași bon, fără să dubleze LA MINUT", () => {
    const top = [
      "PROFI ROSIORII DE VEDE",
      "Sep. 13, 2026 01:25PM",
      "LIPICI FIX STRONG 8,98",
      "3 buc @ 5,99",
      "Reducere 17,97 -8,99",
      "PASTE SPAGHETE BANEA 5,25",
      "LBP PISICI SNACK PER 5,89",
      "DOBROGEA MALAI GRISA 3,29",
      "LA MINUT LUX CLASIC 7,49",
    ];
    const bottom = [
      "LA MINUT LUX CLASIC 7,49",
      "1 buc @ 7,49",
      "SANT KID PIE MARO.2L 3,75",
      "DR.OETKER ZAHAR VANI 0,99",
      "KINDER SURPRISE 4,85",
      "CEREALE COOKIE CRISP 9,99",
      "Reducere 8,99",
      "Total Economisit 8,99",
      "Total 50,48",
      "Card **3286 50,48 lei",
    ];
    const result = interpretReceiptText([...top, ...bottom]);
    expect(result.vendor).toBe("Profi");
    expect(result.date).toBe("2026-09-13");
    expect(result.amount).toBe(50.48);
    expect(result.items.filter((item) => /la minut/i.test(item.label))).toHaveLength(1);
    expect(receiptReadIsReconciled(result)).toBe(true);
  });
});
