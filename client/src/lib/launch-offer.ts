/**
 * Când se cere Familia, după ce billing-ul e live.
 *
 * Primul bilanț trimis e gratuit și nu pornește proba.
 * Al doilea bilanț, sau invitația către al doilea telefon, pornesc cele 30 de zile.
 * Proba nu pornește la instalare. Registrul nu se blochează niciodată aici.
 */
import { safeSetItem } from "@/lib/safe-storage";

export const WEEKLY_SHARES_KEY = "buget-familie:weekly-shares";
export const TRIAL_STARTED_KEY = "buget-familie:familie-trial-started";
export const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;

const storage = () => (typeof window === "undefined" ? null : window.localStorage);

export function readWeeklyShares(): number {
  const raw = storage()?.getItem(WEEKLY_SHARES_KEY);
  const count = raw ? Number(raw) : 0;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function trialStartedAt(): number | null {
  const raw = storage()?.getItem(TRIAL_STARTED_KEY);
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

export function familieTrialActive(now = Date.now()): boolean {
  const started = trialStartedAt();
  if (started === null) return false;
  return now < started + TRIAL_MS;
}

export function beginFamilieTrial(now = Date.now()): void {
  const store = storage();
  if (!store || trialStartedAt() !== null) return;
  safeSetItem(store, TRIAL_STARTED_KEY, new Date(now).toISOString());
}

function recordWeeklyShare(): void {
  const store = storage();
  if (!store) return;
  safeSetItem(store, WEEKLY_SHARES_KEY, String(readWeeklyShares() + 1));
}

export type OfferGate = "allow" | "blocked";

/**
 * `hasPaidFamilie` e abonamentul verificat, nu proba.
 * `otherPhoneLogged` e adevărat abia după o mișcare scrisă pe alt telefon.
 * Până atunci nu se numără și nu pornește proba: invitația rămâne gratuită.
 * Cât billing-ul e oprit, totul trece și nu se numără.
 */
export function gateWeeklyShare(opts: { billingLive: boolean; hasPaidFamilie: boolean; otherPhoneLogged?: boolean }, now = Date.now()): OfferGate {
  if (!opts.billingLive || opts.hasPaidFamilie || familieTrialActive(now)) return "allow";
  if (!opts.otherPhoneLogged) return "allow";
  // Proba consumată (bilanț sau invitație) nu se ocolește cu un bilanț „gratuit” rămas.
  if (trialStartedAt() !== null) return "blocked";
  if (readWeeklyShares() < 1) {
    recordWeeklyShare();
    return "allow";
  }
  beginFamilieTrial(now);
  recordWeeklyShare();
  return "allow";
}

/** Invitarea rămâne liberă până notează celălalt telefon. Apoi, după probă, se oprește. */
export function gateSecondPhone(opts: { billingLive: boolean; hasPaidFamilie: boolean; otherPhoneLogged?: boolean }, now = Date.now()): OfferGate {
  if (!opts.billingLive || opts.hasPaidFamilie || familieTrialActive(now)) return "allow";
  if (!opts.otherPhoneLogged) return "allow";
  if (trialStartedAt() === null) {
    beginFamilieTrial(now);
    return "allow";
  }
  return "blocked";
}
