/**
 * Nuanțe peste tema Alb: Sepia (hârtie caldă, fără albastru, pentru ochi obosiți seara)
 * și Copil (albastru vesel, colțuri mai rotunde). Pe temele întunecate nu schimbă nimic.
 */
import { safeSetItem } from "@/lib/safe-storage";

export type ThemeTint = "none" | "sepia" | "kid";
export const TINT_STORAGE_KEY = "buget-familie:tint";
const TINTS: ThemeTint[] = ["none", "sepia", "kid"];

export function readTint(storage: Pick<Storage, "getItem"> = window.localStorage): ThemeTint {
  try {
    const saved = storage.getItem(TINT_STORAGE_KEY);
    return TINTS.includes(saved as ThemeTint) ? (saved as ThemeTint) : "none";
  } catch {
    return "none";
  }
}

export function applyTint(tint: ThemeTint, root: HTMLElement = document.documentElement) {
  root.classList.toggle("bf-tint-sepia", tint === "sepia");
  root.classList.toggle("bf-tint-kid", tint === "kid");
}

export function saveTint(tint: ThemeTint) {
  applyTint(tint);
  safeSetItem(window.localStorage, TINT_STORAGE_KEY, tint);
}
