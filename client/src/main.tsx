import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./fonts-local.css";
import "./index.css";
import "./themes.css";
import "./expanded-themes.css";
import "./household-os-today.css";
import "./household-os-chrome.css";
import "./household-os-themes.css";
import "./play-ready-polish.css";
import "./visibility-safety.css";
import "./mobile-speed.css";
// Contrast pe critical path ca filled-urile din first paint să fie lizibile.
import "./contrast-fix.css";
import "./ledger-unify-2026.css";
import "./apk-safe-area.css";
import "./display-fixes-pass.css";
import "./ui-modern-pass.css";
import "./tokens.css";
import "./today.css";
import "./movements.css";
import { startPerformanceMonitoring } from "./lib/performance-monitor";
import { APP_VERSION } from "./lib/app-version";
import { hideNativeSplash, onAppRevealed } from "./lib/native-splash";
import {
  deferredStylesDelayMs,
  releaseServiceWorkerCache,
  scheduleDeferredStyles,
  shouldRegisterServiceWorker,
  startRamHygiene,
} from "./lib/ram-hygiene";

const platform = Capacitor.getPlatform();
if (platform === "android") document.documentElement.classList.add("capacitor-android");
if (/Android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add("is-android");
  if (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches) {
    document.documentElement.classList.add("is-android-standalone");
  }
}

createRoot(document.getElementById("root")!).render(<App />);

const idle = (fn: () => void, timeout: number) => {
  const win = window as Window & { requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number };
  if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(() => fn(), { timeout });
  else window.setTimeout(fn, Math.min(timeout, 400));
};

idle(() => startPerformanceMonitoring(), 2500);
startRamHygiene();

/* Overlay-ul HTML așteaptă Home. Fallback dacă First Run / Astăzi întârzie. */
window.setTimeout(hideNativeSplash, 1600);

/** Foi atelier — după reveal, târziu, ca first paint și WebView-ul să nu parseze ~1 MB CSS. */
onAppRevealed(() => {
  scheduleDeferredStyles(deferredStylesDelayMs(platform));
});

if (shouldRegisterServiceWorker(import.meta.env.PROD, platform) && "serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`).then((registration) => {
      void registration.update();
      if (hadController && registration.waiting) registration.waiting.postMessage("SKIP_WAITING");
    }).catch(() => undefined);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Prima instalare nu reîncarcă pagina: HTML-ul tocmai a venit din rețea.
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
} else if (platform === "android" || platform === "ios") {
  void releaseServiceWorkerCache();
}
