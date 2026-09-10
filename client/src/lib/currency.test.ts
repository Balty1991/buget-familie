/**
 * Valute: leul rămâne moneda de bază a registrului, iar cursul este introdus manual.
 * Testăm că nicio sumă nu este inventată în lipsa unui curs.
 */
import { describe, expect, it } from "vitest";
import {
  activeCurrencies,
  createEmptyAppData,
  currenciesMissingRate,
  exchangeRateFor,
  financialBalance,
  normalizeAppData,
  sourceBalance,
  sourceBalanceInCurrency,
  toBaseAmount,
  type AppData,
} from "./finance-data";

const withEuro = (rate?: number): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [
    { id: "source-debit", name: "Card debit", kind: "card", memberId: "member-me", openingBalance: 1000 },
    { id: "source-euro", name: "Cont euro", kind: "card", memberId: "member-me", openingBalance: 200, currency: "EUR" },
  ];
  if (rate) data.settings.exchangeRates = [{ currency: "EUR", rate, updatedAt: "2026-09-10T08:00:00.000Z" }];
  return data;
};

describe("cursul valutar", () => {
  it("leul are mereu cursul 1", () => {
    expect(exchangeRateFor(createEmptyAppData(), "RON")).toBe(1);
    expect(exchangeRateFor(createEmptyAppData(), undefined)).toBe(1);
  });

  it("întoarce cursul salvat manual", () => {
    expect(exchangeRateFor(withEuro(4.97), "EUR")).toBe(4.97);
    expect(exchangeRateFor(withEuro(4.97), "eur")).toBe(4.97);
  });

  it("nu inventează un curs care lipsește", () => {
    expect(exchangeRateFor(withEuro(), "EUR")).toBeUndefined();
    expect(toBaseAmount(200, undefined)).toBeUndefined();
    expect(toBaseAmount(200, 0)).toBeUndefined();
  });

  it("semnalează valutele fără curs", () => {
    expect(activeCurrencies(withEuro())).toEqual(["EUR"]);
    expect(currenciesMissingRate(withEuro())).toEqual(["EUR"]);
    expect(currenciesMissingRate(withEuro(4.97))).toEqual([]);
  });
});

describe("soldul unei surse valutare", () => {
  it("convertește soldul inițial în lei", () => {
    expect(sourceBalance(withEuro(5), "source-euro")).toBe(1000);
    expect(sourceBalance(withEuro(5), "source-debit")).toBe(1000);
  });

  it("lasă la zero soldul inițial valutar fără curs, în loc să inventeze o cifră", () => {
    expect(sourceBalance(withEuro(), "source-euro")).toBe(0);
  });

  it("scade mișcările, care sunt deja în lei", () => {
    const data = withEuro(5);
    data.transactions = [{ id: "t1", title: "Plată", amount: 250, kind: "expense", category: "Altele", source: "Cont euro", sourceId: "source-euro", person: "Eu", memberId: "member-me", date: "2026-09-08", originalAmount: 50, originalCurrency: "EUR", exchangeRate: 5 }];
    expect(sourceBalance(data, "source-euro")).toBe(750);
  });

  it("arată și soldul în valuta proprie, exact când toate mișcările au sumă originală", () => {
    const data = withEuro(5);
    data.transactions = [{ id: "t1", title: "Plată", amount: 250, kind: "expense", category: "Altele", source: "Cont euro", sourceId: "source-euro", person: "Eu", memberId: "member-me", date: "2026-09-08", originalAmount: 50, originalCurrency: "EUR", exchangeRate: 5 }];
    expect(sourceBalanceInCurrency(data, "source-euro")).toEqual({ currency: "EUR", amount: 150, exact: true });
  });

  it("marchează drept aproximativ soldul când o mișcare a fost introdusă în lei", () => {
    const data = withEuro(5);
    data.transactions = [{ id: "t1", title: "Plată", amount: 250, kind: "expense", category: "Altele", source: "Cont euro", sourceId: "source-euro", person: "Eu", memberId: "member-me", date: "2026-09-08" }];
    expect(sourceBalanceInCurrency(data, "source-euro")).toEqual({ currency: "EUR", amount: 150, exact: false });
  });

  it("nu întoarce nimic pentru o sursă în lei", () => {
    expect(sourceBalanceInCurrency(withEuro(5), "source-debit")).toBeUndefined();
  });
});

describe("registrul rămâne în lei", () => {
  it("bilanțul însumează echivalentul în lei, nu sume amestecate", () => {
    const data = withEuro(5);
    data.transactions = [
      { id: "t1", title: "Salariu", amount: 5000, kind: "income", category: "Venit", source: "Card debit", sourceId: "source-debit", person: "Eu", memberId: "member-me", date: "2026-09-01" },
      { id: "t2", title: "Plată euro", amount: 250, kind: "expense", category: "Altele", source: "Cont euro", sourceId: "source-euro", person: "Eu", memberId: "member-me", date: "2026-09-08", originalAmount: 50, originalCurrency: "EUR", exchangeRate: 5 },
    ];
    const balance = financialBalance(data);
    expect(balance.income).toBe(5000);
    expect(balance.expense).toBe(250);
    expect(balance.liquidFunds).toBe(6750);
  });
});

describe("migrarea datelor", () => {
  it("păstrează valuta sursei și suma originală a mișcării", () => {
    const migrated = normalizeAppData({
      settings: {
        paymentSources: [{ id: "s", name: "Cont euro", kind: "card", openingBalance: 100, currency: "eur" }],
        exchangeRates: [{ currency: "eur", rate: "4,97", updatedAt: "2026-09-10T08:00:00.000Z" }],
      },
      transactions: [{ id: "t", title: "Plată", amount: 497, kind: "expense", category: "Altele", sourceId: "s", date: "2026-09-08", originalAmount: 100, originalCurrency: "eur", exchangeRate: 4.97 }],
    });
    expect(migrated.settings.paymentSources[0].currency).toBe("EUR");
    expect(migrated.settings.exchangeRates).toEqual([{ currency: "EUR", rate: 4.97, updatedAt: "2026-09-10T08:00:00.000Z" }]);
    expect(migrated.transactions[0]).toMatchObject({ amount: 497, originalAmount: 100, originalCurrency: "EUR", exchangeRate: 4.97 });
  });

  it("ignoră o valută egală cu leul și un curs nevalid", () => {
    const migrated = normalizeAppData({
      settings: {
        paymentSources: [{ id: "s", name: "Card", kind: "card", openingBalance: 100, currency: "RON" }],
        exchangeRates: [{ currency: "EUR", rate: 0, updatedAt: "2026-09-10T08:00:00.000Z" }, { currency: "RON", rate: 1, updatedAt: "2026-09-10T08:00:00.000Z" }],
      },
      transactions: [{ id: "t", title: "Plată", amount: 100, kind: "expense", category: "Altele", sourceId: "s", date: "2026-09-08", originalCurrency: "RON", originalAmount: 100 }],
    });
    expect(migrated.settings.paymentSources[0].currency).toBeUndefined();
    expect(migrated.settings.exchangeRates).toEqual([]);
    expect(migrated.transactions[0].originalCurrency).toBeUndefined();
  });
});
