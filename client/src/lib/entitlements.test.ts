import { describe, expect, it } from "vitest";
import { BILLING_LIVE, canAddEnvelope, canAddMember, canUseFamilySync, currentPlan, PLANS } from "./entitlements";

describe("planuri Casa / Familia", () => {
  it("până la Play Billing totul e deblocat, ca să nu blocăm registrul", () => {
    expect(BILLING_LIVE).toBe(false);
    expect(currentPlan()).toBe("familie");
    expect(canAddEnvelope(20)).toBe(true);
    expect(canAddMember(4)).toBe(true);
    expect(canUseFamilySync()).toBe(true);
  });

  it("Casa e gratuită și mărginită; Familia e un abonament de familie, nu per persoană", () => {
    expect(PLANS.casa.priceMonth).toBe(0);
    expect(PLANS.casa.envelopes).toBe(4);
    expect(PLANS.familie.priceYear).toBe(149);
    expect(PLANS.familie.priceMonth).toBe(19.99);
    expect(PLANS.familie.members).toBe(6);
  });
});
