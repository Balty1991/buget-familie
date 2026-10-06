/**
 * Câte bilanțuri de săptămână au plecat către partener.
 * Nu e abonamentul: doar ca să știm când a trecut primul, cel gratuit.
 * Plata rămâne în Google Play, când listarea e live.
 */
import { safeSetItem } from "@/lib/safe-storage";

export const OFFER_SENDS_KEY = "buget-familie:offer-sends";
export const OFFER_SENDS_EVENT = "buget-familie:offer-sends";

const storage = () => (typeof window === "undefined" ? null : window.localStorage);

export function readOfferSends(): number {
  const raw = storage()?.getItem(OFFER_SENDS_KEY);
  const count = raw ? Number(raw) : 0;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function noteOfferSend(): number {
  const next = readOfferSends() + 1;
  const store = storage();
  if (store) safeSetItem(store, OFFER_SENDS_KEY, String(next));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFER_SENDS_EVENT));
  return next;
}

/** Primul bilanț nu are preț. După el apare suma. De la al treilea, oferta stă pe an. */
export function houseOfferPhase(sends: number): "ready" | "priced" | "repeat" {
  const count = Number.isFinite(sends) && sends > 0 ? Math.floor(sends) : 0;
  if (count <= 0) return "ready";
  if (count === 1) return "priced";
  return "repeat";
}
