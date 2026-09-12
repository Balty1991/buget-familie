/**
 * Puntea dintre widgetul Android / dala din Setări rapide și aplicația web.
 *
 * Nativul nu împinge nimic către pagină: la o pornire rece pagina nu există încă,
 * iar un mesaj trimis atunci s-ar pierde. În schimb, nativul reține acțiunea cerută,
 * iar pagina o ridică singură când e gata și de fiecare dată când revine în prim-plan.
 */
export type QuickAction = "expense" | "receipt" | "today";

const KNOWN: QuickAction[] = ["expense", "receipt", "today"];

type NativeBridge = { consume?: () => string };

const bridge = (): NativeBridge | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { BugetFamilieQuickAction?: NativeBridge }).BugetFamilieQuickAction;
};

/** Întoarce acțiunea cerută o singură dată; nativul o uită imediat ce a fost citită. */
export function consumeQuickAction(): QuickAction | undefined {
  try {
    const value = bridge()?.consume?.();
    return value && KNOWN.includes(value as QuickAction) ? (value as QuickAction) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ascultă acțiunile venite din afara aplicației. Verifică la montare și la fiecare
 * revenire în prim-plan. Dacă puntea nativă întârzie (WebView Capacitor), reîncearcă
 * scurt — altfel o apăsare pe widget la pornire rece se pierdea.
 */
export function observeQuickActions(handle: (action: QuickAction) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  let stopped = false;
  let retries = 0;
  const check = () => {
    const action = consumeQuickAction();
    if (action) handle(action);
  };
  const onVisibility = () => { if (document.visibilityState === "visible") check(); };
  const boot = () => {
    if (stopped) return;
    if (bridge()) {
      check();
      return;
    }
    if (retries < 20) {
      retries += 1;
      window.setTimeout(boot, 100);
    }
  };
  boot();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", check);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", check);
  };
}
