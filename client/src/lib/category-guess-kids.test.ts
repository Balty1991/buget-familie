import { describe, expect, it } from "vitest";
import { guessCategoryFromText } from "./finance-data";
import { parseSpokenEntry } from "./voice-entry";

describe("lucrurile copilului ajung la „Consumabile copil”", () => {
  it.each(["Jucării", "jucarii", "o jucărie", "Lego", "păpușă", "cărucior", "suzete", "hăinuțe", "cadou pentru copii", "jucari"])("%s", (text) => {
    expect(guessCategoryFromText(text)).toBe("Consumabile copil");
  });

  it("„10 RON jucării” spus la microfon", () => {
    const spoken = parseSpokenEntry("10 RON jucării");
    expect(spoken.amount).toBe(10);
    expect(guessCategoryFromText(spoken.text || "")).toBe("Consumabile copil");
  });

  it("restul nu se strică", () => {
    expect(guessCategoryFromText("Lidl")).toBe("Alimente");
    expect(guessCategoryFromText("taxi")).toBe("Transport");
    expect(guessCategoryFromText("cadou aniversare")).toBe("Altele");
  });
});
