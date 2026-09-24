import { describe, expect, it } from "vitest";
import { createEmptyAppData, addReviewDrafts } from "./finance-data";
import { decodeStatement, learnedMerchantCategories, merchantKey, parseStatementAmount, parseStatementCsv, parseStatementDate, splitCsv, statementDrafts, statementMerchant } from "./statement-import";

describe("sume din extras", () => {
  it("citește formatul românesc și pe cel englezesc", () => {
    expect(parseStatementAmount("1.234,56")).toBe(1234.56);
    expect(parseStatementAmount("1,234.56")).toBe(1234.56);
    expect(parseStatementAmount("45,90")).toBe(45.9);
    expect(parseStatementAmount("45.90")).toBe(45.9);
    expect(parseStatementAmount("120")).toBe(120);
    expect(parseStatementAmount("1.500")).toBe(1500);
  });

  it("păstrează semnul, inclusiv în paranteze sau cu minus la final", () => {
    expect(parseStatementAmount("-45,90")).toBe(-45.9);
    expect(parseStatementAmount("(45,90)")).toBe(-45.9);
    expect(parseStatementAmount("45,90-")).toBe(-45.9);
    expect(parseStatementAmount("1.234,56 RON")).toBe(1234.56);
  });

  it("întoarce undefined pentru text fără cifre", () => {
    expect(parseStatementAmount("")).toBeUndefined();
    expect(parseStatementAmount("Sold final")).toBeUndefined();
  });
});

describe("date din extras", () => {
  it("citește zi-lună-an și an-lună-zi", () => {
    expect(parseStatementDate("07.09.2026")).toBe("2026-09-07");
    expect(parseStatementDate("07/09/2026")).toBe("2026-09-07");
    expect(parseStatementDate("2026-09-07")).toBe("2026-09-07");
    expect(parseStatementDate("07.09.26")).toBe("2026-09-07");
  });

  it("refuză o zi care nu există în luna citită", () => {
    expect(parseStatementDate("31.02.2026")).toBeUndefined();
    expect(parseStatementDate("45.45.2026")).toBeUndefined();
    expect(parseStatementDate("fără dată")).toBeUndefined();
  });
});

describe("citirea câmpurilor", () => {
  it("respectă ghilimelele și separatorul din interiorul lor", () => {
    expect(splitCsv('a;"b;c";d', ";")).toEqual([["a", "b;c", "d"]]);
    expect(splitCsv('"spune ""da""";2', ";")).toEqual([['spune "da"', "2"]]);
  });
});

describe("extras cu o singură coloană de sumă", () => {
  const csv = [
    "Data;Descriere;Suma;Valuta",
    "07.09.2026;LIDL DISCOUNT SRL BUCURESTI;-145,90;RON",
    "08.09.2026;Salariu septembrie;4.500,00;RON",
    "09.09.2026;NETFLIX.COM;-49,99;RON",
  ].join("\n");

  it("citește semnul ca sens al mișcării", () => {
    const parsed = parseStatementCsv(csv);
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows).toEqual([
      { line: 2, date: "2026-09-07", description: "LIDL DISCOUNT SRL BUCURESTI", amount: 145.9, kind: "expense" },
      { line: 3, date: "2026-09-08", description: "Salariu septembrie", amount: 4500, kind: "income" },
      { line: 4, date: "2026-09-09", description: "NETFLIX.COM", amount: 49.99, kind: "expense" },
    ]);
  });

  it("propune categorii din descriere, fără a salva nimic", () => {
    const data = createEmptyAppData();
    const { drafts, duplicates } = statementDrafts(data, parseStatementCsv(csv).rows, { sourceId: "source-debit", memberId: "member-me", fileName: "extras.csv" });
    expect(duplicates).toBe(0);
    expect(drafts.map((item) => item.transaction.category)).toEqual(["Alimente", "Venit", "Timp liber"]);
    expect(drafts.every((item) => item.origin === "import")).toBe(true);
    // Propunerile nu ating registrul până la confirmare.
    const withDrafts = addReviewDrafts(data, drafts);
    expect(withDrafts.transactions).toEqual([]);
    expect(withDrafts.pendingReview).toHaveLength(3);
  });
});

describe("extras cu coloane separate de debit și credit", () => {
  const csv = [
    "Data tranzactiei,Data procesarii,Detalii tranzactie,Debit,Credit",
    "07/09/2026,07/09/2026,\"Plata la KAUFLAND ROMANIA, Bucuresti\",145.90,",
    "08/09/2026,08/09/2026,Incasare salariu,,4500.00",
  ].join("\n");

  it("citește coloanele separate și virgula din interiorul descrierii", () => {
    const parsed = parseStatementCsv(csv);
    expect(parsed.delimiter).toBe(",");
    expect(parsed.rows).toEqual([
      { line: 2, date: "2026-09-07", description: "Plata la KAUFLAND ROMANIA, Bucuresti", amount: 145.9, kind: "expense" },
      { line: 3, date: "2026-09-08", description: "Incasare salariu", amount: 4500, kind: "income" },
    ]);
  });
});

describe("extras fără antet recunoscut", () => {
  it("deduce coloanele din conținut", () => {
    const csv = ["07.09.2026;Cumparaturi Profi;-89,50", "08.09.2026;Alimentare card;250,00"].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.headers).toEqual([]);
    expect(parsed.rows.map((row) => row.amount)).toEqual([89.5, 250]);
    expect(parsed.rows.map((row) => row.kind)).toEqual(["expense", "income"]);
  });
});

describe("rânduri care nu pot fi citite", () => {
  it("le raportează în loc să le ignore tăcut", () => {
    const csv = [
      "Data;Descriere;Suma",
      "07.09.2026;Cumparaturi;-45,90",
      "Sold final;;1.200,00",
      "09.09.2026;Comision;0,00",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.skipped).toEqual([
      { line: 3, reason: "Dată necitibilă" },
      { line: 4, reason: "Sumă lipsă sau zero" },
    ]);
  });

  it("explică fișierele care nu sunt extrase", () => {
    expect(() => parseStatementCsv("")).toThrow(/gol/);
    expect(() => parseStatementCsv("doar un rând")).toThrow(/rânduri/);
  });
});

describe("reimportarea aceleiași perioade", () => {
  const csv = ["Data;Descriere;Suma", "07.09.2026;Cumparaturi;-45,90", "08.09.2026;Benzina;-200,00"].join("\n");

  it("nu dublează mișcările deja confirmate", () => {
    let data = createEmptyAppData();
    const first = statementDrafts(data, parseStatementCsv(csv).rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(first.drafts).toHaveLength(2);
    data = { ...data, transactions: first.drafts.map((item) => item.transaction) };
    const second = statementDrafts(data, parseStatementCsv(csv).rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(second.drafts).toEqual([]);
    expect(second.duplicates).toBe(2);
  });

  it("nu dublează propunerile aflate încă în așteptare", () => {
    const data = createEmptyAppData();
    const first = statementDrafts(data, parseStatementCsv(csv).rows, { sourceId: "source-debit", memberId: "member-me" });
    const withDrafts = addReviewDrafts(data, first.drafts);
    const second = statementDrafts(withDrafts, parseStatementCsv(csv).rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(second.drafts).toEqual([]);
    expect(second.duplicates).toBe(2);
  });

  it("nu dublează rândurile identice din același fișier", () => {
    const doubled = ["Data;Descriere;Suma", "07.09.2026;Cumparaturi;-45,90", "07.09.2026;Cumparaturi;-45,90"].join("\n");
    const result = statementDrafts(createEmptyAppData(), parseStatementCsv(doubled).rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(result.drafts).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });
});

describe("extrasul unui cont valutar", () => {
  const csv = ["Data;Descriere;Suma", "07.09.2026;Chirie Berlin;-450,00", "08.09.2026;Salariu;2.100,00"].join("\n");
  const withEuro = (rate?: number) => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [{ id: "source-euro", name: "Cont euro", kind: "card", memberId: "member-me", openingBalance: 0, currency: "EUR" }];
    if (rate) data.settings.exchangeRates = [{ currency: "EUR", rate, updatedAt: "2026-09-10T08:00:00.000Z" }];
    return data;
  };

  it("trece sumele în lei și păstrează valoarea originală", () => {
    const { drafts } = statementDrafts(withEuro(5), parseStatementCsv(csv).rows, { sourceId: "source-euro", memberId: "member-me" });
    expect(drafts.map((item) => item.transaction.amount)).toEqual([2250, 10500]);
    expect(drafts.map((item) => item.transaction.originalAmount)).toEqual([450, 2100]);
    expect(drafts.every((item) => item.transaction.originalCurrency === "EUR" && item.transaction.exchangeRate === 5)).toBe(true);
  });

  it("refuză importul fără curs, în loc să trateze euro drept lei", () => {
    const result = statementDrafts(withEuro(), parseStatementCsv(csv).rows, { sourceId: "source-euro", memberId: "member-me" });
    expect(result).toEqual({ drafts: [], duplicates: 0 });
  });

  it("recunoaște dublurile după suma în lei, nu după cea din fișier", () => {
    const data = withEuro(5);
    const first = statementDrafts(data, parseStatementCsv(csv).rows, { sourceId: "source-euro", memberId: "member-me" });
    const confirmed = { ...data, transactions: first.drafts.map((item) => item.transaction) };
    const second = statementDrafts(confirmed, parseStatementCsv(csv).rows, { sourceId: "source-euro", memberId: "member-me" });
    expect(second).toEqual({ drafts: [], duplicates: 2 });
  });
});

describe("exporturi bancare românești", () => {
  it("recunoaște BCR cu debit/credit și data procesării", () => {
    const csv = [
      "Data tranzactiei;Data procesarii;Descriere operatiune;Debit;Credit;Sold",
      "07.09.2026;07.09.2026;Plata POS MEGA IMAGE;145,90;;2.100,00",
      "08.09.2026;08.09.2026;Virament salariu;;4.500,00;6.600,00",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.bank).toBe("bcr");
    expect(parsed.rows).toEqual([
      { line: 2, date: "2026-09-07", description: "Plata POS MEGA IMAGE", amount: 145.9, kind: "expense" },
      { line: 3, date: "2026-09-08", description: "Virament salariu", amount: 4500, kind: "income" },
    ]);
  });

  it("recunoaște Banca Transilvania", () => {
    const csv = [
      "Data,Detalii tranzactie,Debit,Credit,Sold",
      "07/09/2026,Cumparaturi PROFI,89.50,,1200.00",
      "08/09/2026,Transfer primit,,250.00,1450.00",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.bank).toBe("bt");
    expect(parsed.rows.map((row) => row.kind)).toEqual(["expense", "income"]);
    expect(parsed.rows.map((row) => row.amount)).toEqual([89.5, 250]);
  });

  it("recunoaște ING cu coloana Nume", () => {
    const csv = [
      "Data;Nume;Debit;Credit",
      "07.09.2026;LIDL ROMANIA;62,30;",
      "09.09.2026;Salariu;;8500,00",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.bank).toBe("ing");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].description).toBe("LIDL ROMANIA");
  });

  it("citește Revolut RO (Completed Date + Amount semnat) și sare stările nefinalizate", () => {
    const csv = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
      "Card payment,Current,2026-09-07 10:00:00,2026-09-07 10:01:00,Glovo,-45.50,0.00,RON,COMPLETED,1200.00",
      "Topup,Current,2026-09-08 09:00:00,2026-09-08 09:00:01,Salary,3000.00,0.00,RON,COMPLETED,4200.00",
      "Card payment,Current,2026-09-08 11:00:00,2026-09-08 11:00:01,Failed shop,-12.00,0.00,RON,REVERTED,4200.00",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.bank).toBe("revolut");
    expect(parsed.rows).toEqual([
      { line: 2, date: "2026-09-07", description: "Glovo", amount: 45.5, kind: "expense" },
      { line: 3, date: "2026-09-08", description: "Salary", amount: 3000, kind: "income" },
    ]);
    expect(parsed.skipped).toEqual([{ line: 4, reason: "Stare nefinalizată" }]);
  });
});

describe("numele comerciantului", () => {
  it("scoate felul plății, cardul, codurile și orașul", () => {
    expect(statementMerchant("Plata la POS non-BT cu card VISA; LIDL DISCOUNT 0123 BUCURESTI RO; valoare tranzactie: 184,50 RON; RRN:123456789012")).toBe("Lidl");
    expect(statementMerchant("Plata la POS cu card MASTERCARD 5213XXXXXXXX1234; KAUFLAND 5920 CLUJ NAPOCA RO; TID:BT123456")).toBe("Kaufland");
    expect(statementMerchant("Cumparare POS 21.09.2026 CARREFOUR ROMANIA SA BUCURESTI RO")).toBe("Carrefour");
    expect(statementMerchant("PAYPAL *NETFLIX.COM 4029357733 LU")).toBe("Netflix.com");
    expect(statementMerchant("Plata OP inter - canal electronic; ENEL ENERGIE MUNTENIA SA; factura 123456")).toBe("Enel Energie Muntenia");
    expect(statementMerchant("Retragere numerar ATM BT 1234 CLUJ NAPOCA RO")).toBe("Retragere numerar");
    expect(statementMerchant("Incasare salariu ACME SOFTWARE SRL")).toBe("Salariu Acme Software");
  });

  it("preferă terminalul la ING și lasă neatinse numele deja curate", () => {
    expect(statementMerchant("Cumparare POS; Nr. card: ****1234; Terminal: MEGA IMAGE 0456 BUCURESTI RO; Data: 01-09-2026 Autorizare: 123456")).toBe("Mega Image");
    expect(statementMerchant("Glovo")).toBe("Glovo");
    expect(statementMerchant("Farmacia Catena")).toBe("Farmacia Catena");
  });

  it("cheia leagă același comerciant scris diferit", () => {
    expect(merchantKey("Mega Image")).toBe(merchantKey("MEGA IMAGE 0456"));
    expect(merchantKey("Lidl")).toBe("lidl");
    expect(merchantKey("")).toBe("");
  });
});

describe("luna scrisă în litere", () => {
  it("citește datele ING și exporturile englezești", () => {
    expect(parseStatementDate("02 septembrie 2026")).toBe("2026-09-02");
    expect(parseStatementDate("15 martie 2026")).toBe("2026-03-15");
    expect(parseStatementDate("3 noi. 2026")).toBe("2026-11-03");
    expect(parseStatementDate("2 Sep 2026")).toBe("2026-09-02");
    expect(parseStatementDate("31 februarie 2026")).toBeUndefined();
  });
});

describe("extrase reale, cap-coadă", () => {
  it("ING: detaliile de pe rândurile de sub mișcare se lipesc de ea", () => {
    const csv = [
      "Data,,,Detalii tranzactie,,Debit,Credit",
      "02 septembrie 2026,,,Cumparare POS,,\"45,20\",",
      ",,,Nr. card: ****1234,,,",
      ",,,Terminal: MEGA IMAGE 0456 BUCURESTI RO,,,",
      ",,,Data: 01-09-2026 Autorizare: 123456,,,",
      "05 septembrie 2026,,,Incasare,,,\"8.500,00\"",
      ",,,Ordonator: ACME SOFTWARE SRL,,,",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ date: "2026-09-02", amount: 45.2, kind: "expense" });
    expect(parsed.rows[0].description).toContain("Terminal: MEGA IMAGE");
    const { drafts } = statementDrafts(createEmptyAppData(), parsed.rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(drafts[0].transaction).toMatchObject({ title: "Mega Image", category: "Alimente" });
    expect(drafts[0].transaction.note).toContain("Terminal: MEGA IMAGE");
    expect(drafts[1].transaction).toMatchObject({ kind: "income", amount: 8500 });
  });

  it("Raiffeisen: beneficiarul și detaliile, fără IBAN", () => {
    const csv = [
      "Data inregistrare;Data tranzactiei;Suma debit;Suma credit;Nume/Denumire ordonator/beneficiar;Cod IBAN ordonator/beneficiar;Descrierea tranzactiei",
      "07.09.2026;06.09.2026;212,30;;ENEL ENERGIE MUNTENIA SA;RO49AAAA1B31007593840000;Plata factura 123",
      "08.09.2026;08.09.2026;;4.500,00;ACME SOFTWARE SRL;RO49AAAA1B31007593840001;Salariu septembrie",
    ].join("\n");
    const parsed = parseStatementCsv(csv);
    expect(parsed.bank).toBe("raiffeisen");
    expect(parsed.rows[0]).toMatchObject({ date: "2026-09-07", amount: 212.3, kind: "expense" });
    expect(parsed.rows[0].description).toBe("ENEL ENERGIE MUNTENIA SA; Plata factura 123");
    const { drafts } = statementDrafts(createEmptyAppData(), parsed.rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(drafts[0].transaction).toMatchObject({ title: "Enel Energie Muntenia", category: "Casă & facturi" });
  });

  it("BT: titlul e comerciantul, descrierea băncii rămâne în notiță", () => {
    const csv = [
      "Data tranzactie;Data valuta;Descriere;Referinta tranzactiei;Debit;Credit;Sold contabil",
      "21-09-2026;21-09-2026;Plata la POS non-BT cu card VISA; LIDL DISCOUNT 0123 BUCURESTI RO; valoare tranzactie: 184,50 RON;FT2626400001;-184,50;;3.815,50",
    ].join("\n").replace("VISA; LIDL", "VISA, LIDL").replace("RO; valoare", "RO, valoare");
    const parsed = parseStatementCsv(csv);
    expect(parsed.bank).toBe("bt");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].description).not.toContain("FT2626400001");
    const { drafts } = statementDrafts(createEmptyAppData(), parsed.rows, { sourceId: "source-debit", memberId: "member-me", fileName: "bt.csv" });
    expect(drafts[0].transaction.title).toBe("Lidl");
    expect(drafts[0].transaction.note).toContain("Plata la POS non-BT");
  });
});

describe("categorii învățate din registru", () => {
  const withHistory = () => {
    const data = createEmptyAppData();
    const tx = (id: string, title: string, category: string, date: string) => ({ id, title, amount: 50, kind: "expense" as const, category, source: "Card", person: "Eu", date, sourceId: "source-debit", memberId: "member-me" });
    data.transactions = [
      tx("h1", "Decathlon", "Consumabile copil", "2026-08-01"),
      tx("h2", "DECATHLON 12 BUCURESTI", "Consumabile copil", "2026-08-15"),
      tx("h3", "Decathlon", "Timp liber", "2026-08-20"),
      tx("h4", "Lidl", "Altele", "2026-08-21"),
    ];
    return data;
  };

  it("alege categoria cea mai des folosită la același comerciant", () => {
    const learned = learnedMerchantCategories(withHistory());
    expect(learned.get("decathlon")).toMatchObject({ category: "Consumabile copil", count: 2 });
    expect(learned.has("lidl")).toBe(false); // „Altele” nu învață nimic
  });

  it("o propune la import și spune de unde o știe", () => {
    const csv = ["Data;Descriere;Suma", "22.09.2026;Plata la POS cu card VISA DECATHLON 12 BUCURESTI RO;-320,00"].join("\n");
    const { drafts } = statementDrafts(withHistory(), parseStatementCsv(csv).rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(drafts[0].transaction).toMatchObject({ title: "Decathlon", category: "Consumabile copil" });
    expect(drafts[0].reason).toContain("ca data trecută la Decathlon");
  });

  it("regula scrisă de om câștigă în fața obiceiului", () => {
    const data = withHistory();
    data.settings.merchantRules = [{ id: "r1", match: "decathlon", category: "Timp liber" }];
    const csv = ["Data;Descriere;Suma", "22.09.2026;DECATHLON 12;-320,00"].join("\n");
    const { drafts } = statementDrafts(data, parseStatementCsv(csv).rows, { sourceId: "source-debit", memberId: "member-me" });
    expect(drafts[0].transaction.category).toBe("Timp liber");
  });
});

describe("codarea fișierului", () => {
  it("citește UTF-8 și Windows-1250", () => {
    const utf8 = new TextEncoder().encode("Plată;ş").buffer;
    expect(decodeStatement(utf8)).toBe("Plată;ş");
    // „Plată ş” în Windows-1250: ă = 0xE3, ş = 0xBA.
    const cp1250 = new Uint8Array([0x50, 0x6c, 0x61, 0x74, 0xe3, 0x20, 0xba]).buffer;
    expect(decodeStatement(cp1250)).toBe("Plată ş");
  });
});

describe("diacriticele din extras", () => {
  it("trec „ş/ţ” cu sedilă la „ș/ț” cu virgulă", () => {
    const parsed = parseStatementCsv("Data;Descriere;Suma\n21.09.2026;Plată Ştefan Ţurcanu;-10,00");
    expect(parsed.rows[0].description).toBe("Plată Ștefan Țurcanu");
  });
});
