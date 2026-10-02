import { describe, expect, it } from "vitest";
import { parseSpokenEntry } from "./voice-entry";

describe("notarea din voce", () => {
  it.each([
    ["50 lei Lidl", 50, "Lidl"],
    ["cincizeci de lei la Lidl", 50, "Lidl"],
    ["am dat 45,50 pe benzină la OMV", 45.5, "Benzină la OMV"],
    ["Lidl 120", 120, "Lidl"],
    ["o sută douăzeci la farmacie", 120, "Farmacie"],
    ["pizza 78 lei", 78, "Pizza"],
    ["45 de lei și 50 de bani la Kaufland", 45.5, "Kaufland"],
    ["am plătit 1.250 lei chiria", 1250, "Chiria"],
  ])("„%s” → %s, %s", (phrase, amount, text) => {
    expect(parseSpokenEntry(phrase)).toMatchObject({ amount, text, income: false });
  });

  it("recunoaște o încasare", () => {
    expect(parseSpokenEntry("am primit 300 lei bonus")).toEqual({ amount: 300, text: "Bonus", income: true });
  });

  it("fără sumă păstrează doar denumirea", () => {
    expect(parseSpokenEntry("la Mega Image")).toEqual({ amount: undefined, text: "Mega Image", income: false });
  });
});
