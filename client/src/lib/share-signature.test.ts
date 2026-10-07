import { describe, expect, it } from "vitest";
import { SHARE_LINK, withShareSignature } from "./share-signature";

describe("semnătura mesajelor trimise", () => {
  it("adaugă o singură dată linkul și spune că nu e aplicație de plăți", () => {
    const once = withShareSignature("Bilanț");
    expect(once).toContain(SHARE_LINK);
    expect(once).toContain("Nu e aplicație de plăți");
    expect(withShareSignature(once)).toBe(once);
  });
});
