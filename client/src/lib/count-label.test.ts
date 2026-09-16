/**
 * Registrul scria „1 mișcări” chiar pe primul rând. Numărătoarea românească are trei
 * forme, iar a doua („de mișcări”) începe de la 20 — regula se verifică aici o dată.
 */
import { describe, expect, it } from "vitest";
import { countLabel } from "./i18n";

const moves = { one: "{count} mișcare", few: "{count} mișcări", many: "{count} de mișcări" };

describe("countLabel", () => {
  it("singular doar la unu", () => {
    expect(countLabel(1, moves)).toBe("1 mișcare");
  });

  it("plural scurt de la doi la nouăsprezece", () => {
    expect(countLabel(2, moves)).toBe("2 mișcări");
    expect(countLabel(19, moves)).toBe("19 mișcări");
  });

  it("„de” de la douăzeci în sus și la sutele rotunde", () => {
    expect(countLabel(20, moves)).toBe("20 de mișcări");
    expect(countLabel(21, moves)).toBe("21 de mișcări");
    expect(countLabel(100, moves)).toBe("100 de mișcări");
    expect(countLabel(101, moves)).toBe("101 mișcări");
  });

  it("zero rămâne plural scurt", () => {
    expect(countLabel(0, moves)).toBe("0 mișcări");
  });
});
