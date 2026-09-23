/**
 * Tur scurt „prima săptămână” după configurare.
 * Nu înlocuiește FirstRunSetup / CalmOnboarding — doar tipuri ușoare o dată.
 * Nu apare peste o captură deschisă, peste Sync, sau dacă încă n-ai nicio mișcare / plic
 * (skip „Mai târziu” nu trebuie să predea un discurs).
 */
import { safeSetItem, type StorageLike } from "./safe-storage";

export const FIRST_WEEK_TOUR_KEY = "buget-familie:first-week-tour-dismissed";
export const SETUP_COMPLETED_AT_KEY = "buget-familie:setup-completed-at";
export const ONBOARDING_COMPLETE_KEY = "buget-familie:onboarding-complete";
export const SETUP_COMPLETE_KEY = "buget-familie:setup-complete";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type { StorageLike };

export function markSetupCompletedAt(storage: StorageLike, when = new Date().toISOString()) {
  if (!storage.getItem(SETUP_COMPLETED_AT_KEY)) safeSetItem(storage, SETUP_COMPLETED_AT_KEY, when);
}

export function shouldShowFirstWeekTour(storage: StorageLike, blocked = false): boolean {
  if (blocked) return false;
  if (storage.getItem(FIRST_WEEK_TOUR_KEY)) return false;
  if (storage.getItem(SETUP_COMPLETE_KEY) !== "true") return false;
  const started = storage.getItem(SETUP_COMPLETED_AT_KEY);
  if (!started) {
    // Setup vechi fără timestamp: arată o singură dată, apoi marcăm fereastra ca începută.
    markSetupCompletedAt(storage);
    return true;
  }
  const ts = Date.parse(started);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts <= WEEK_MS;
}

/** Gata de afișat: setup făcut, e ceva de arătat, și nicio altă foaie nu stă deasupra. */
export function shouldOfferFirstWeekTour(opts: {
  storage: StorageLike;
  blocked?: boolean;
  hasModal?: boolean;
  onSyncScreen?: boolean;
  hasStarted?: boolean;
}): boolean {
  if (opts.blocked || opts.hasModal || opts.onSyncScreen || !opts.hasStarted) return false;
  return shouldShowFirstWeekTour(opts.storage, false);
}

export function markFirstWeekTourSeen(storage: StorageLike) {
  safeSetItem(storage, FIRST_WEEK_TOUR_KEY, "1");
}

/**
 * Inchide turul calm. Nu scrie setup-complete:
 * FirstRunSetup (cele 3 intenții) trebuie să rămână vizibil după „Sari peste”.
 */
export function completeOnboardingTourOnly(storage: StorageLike): void {
  safeSetItem(storage, ONBOARDING_COMPLETE_KEY, "true");
}

export type FirstWeekTipId = "capture" | "envelopes" | "sync";

export const FIRST_WEEK_TIPS: Array<{ id: FirstWeekTipId; kicker: string; title: string; detail: string }> = [
  {
    id: "capture",
    kicker: "1 · CAPTURĂ",
    title: "Notează o mișcare când se întâmplă.",
    detail: "Notează, pe Astăzi, sau un bon în De verificat. Nu trebuie să fie perfect — trebuie să fie pe telefon.",
  },
  {
    id: "envelopes",
    kicker: "2 · PLICURI",
    title: "Dă fiecărui leu un plic.",
    detail: "În Plan, sumele pe categorii îți arată ritmul până la salariu. Ajustezi oricând.",
  },
  {
    id: "sync",
    kicker: "3 · SYNC (OPȚIONAL)",
    title: "Două telefoane, o parolă de familie.",
    detail: "Sincronizarea e criptată și rămâne opțională. Poți folosi aplicația doar pe un telefon.",
  },
];
