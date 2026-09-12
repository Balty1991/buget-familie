/**
 * Tur scurt „prima săptămână” după configurare.
 * Nu înlocuiește FirstRunSetup / CalmOnboarding — doar tipuri ușoare o dată.
 */
import { safeSetItem, type StorageLike } from "./safe-storage";

export const FIRST_WEEK_TOUR_KEY = "buget-familie:first-week-tour-dismissed";
export const SETUP_COMPLETED_AT_KEY = "buget-familie:setup-completed-at";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type { StorageLike };

export function markSetupCompletedAt(storage: StorageLike, when = new Date().toISOString()) {
  if (!storage.getItem(SETUP_COMPLETED_AT_KEY)) safeSetItem(storage, SETUP_COMPLETED_AT_KEY, when);
}

export function shouldShowFirstWeekTour(storage: StorageLike, blocked = false): boolean {
  if (blocked) return false;
  if (storage.getItem(FIRST_WEEK_TOUR_KEY)) return false;
  if (storage.getItem("buget-familie:setup-complete") !== "true") return false;
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

export function markFirstWeekTourSeen(storage: StorageLike) {
  safeSetItem(storage, FIRST_WEEK_TOUR_KEY, "1");
}

export type FirstWeekTipId = "capture" | "envelopes" | "sync";

export const FIRST_WEEK_TIPS: Array<{ id: FirstWeekTipId; kicker: string; title: string; detail: string }> = [
  {
    id: "capture",
    kicker: "1 · CAPTURĂ",
    title: "Notează o mișcare când se întâmplă.",
    detail: "Plusul de pe Astăzi sau un bon în De verificat. Nu trebuie să fie perfect — trebuie să fie pe telefon.",
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
