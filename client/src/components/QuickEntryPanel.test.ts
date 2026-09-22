import { describe, expect, it } from "vitest";
import { entryLedgerAmount } from "./QuickEntryPanel";

describe("previzualizarea plății folosește leii din registru", () => {
  it("lasă suma în lei neschimbată", () => {
    expect(entryLedgerAmount(30, false)).toBe(30);
  });

  it("înmulțește euro cu cursul, nu scade unitățile tastate din soldul în lei", () => {
    expect(entryLedgerAmount(10, true, 5)).toBe(50);
  });

  it("nu inventează un curs când lipsește", () => {
    expect(entryLedgerAmount(10, true)).toBeUndefined();
    expect(entryLedgerAmount(0, true, 5)).toBe(0);
  });
});
