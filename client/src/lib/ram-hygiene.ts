/**
 * Memorie pe telefon (WebView):
 * — pe APK nu înregistrăm service worker (cache dublu peste fișierele din pachet)
 * — foile atelier (~1 MB CSS) nu se parsează la 1 s după first paint
 * — la background / trim-memory eliberăm ce putem din JS
 */

let deferredStarted = false;
let deferredDone = false;
let deferredPromise: Promise<void> | undefined;
let loadStyles: () => Promise<void> = loadDeferredStyleSheets;
let hygieneBound = false;

async function loadDeferredStyleSheets() {
  await import("../deferred-atelier.css");
  await import("../contrast-fix.css");
  await import("../visual-polish.css");
  await import("../apk-safe-area.css");
  await import("../display-fixes-pass.css");
  // Modern pass MUST load after atelier/clarity (~1MB) or overrides vanish.
  await import("../ui-modern-pass.css");
  await import("../ui-modern-pass-aggressive.css");
}

/** PWA pe web; pe Capacitor Android/iOS fișierele sunt deja în pachet. */
export function shouldRegisterServiceWorker(isProd: boolean, platform: string): boolean {
  if (!isProd) return false;
  return platform !== "android" && platform !== "ios";
}

/** După first paint: destul de târziu ca First Run / Astăzi să nu lupte cu CSSOM. */
export function deferredStylesDelayMs(platform: string): number {
  return platform === "android" || platform === "ios" ? 10000 : 6000;
}

export function ensureDeferredStyles(): Promise<void> {
  if (deferredDone) return Promise.resolve();
  if (deferredStarted && deferredPromise) return deferredPromise;
  deferredStarted = true;
  deferredPromise = loadStyles()
    .then(() => {
      deferredDone = true;
    })
    .catch(() => {
      deferredStarted = false;
      deferredPromise = undefined;
    });
  return deferredPromise;
}

const idle = (fn: () => void, timeout: number) => {
  if (typeof window === "undefined") {
    fn();
    return;
  }
  const win = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
  };
  if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(() => fn(), { timeout });
  else window.setTimeout(fn, Math.min(timeout, 800));
};

/** Încarcă foile atelier pe idle, dar nu cât aplicația e în fundal. */
export function scheduleDeferredStyles(idleMs: number): void {
  idle(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      const onVisible = () => {
        if (document.visibilityState !== "visible") return;
        document.removeEventListener("visibilitychange", onVisible);
        void ensureDeferredStyles();
      };
      document.addEventListener("visibilitychange", onVisible);
      return;
    }
    void ensureDeferredStyles();
  }, idleMs);
}

export async function releaseServiceWorkerCache(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    /* fără SW — nimic de eliberat */
  }
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    /* Cache Storage indisponibil */
  }
}

function trimJsHeaps() {
  try {
    if (typeof window !== "undefined") window.__BF_WEB_VITALS__ = [];
  } catch {
    /* ignore */
  }
}

/** La plecarea din prim-plan: eliberăm măsurători și anunțăm stocarea de poze. */
export function startRamHygiene(onTrim?: () => void) {
  if (hygieneBound || typeof document === "undefined") return;
  hygieneBound = true;
  const trim = () => {
    trimJsHeaps();
    try {
      onTrim?.();
    } catch {
      /* igiena nu trebuie să strice ecranul */
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") trim();
  });
  window.addEventListener("buget-familie:trim-memory", trim);
}

export function resetRamHygieneForTests() {
  deferredStarted = false;
  deferredDone = false;
  deferredPromise = undefined;
  loadStyles = loadDeferredStyleSheets;
  hygieneBound = false;
}

export function setDeferredStyleLoaderForTests(loader: () => Promise<void>) {
  loadStyles = loader;
}

export function deferredStylesStateForTests() {
  return { started: deferredStarted, done: deferredDone };
}
