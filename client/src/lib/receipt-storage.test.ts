import { describe, expect, it } from "vitest";
import { receiptThumbKey } from "./receipt-storage";

describe("stocarea fotografiilor de bon", () => {
  it("derivă cheia miniaturii din cheia fotografiei complete, fără a atinge IndexedDB", () => {
    expect(receiptThumbKey("bon-1:image:0")).toBe("bon-1:thumb:0");
    expect(receiptThumbKey("bon-1:image:1")).toBe("bon-1:thumb:1");
    expect(receiptThumbKey("receipt-abc:image:0")).toBe("receipt-abc:thumb:0");
  });

  it("nu inventează miniaturi pentru chei care nu sunt fotografii complete", () => {
    expect(receiptThumbKey("bon-1:thumb:0")).toBeUndefined();
    expect(receiptThumbKey("bon-1")).toBeUndefined();
    expect(receiptThumbKey("image:0")).toBeUndefined();
  });
});
