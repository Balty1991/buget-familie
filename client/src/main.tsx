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
import { startPerformanceMonitoring } from "./lib/performance-monitor";
import { APP_VERSION } from "./lib/app-version";

if (Capacitor.getPlatform() === "android") document.documentElement.classList.add("capacitor-android");
if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add("is-android");

const syncAndroidNavOverlay = () => {
  if (!document.documentElement.classList.contains("is-android") && !document.documentElement.classList.contains("capacitor-android")) return;
  const viewport = window.visualViewport;
  const overlap = viewport ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)) : 0;
  document.documentElement.style.setProperty("--os-nav-overlay", `${Math.max(48, overlap)}px`);
};
syncAndroidNavOverlay();
window.addEventListener("resize", syncAndroidNavOverlay);
window.visualViewport?.addEventListener("resize", syncAndroidNavOverlay);

createRoot(document.getElementById("root")!).render(<App />);
startPerformanceMonitoring();

/** Foi atelier / ledger / redesign / visual-polish — după first paint; contrast-fix din nou, apoi polish. */
void import("./deferred-atelier.css").then(() => {
  void import("./contrast-fix.css").then(() => {
    void import("./visual-polish.css");
  });
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`).then((registration) => {
      void registration.update();
      if (registration.waiting) registration.waiting.postMessage("SKIP_WAITING");
    }).catch(() => undefined);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
