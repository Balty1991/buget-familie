import { describe, expect, it } from "vitest";
import {
  BILLING_LIVE,
  canAddEnvelope,
  canAddMember,
  canUseFamilySync,
  currentPlan,
  formatPlanPriceRon,
  planLimits,
  PLAY_PRODUCT_IDS,
  PLANS,
  TRIAL_DAYS,
} from "./entitlements";

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
    expect(PLANS.casa.envelopes).toBe(10);
    expect(PLANS.familie.priceYear).toBe(149);
    expect(PLANS.familie.priceMonth).toBe(19.99);
    expect(PLANS.familie.members).toBe(6);
    expect(planLimits("casa").envelopes).toBe(10);
    expect(planLimits("familie").members).toBe(6);
  });

  it("SKU Play stub + trial + prețuri RO pentru catalog (fără plăți reale)", () => {
    expect(PLAY_PRODUCT_IDS.familieMonth).toBe("familie_lunar");
    expect(PLAY_PRODUCT_IDS.familieYear).toBe("familie_anual");
    expect(TRIAL_DAYS).toBe(14);
    expect(formatPlanPriceRon("casa", "month")).toBe("Gratuit");
    expect(formatPlanPriceRon("familie", "month")).toBe("19,99 lei/lună");
    expect(formatPlanPriceRon("familie", "year")).toBe("149 lei/an");
  });
});
