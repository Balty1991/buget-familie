/**
 * Cererea de recenzie: o singură dată, după ce omul a folosit aplicația cu adevărat (3 săptămâni
 * și cel puțin 30 de mișcări), doar în aplicația Android. „Nu acum” amână 60 de zile; după
 * „Lasă o recenzie” sau „Nu mai întreba”, nu mai apare.
 */
import { safeSetItem } from "./safe-storage";

const FIRST_USE_KEY = "buget-familie:first-use";
const REVIEW_KEY = "buget-familie:review-prompt";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ro.balty1991.bugetfamilie";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function reviewPromptDue(storage: Storage, movements: number, native: boolean, now = Date.now()): boolean {
  if (!native || movements < 30) return false;
  try {
    let first = storage.getItem(FIRST_USE_KEY);
    if (!first) { safeSetItem(storage as globalThis.Storage, FIRST_USE_KEY, new Date(now).toISOString()); first = new Date(now).toISOString(); }
    if (now - Date.parse(first) < 21 * 86_400_000) return false;
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
