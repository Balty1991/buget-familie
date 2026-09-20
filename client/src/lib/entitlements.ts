/**
 * Planuri Casa / Familia. Play Billing se lipește aici după listare.
 * Până atunci totul e deblocat — nu blocăm registrul familiei care testează.
 *
 * Purchase flow: STUB. Nu există apeluri Billing / IAP cât `BILLING_LIVE === false`.
 * SKU-urile din `PLAY_PRODUCT_IDS` sunt doar mapare pentru când activăm pluginul
 * (vezi docs/BILLING_PLAY_PREP.md). Nu simula plăți.
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
  casa: { id: "casa", envelopes: 10, members: 1, devices: 1, aiOnlinePerDay: 20, priceMonth: 0, priceYear: 0 },
  familie: { id: "familie", envelopes: Number.POSITIVE_INFINITY, members: 6, devices: 6, aiOnlinePerDay: 100, priceMonth: 19.99, priceYear: 149 },
};

/** Product IDs sugerate în Play Console — stub până la Billing live. */
export const PLAY_PRODUCT_IDS = {
  familieMonth: "familie_lunar",
  familieYear: "familie_anual",
} as const;

export type BillingSku = typeof PLAY_PRODUCT_IDS[keyof typeof PLAY_PRODUCT_IDS];

/** Trial pe Familia când Billing e live (Play Console + copy UI). */
export const TRIAL_DAYS = 14;

export const planLimits = (id: PlanId) => PLANS[id];

/** Preț catalog pentru UI, ex. "19,99 lei/lună". Casa → "Gratuit". */
export const formatPlanPriceRon = (plan: PlanId, period: "month" | "year"): string => {
  const row = PLANS[plan];
  const value = period === "month" ? row.priceMonth : row.priceYear;
  if (value <= 0) return "Gratuit";
  const amount = value.toLocaleString("ro-RO", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return period === "month" ? `${amount} lei/lună` : `${amount} lei/an`;
};

/** Când Billing e live, unlock-ul vine din Play. Acum e mereu Familia. */
export const currentPlan = (): PlanId => (BILLING_LIVE ? "casa" : "familie");

export const isFamilie = () => currentPlan() === "familie";

export const canAddEnvelope = (count: number) => isFamilie() || count < PLANS.casa.envelopes;
export const canAddMember = (count: number) => isFamilie() || count < PLANS.casa.members;
export const canUseFamilySync = () => isFamilie();
