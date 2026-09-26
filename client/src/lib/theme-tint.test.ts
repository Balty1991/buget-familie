import { describe, expect, it } from "vitest";
import { readTint, TINT_STORAGE_KEY } from "./theme-tint";

const store = (value: string | null) => ({ getItem: (key: string) => (key === TINT_STORAGE_KEY ? value : null) });

describe("nuanța temei Alb", () => {
  it("citește doar valorile cunoscute", () => {
    expect(readTint(store("sepia"))).toBe("sepia");
    expect(readTint(store("kid"))).toBe("kid");
    expect(readTint(store("neon"))).toBe("none");
    expect(readTint(store(null))).toBe("none");
  });
  it("nu cade când stocarea aruncă", () => {
    expect(readTint({ getItem: () => { throw new Error("blocat"); } })).toBe("none");
  });
});
