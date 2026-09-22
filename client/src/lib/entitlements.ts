/**
 * Planuri Casa / Familia. Play Billing se lipește aici după listare.
 *
 * Casa e registrul unui om. Familia se cere în trei locuri: al doilea membru,
 * al doilea telefon, cota de ghid. Registrul nu se blochează niciodată.
 *
 * Purchase flow: STUB cât `BILLING_LIVE === false`. SKU-urile din
 * `PLAY_PRODUCT_IDS` așteaptă Play Console (docs/BILLING_PLAY_PREP.md).
 */
export const BILLING_LIVE = false;

export type PlanId = "casa" | "familie";
export type UpgradeReason = "member" | "sync" | "ai" | "envelope";

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

export const PLAY_PRODUCT_IDS = {
  familieMonth: "familie_lunar",
  familieYear: "familie_anual",
} as const;

export type BillingSku = typeof PLAY_PRODUCT_IDS[keyof typeof PLAY_PRODUCT_IDS];

export const TRIAL_DAYS = 14;
export const FAMILIE_OPEN_EVENT = "buget-familie:open-familie";

export const planLimits = (id: PlanId) => PLANS[id];

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

/** Câte luni cadou are anualul față de 12 × luna. 149 vs 19,99 × 12 → 4 luni. */
export const familieYearGiftMonths = (): number => {
  const month = PLANS.familie.priceMonth;
  if (month <= 0) return 0;
  return Math.max(0, Math.floor((month * 12 - PLANS.familie.priceYear) / month));
};

/** Când Billing e live, unlock-ul vine din Play. Până atunci gospodăria de test rămâne Familia. */
export const currentPlan = (): PlanId => (BILLING_LIVE ? "casa" : "familie");

export const isFamilie = () => currentPlan() === "familie";

export const canAddEnvelope = (count: number) => isFamilie() || count < PLANS.casa.envelopes;
export const canAddMember = (count: number) => isFamilie() || count < PLANS.casa.members;
export const canUseFamilySync = () => isFamilie();
export const canUseSettleUp = () => isFamilie();
export const canUseCycleClose = () => isFamilie();
export const aiDailyLimit = () => planLimits(currentPlan()).aiOnlinePerDay;

export function openFamilieCatalog() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FAMILIE_OPEN_EVENT));
}
