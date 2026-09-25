/**
 * „Telefonul lui X”: pe telefonul unui copil sau al unui bunic, aplicația arată un singur
 * ecran — cât are azi persoana aceea și „Notează”. E o alegere a telefonului, nu a familiei:
 * stă în stocarea locală și nu se sincronizează.
 */
import { useEffect, useState } from "react";
import { safeSetItem } from "./safe-storage";
import { allocationStatus, type AppData } from "./finance-data";
import { envelopeUntilPayday, weekDayCap } from "./household-insights";

export const MEMBER_MODE_KEY = "buget-familie:member-mode-v1";
const PIN_KEY = "buget-familie:member-mode-pin-v1";
const PREVIOUS_SELF_KEY = "buget-familie:member-mode-previous-self";
const ATTEMPTS_KEY = "buget-familie:member-mode-attempts";

/**
 * Genitivul românesc pentru „Telefonul …”: Ana → Anei, Maria → Mariei, Andrei → lui Andrei.
 * Numele de femeie terminate în „a” primesc „-ei”; restul, „lui”.
 */
export const genitiveName = (name: string) => {
  const clean = name.trim();
  if (!clean) return "";
  return /[aă]$/i.test(clean) && clean.length > 2 ? `${clean.slice(0, -1)}ei` : `lui ${clean}`;
};

const encoder = new TextEncoder();
const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
async function derive(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return toBase64(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" }, material, 256)));
}

/** Codul de ieșire, ales de adult la pornire: fără el, copilul nu ajunge la bugetul familiei. */
export async function setMemberModePin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Codul trebuie să aibă 4 cifre.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  safeSetItem(window.localStorage, PIN_KEY, JSON.stringify({ salt: toBase64(salt), hash: await derive(pin, salt) }));
}

/** Cât mai trebuie așteptat după prea multe încercări greșite (0 = se poate încerca). */
export const memberModeWaitSeconds = (now = Date.now()) => {
  try {
    const state = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) || "{}") as { count?: number; until?: number };
    return Math.max(0, Math.ceil(((state.until || 0) - now) / 1000));
  } catch { return 0; }
};

/** Verifică codul; după 5 greșeli la rând, așteptarea crește: 30 s, 60 s, 120 s… */
export async function verifyMemberModePin(pin: string): Promise<boolean> {
  if (memberModeWaitSeconds() > 0) return false;
  let ok = false;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PIN_KEY) || "null") as { salt: string; hash: string } | null;
    ok = Boolean(stored && await derive(pin, fromBase64(stored.salt)) === stored.hash);
  } catch { ok = false; }
  try {
    const state = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) || "{}") as { count?: number; until?: number };
    if (ok) window.localStorage.removeItem(ATTEMPTS_KEY);
    else {
      const count = (state.count || 0) + 1;
      const until = count >= 5 ? Date.now() + 30_000 * 2 ** Math.min(6, count - 5) : 0;
      safeSetItem(window.localStorage, ATTEMPTS_KEY, JSON.stringify({ count, until }));
    }
  } catch { /* fără stocare, fără contor */ }
  return ok;
}

export const hasMemberModePin = () => { try { return Boolean(window.localStorage.getItem(PIN_KEY)); } catch { return false; } };

/** Cine era „eu” pe telefon înainte de mod: la ieșire, cheltuielile nu mai sunt ale copilului. */
export const rememberPreviousSelf = (memberId: string | undefined) => { try { safeSetItem(window.localStorage, PREVIOUS_SELF_KEY, memberId || ""); } catch { /* */ } };
export const takePreviousSelf = () => {
  try {
    const value = window.localStorage.getItem(PREVIOUS_SELF_KEY) || "";
    window.localStorage.removeItem(PREVIOUS_SELF_KEY);
    window.localStorage.removeItem(PIN_KEY);
    return value;
  } catch { return ""; }
};

export const readMemberMode = () => {
  try { return window.localStorage.getItem(MEMBER_MODE_KEY) || ""; } catch { return ""; }
};

export const writeMemberMode = (memberId: string) => {
  try {
    if (memberId) safeSetItem(window.localStorage, MEMBER_MODE_KEY, memberId);
    else window.localStorage.removeItem(MEMBER_MODE_KEY);
  } catch { /* fără stocare, modul ține doar până la închidere */ }
  window.dispatchEvent(new CustomEvent("buget-familie:member-mode", { detail: memberId }));
};

export function useMemberMode() {
  const [memberId, setMemberId] = useState(readMemberMode);
  useEffect(() => {
    const onChange = (event: Event) => setMemberId(String((event as CustomEvent<string>).detail || ""));
    window.addEventListener("buget-familie:member-mode", onChange);
    return () => window.removeEventListener("buget-familie:member-mode", onChange);
  }, []);
  return memberId;
}

/**
 * Cât are persoana azi: din plicurile ei (bani de buzunar, pensie pentru piață), dacă are;
 * altfel, cifra familiei de pe Astăzi. Pe plicurile pe săptămâni, cifra săptămânii.
 */
export function memberToday(data: AppData, memberId: string) {
  const own = data.settings.salaryPlan.allocations.filter((item) => item.memberId === memberId);
  if (!own.length) {
    // Fără plic propriu nu arătăm banii familiei: ecranul promite „fără restul bugetului”.
    return { own: false as const, today: 0, left: undefined, labels: [] as string[], days: undefined };
  }
  let today = 0;
  let left = 0;
  let days: number | undefined;
  for (const item of own) {
    const remaining = Math.max(0, allocationStatus(data, item).remaining);
    left += remaining;
    const cap = weekDayCap(data, item);
    const until = envelopeUntilPayday(data, item);
    if (until) days = until.days;
    today += cap ? cap.perDay : until ? remaining / Math.max(1, until.latestDays) : remaining;
  }
  return { own: true as const, today: Math.floor(today * 100) / 100, left: Math.round(left * 100) / 100, labels: own.map((item) => item.label), days };
}
