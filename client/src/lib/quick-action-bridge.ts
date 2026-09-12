/**
 * Puntea dintre widgetul Android / dala din Setări rapide și aplicația web.
 *
 * Nativul nu împinge nimic către pagină: la o pornire rece pagina nu există încă,
 * iar un mesaj trimis atunci s-ar pierde. În schimb, nativul reține acțiunea cerută,
 * iar pagina o ridică singură când e gata și de fiecare dată când revine în prim-plan.
 *
 * Șabloanele pe widget: doar id + etichetă (fără sume). JS publică ultimele 3
 * cheltuieli locale; nativul le arată pe widget și le întoarce ca „template:&lt;id&gt;”.
 */
export type QuickAction =
  | "expense"
  | "receipt"
  | "today"
  | { kind: "template"; templateId: string };

const KNOWN = new Set(["expense", "receipt", "today"]);

type NativeBridge = {
  consume?: () => string;
  publishTemplates?: (json: string) => void;
};

const bridge = (): NativeBridge | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { BugetFamilieQuickAction?: NativeBridge }).BugetFamilieQuickAction;
};

const parseAction = (value: string | undefined): QuickAction | undefined => {
  if (!value) return undefined;
  if (KNOWN.has(value)) return value as Exclude<QuickAction, { kind: "template" }>;
  if (value.startsWith("template:")) {
    const templateId = value.slice("template:".length).trim();
    return templateId ? { kind: "template", templateId } : undefined;
  }
  return undefined;
};

/** Întoarce acțiunea cerută o singură dată; nativul o uită imediat ce a fost citită. */
export function consumeQuickAction(): QuickAction | undefined {
  try {
    return parseAction(bridge()?.consume?.());
  } catch {
    return undefined;
  }
}

/**
 * Publică pe widget ultimele șabloane de cheltuială (id + etichetă, fără sume).
 * Pe web / fără punte nativă nu face nimic.
 */
export function publishWidgetTemplates(templates: Array<{ id: string; label: string }>): void {
  try {
    const payload = JSON.stringify(
      templates
        .filter((item) => item.id && item.label.trim())
        .slice(0, 3)
        .map((item) => ({ id: item.id, label: item.label.trim().slice(0, 28) })),
    );
    bridge()?.publishTemplates?.(payload);
  } catch {
    /* widgetul e opțional */
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
  const onVisibility = () => {
    if (document.visibilityState === "visible") check();
  };
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
