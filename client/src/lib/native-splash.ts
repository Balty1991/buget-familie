/** Ascunde splash-ul nativ după primul cadru real — nu înainte. */
export function hideNativeSplash() {
  try {
    (window as unknown as { BugetFamilieSplash?: { hide?: () => void } }).BugetFamilieSplash?.hide?.();
  } catch {
    /* puntea lipsește în browser */
  }
}
