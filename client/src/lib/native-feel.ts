/**
 * Senzația de aplicație nativă: vibrația scurtă a sistemului, tranzițiile dintre ecrane și,
 * pe Android 12+, culorile luate din imaginea de fundal (Material You).
 * Pe web, vibrația cade pe navigator.vibrate (unde există), iar culorile dinamice nu se aplică.
 */
import { flushSync } from "react-dom";
import { isNativeApp } from "@/lib/app-storage";
import { safeSetItem } from "@/lib/safe-storage";

type NativeFeel = {
  haptic: (options: { kind: HapticKind }) => Promise<void>;
  systemAccent: () => Promise<{ supported: boolean; accent600?: string; accent700?: string; accent800?: string; accent200?: string; accent100?: string }>;
};
export type HapticKind = "tick" | "confirm" | "reject";

let plugin: Promise<NativeFeel | undefined> | undefined;
const native = () => {
  if (!isNativeApp()) return Promise.resolve(undefined);
  plugin ||= import("@capacitor/core").then(({ registerPlugin }) => registerPlugin<NativeFeel>("BugetFamilieNative")).catch(() => undefined);
  return plugin;
};

const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; } };

/** O atingere simțită: scurtă, a sistemului; o versiune veche a aplicației fără metodă tace. */
export function haptic(kind: HapticKind = "tick") {
  void native().then((api) => {
    if (api) return api.haptic({ kind }).catch(() => undefined);
    try { if (!reduced() && typeof navigator.vibrate === "function") navigator.vibrate(kind === "tick" ? 6 : kind === "confirm" ? 14 : [10, 40, 10]); } catch { /* fără vibrație */ }
    return undefined;
  });
}

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

/**
 * Schimbarea de ecran ca tranziție: vechiul ecran se estompează, noul urcă ușor (CSS în motion.css).
 * Fără API (WebView vechi) sau cu „Reduce mișcarea”, schimbarea se face direct.
 */
export function withViewTransition(update: () => void, fallback: () => void = update) {
  const doc = document as ViewTransitionDoc;
  if (typeof doc.startViewTransition !== "function" || reduced() || document.visibilityState !== "visible") { fallback(); return; }
  const root = document.documentElement;
  try {
    root.setAttribute("data-vt", "nav");
    const transition = doc.startViewTransition(() => { flushSync(update); });
    void transition.finished.finally(() => root.removeAttribute("data-vt"));
  } catch {
    root.removeAttribute("data-vt");
    fallback();
  }
}

export const DYNAMIC_COLOR_KEY = "buget-familie:dynamic-color";
export const readDynamicColor = () => { try { return localStorage.getItem(DYNAMIC_COLOR_KEY) === "1"; } catch { return false; } };

/**
 * Verdele aplicației e redefinit și pe containere (shell, Astăzi, ferestre), nu doar pe html: o regulă
 * cu `data-dynamic-color` și specificitate mai mare le acoperă pe toate, fără să atingem foile vechi.
 */
const SCOPES = ["", " .os-shell.bf-app", " .bf-today-workspace", " .bf-modal", " .bf-command-palette"];
export function dynamicColorCss(primary: string, strong: string) {
  const selector = SCOPES.map((scope) => `html[data-dynamic-color]${scope}`).join(", ");
  return `${selector} { --cf-primary: ${primary} !important; --cf-primary-strong: ${strong} !important; --os-mint: ${primary} !important; --bf-green: ${primary} !important; --cf-forest: ${strong} !important; --cf-link: ${strong} !important; --boot-accent: ${primary} !important; --bf-dock-accent: ${strong} !important; --cf-glow: color-mix(in srgb, ${primary} 18%, transparent) !important; }`;
}

/** Pune accentul telefonului peste tema aleasă; tema închisă primește nuanțele deschise. */
export function paintAccent(accent: { accent600?: string; accent700?: string; accent800?: string; accent200?: string; accent100?: string } | undefined, root = document.documentElement) {
  const old = document.getElementById("bf-dynamic-color");
  if (!accent?.accent600) { old?.remove(); root.removeAttribute("data-dynamic-color"); return; }
  const dark = root.classList.contains("theme-dark") || root.classList.contains("theme-navy") || root.classList.contains("dark");
  const primary = dark ? accent.accent200 || accent.accent600 : accent.accent600;
  const strong = dark ? accent.accent100 || primary : accent.accent800 || accent.accent700 || primary;
  const style = old || Object.assign(document.createElement("style"), { id: "bf-dynamic-color" });
  style.textContent = dynamicColorCss(primary, strong);
  if (!old) document.head.appendChild(style);
  root.setAttribute("data-dynamic-color", "1");
}

let cached: Awaited<ReturnType<NativeFeel["systemAccent"]>> | undefined;
let observer: MutationObserver | undefined;

/** Aplică (sau scoate) culorile telefonului; întoarce dacă telefonul le are. */
export async function applyDynamicColor(enabled = readDynamicColor()): Promise<boolean> {
  const api = await native();
  if (!api) { paintAccent(undefined); return false; }
  try { cached ||= await api.systemAccent(); } catch { cached = { supported: false }; }
  if (!cached.supported) { paintAccent(undefined); return false; }
  paintAccent(enabled ? cached : undefined);
  observer?.disconnect();
  if (enabled) {
    // La schimbarea temei (Alb ↔ Întunecat) refacem nuanța potrivită.
    observer = new MutationObserver(() => paintAccent(cached));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  return true;
}

export async function dynamicColorSupported() {
  const api = await native();
  if (!api) return false;
  try { cached ||= await api.systemAccent(); } catch { return false; }
  return Boolean(cached.supported);
}

export async function saveDynamicColor(enabled: boolean) {
  safeSetItem(localStorage, DYNAMIC_COLOR_KEY, enabled ? "1" : "0");
  return applyDynamicColor(enabled);
}
