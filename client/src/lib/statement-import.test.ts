import { describe, expect, it } from "vitest";
import { createEmptyAppData, addReviewDrafts } from "./finance-data";
import { parseStatementAmount, parseStatementCsv, parseStatementDate, splitCsv, statementDrafts } from "./statement-import";

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
