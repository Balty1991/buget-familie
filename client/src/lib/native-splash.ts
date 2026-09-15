/**
 * Handoff splash nativ / HTML → primul cadru real.
 *
 * Nu ascundem splash-ul pe rAF gol: așteptăm ca First Run, antetul sau
 * ecranul de PIN să aibă dimensiuni reale. Altfel se vede mint gol, apoi
 * cardul (sau antetul stricat, fără plic).
 *
 * .os-appbar e în DOM și la First Run, dar e display:none — luăm primul
 * nod VIZIBIL, nu primul din selector. Pentru antet cerem și display:flex
 * ca să nu dezvăluim HTML-ul înainte să se aplice CSS-ul.
 */

export type SplashBridge = {
  hide?: () => void;
  setChrome?: (navHex: string, lightIcons: boolean) => void;
  persistTheme?: (dark: boolean) => void;
};

declare global {
  interface Window {
    BugetFamilieSplash?: SplashBridge;
  }
}

let revealed = false;
const afterReveal: Array<() => void> = [];

const READY_SELECTOR = ".bf-first-run, .os-appbar, .bf-app-lock";

function paintThen(run: () => void, frames = 2) {
  const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
  if (!raf || frames <= 0) {
    run();
    return;
  }
  raf(() => paintThen(run, frames - 1));
}

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function nodePainted(node: Element): boolean {
  if (typeof (node as HTMLElement).getBoundingClientRect !== "function") return true;
  const box = node.getBoundingClientRect();
  if (box.height <= 48 || box.width <= 48) return false;
  try {
    if (typeof getComputedStyle !== "function") return true;
    const display = getComputedStyle(node).display;
    if (display === "none") return false;
    if (node.classList?.contains("os-appbar") && display !== "flex") return false;
  } catch {
    /* jsdom / teste fără CSSOM */
  }
  return true;
}

function firstScreenReady(): boolean {
  if (typeof document === "undefined") return true;
  const list = typeof document.querySelectorAll === "function"
    ? document.querySelectorAll(READY_SELECTOR)
    : typeof document.querySelector === "function"
      ? [document.querySelector(READY_SELECTOR)].filter(Boolean)
      : [];
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    if (node && nodePainted(node)) return true;
  }
  return false;
}

function waitUntilPainted(run: () => void) {
  const started = nowMs();
  const tick = () => {
    if (firstScreenReady() || nowMs() - started > 2800) {
      paintThen(run, 2);
      return;
    }
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
    if (raf) raf(tick);
    else run();
  };
  tick();
}

function revealDom() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("bf-ready");
    document.getElementById("bf-boot")?.setAttribute("hidden", "");
  }
}

/** Potrivește bara de navigare Android cu dock-ul și reține tema pentru următoarea lansare. */
export function syncAndroidChrome() {
  try {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const dark = document.documentElement.classList.contains("dark");
    window.BugetFamilieSplash?.setChrome?.(dark ? "#12161C" : "#EEF1EF", !dark);
    window.BugetFamilieSplash?.persistTheme?.(dark);
  } catch {
    /* puntea lipsește în browser */
  }
}

/** Ascunde splash-ul după primul cadru real — o singură dată. */
export function hideNativeSplash() {
  if (revealed) return;
  revealed = true;
  waitUntilPainted(() => {
    try {
      if (typeof window !== "undefined") window.BugetFamilieSplash?.hide?.();
    } catch {
      /* puntea lipsește în browser */
    }
    syncAndroidChrome();
    paintThen(() => {
      revealDom();
      afterReveal.splice(0).forEach((fn) => {
        try {
          fn();
        } catch {
          /* foile amânate nu trebuie să blocheze ecranul */
        }
      });
    }, 2);
  });
}

/** Rulează după ce splash-ul a fost ascuns (sau imediat, dacă deja e). */
export function onAppRevealed(fn: () => void) {
  const ready = typeof document !== "undefined" && document.documentElement.classList.contains("bf-ready");
  if (ready) {
    fn();
    return;
  }
  afterReveal.push(fn);
}

export function resetNativeSplashForTests() {
  revealed = false;
  afterReveal.length = 0;
  if (typeof document !== "undefined") document.documentElement.classList.remove("bf-ready");
}
