/**
 * Recenzia din aplicație (Play In-App Review), cerută după un moment reușit: a doua repartizare
 * de salariu aplicată. Fără întrebare de filtrare („îți place?”), pe care politica Play o
 * descurajează. Doar în aplicația Android și o singură dată; Play decide oricum dacă arată
 * fereastra. „later” / „never” rămân citite, pentru cine a răspuns la cartonașul vechi.
 */
import { safeSetItem } from "./safe-storage";

const FIRST_USE_KEY = "buget-familie:first-use";
const REVIEW_KEY = "buget-familie:review-prompt";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ro.balty1991.bugetfamilie";
/** Câte repartizări reușite înainte de cerere: a doua arată că aplicația chiar e folosită. */
export const REVIEW_AFTER_SUCCESSES = 2;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function reviewPromptDue(storage: Storage, successes: number, native: boolean, now = Date.now()): boolean {
  if (!native || successes < REVIEW_AFTER_SUCCESSES) return false;
  try {
    let first = storage.getItem(FIRST_USE_KEY);
    if (!first) { safeSetItem(storage as globalThis.Storage, FIRST_USE_KEY, new Date(now).toISOString()); first = new Date(now).toISOString(); }
    if (now - Date.parse(first) < 7 * 86_400_000) return false;
    const state = storage.getItem(REVIEW_KEY) || "";
    if (state === "done" || state === "never") return false;
    if (state.startsWith("later:") && now < Date.parse(state.slice(6))) return false;
    return true;
  } catch {
    return false;
  }
}

export function answerReviewPrompt(storage: Storage, answer: "done" | "never" | "later", now = Date.now()) {
  const value = answer === "later" ? `later:${new Date(now + 60 * 86_400_000).toISOString()}` : answer;
  try { safeSetItem(storage as globalThis.Storage, REVIEW_KEY, value); } catch { /* fără stocare, fără memorie */ }
}

type ReviewPlugin = { requestReview: () => Promise<void> };

/** Fereastra de recenzie a Play, în aplicație. Dacă pluginul lipsește (APK vechi), nu face nimic. */
export async function requestInAppReview(): Promise<boolean> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return false;
    await registerPlugin<ReviewPlugin>("BugetFamilieNative").requestReview();
    return true;
  } catch {
    return false;
  }
}

/** Zile diferite cu măcar o cheltuială notată: semnul că notarea a devenit obicei. */
export const REVIEW_AFTER_LOGGED_DAYS = 10;

export function loggedDays(items: ReadonlyArray<{ date: string; kind: string }>): number {
  return new Set(items.filter((item) => item.kind === "expense").map((item) => item.date)).size;
}

/**
 * Alte momente reușite, pentru cine nu repartizează salariul: a zecea zi cu cheltuieli notate
 * sau imaginea lunii trimisă. Aceleași reguli (o săptămână de folosire, o singură dată).
 */
export async function askReviewAfterMilestone(storage: Storage = window.localStorage): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!reviewPromptDue(storage, REVIEW_AFTER_SUCCESSES, Capacitor.isNativePlatform())) return false;
    answerReviewPrompt(storage, "done");
  } catch {
    return false;
  }
  return requestInAppReview();
}
