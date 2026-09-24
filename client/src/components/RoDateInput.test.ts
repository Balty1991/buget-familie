import { describe, expect, it } from "vitest";
import { formatDateDraft } from "./RoDateInput";

describe("data scrisă pe tastatura numerică", () => {
  it("pune singură punctele: „10102026” devine „10.10.2026”", () => {
    expect(formatDateDraft("1")).toBe("1");
    expect(formatDateDraft("10")).toBe("10");
    expect(formatDateDraft("101")).toBe("10.1");
    expect(formatDateDraft("1010")).toBe("10.10");
    expect(formatDateDraft("10102")).toBe("10.10.2");
    expect(formatDateDraft("10102026")).toBe("10.10.2026");
    expect(formatDateDraft("101020261")).toBe("10.10.2026");
  });

  it("lasă neatinsă o dată scrisă deja cu separatori", () => {
    expect(formatDateDraft("1.10.2026")).toBe("1.10.2026");
    expect(formatDateDraft("10/10/2026")).toBe("10/10/2026");
  });
});
