import { describe, expect, it } from "vitest";
import { mergeFamilyData } from "./family-crypto";
import { createEmptyAppData, type AppData } from "./finance-data";
import { recordRemovals } from "./sync-removals";

const withRates = (rates: AppData["settings"]["exchangeRates"]): AppData => {
  const data = createEmptyAppData();
  data.settings.exchangeRates = rates;
  return data;
};

describe("cursurile valutare se împart cu familia (#9)", () => {
  it("fiecare monedă ia cursul pus ultimul, de pe oricare telefon", () => {
    const mine = withRates([{ currency: "EUR", rate: 4.97, updatedAt: "2026-09-20T10:00:00.000Z" }]);
    const theirs = withRates([{ currency: "EUR", rate: 5.01, updatedAt: "2026-09-21T10:00:00.000Z" }, { currency: "USD", rate: 4.5, updatedAt: "2026-09-19T10:00:00.000Z" }]);
    for (const merged of [mergeFamilyData(mine, theirs), mergeFamilyData(theirs, mine)]) {
      const rates = Object.fromEntries(merged.settings.exchangeRates.map((item) => [item.currency, item.rate]));
      expect(rates).toEqual({ EUR: 5.01, USD: 4.5 });
    }
  });

  it("un curs șters nu revine de pe celălalt telefon", () => {
    const start = withRates([{ currency: "USD", rate: 4.5, updatedAt: "2026-09-19T10:00:00.000Z" }, { currency: "EUR", rate: 5, updatedAt: "2026-09-19T10:00:00.000Z" }]);
    const removed = recordRemovals(start, { ...start, settings: { ...start.settings, exchangeRates: start.settings.exchangeRates.filter((item) => item.currency !== "USD") } }, "2026-09-22T10:00:00.000Z");
    const merged = mergeFamilyData(removed, start);
    expect(merged.settings.exchangeRates.map((item) => item.currency)).toEqual(["EUR"]);
  });
});
