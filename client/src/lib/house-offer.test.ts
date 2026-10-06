import { describe, expect, it } from "vitest";
import { houseOfferPhase } from "./house-offer";

describe("oferta de casă", () => {
  it("ține primul bilanț gratuit și cere banii abia după", () => {
    expect(houseOfferPhase(0)).toBe("ready");
    expect(houseOfferPhase(-3)).toBe("ready");
    expect(houseOfferPhase(Number.NaN)).toBe("ready");
    expect(houseOfferPhase(1)).toBe("priced");
    expect(houseOfferPhase(2)).toBe("repeat");
    expect(houseOfferPhase(2.9)).toBe("repeat");
  });
});
