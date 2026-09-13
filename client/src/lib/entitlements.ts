/**
 * Planuri Casa / Familia. Play Billing se lipește aici după listare.
 * Până atunci totul e deblocat — nu blocăm registrul familiei care testează.
 */
export const BILLING_LIVE = false;

export type PlanId = "casa" | "familie";

export const PLANS: Record<PlanId, {
  id: PlanId;
  envelopes: number;
  members: number;
  devices: number;
  aiOnlinePerDay: number;
  priceMonth: number;
  priceYear: number;
}> = {
  casa: { id: "casa", envelopes: 4, members: 1, devices: 1, aiOnlinePerDay: 20, priceMonth: 0, priceYear: 0 },
  familie: { id: "familie", envelopes: Number.POSITIVE_INFINITY, members: 6, devices: 6, aiOnlinePerDay: 100, priceMonth: 19.99, priceYear: 149 },
};

/** Când Billing e live, unlock-ul vine din Play. Acum e mereu Familia. */
export const currentPlan = (): PlanId => (BILLING_LIVE ? "casa" : "familie");

export const isFamilie = () => currentPlan() === "familie";

export const canAddEnvelope = (count: number) => isFamilie() || count < PLANS.casa.envelopes;
export const canAddMember = (count: number) => isFamilie() || count < PLANS.casa.members;
export const canUseFamilySync = () => isFamilie();
