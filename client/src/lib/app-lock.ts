import { safeSetItem } from "@/lib/safe-storage";
/**
 * Blocare locală opțională a aplicației cu un PIN de 4 cifre, doar pe acest telefon.
 * PIN-ul nu este niciodată salvat în clar, nu intră în backup și nu face parte din
 * pachetul sincronizat între telefoane — e strict o protecție a ecranului local.
 */
const ENABLED_KEY = "buget-familie:lock-enabled";
const HASH_KEY = "buget-familie:lock-hash";
const SALT_KEY = "buget-familie:lock-salt";
const ATTEMPTS_KEY = "buget-familie:lock-attempts";

export const APP_LOCK_BACKGROUND_RELOCK_MS = 30_000;

const encoder = new TextEncoder();
const iterations = 150_000;

const toBase64 = (bytes: Uint8Array) => {
  let output = "";
  bytes.forEach((byte) => { output += String.fromCharCode(byte); });
  return btoa(output);
};

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function deriveHash(pin: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, 256);
  return toBase64(new Uint8Array(bits));
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);

export function isAppLockEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function hasAppLockPin(): boolean {
  try {
    return Boolean(window.localStorage.getItem(HASH_KEY));
  } catch {
    return false;
  }
}

export async function setAppLockPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("PIN-ul trebuie să aibă exact 4 cifre.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(pin, salt);
  if (!safeSetItem(window.localStorage, SALT_KEY, toBase64(salt))
    || !safeSetItem(window.localStorage, HASH_KEY, hash)
    || !safeSetItem(window.localStorage, ENABLED_KEY, "true")) {
    throw new Error("Nu am putut salva PIN-ul: spațiul local este plin.");
  }
}

/** Cât mai trebuie așteptat după prea multe PIN-uri greșite (0 = se poate încerca). */
export function appLockWaitSeconds(now = Date.now()): number {
  try {
    const state = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) || "{}") as { until?: number };
    return Math.max(0, Math.ceil(((state.until || 0) - now) / 1000));
  } catch {
    return 0;
  }
}

/**
 * 4 cifre înseamnă 10.000 de variante: fără pauză, cineva cu telefonul în mână le
 * încearcă într-o seară. După 5 greșeli la rând, așteptarea crește: 30 s, 60 s, 120 s…
 */
export async function verifyAppLockPin(pin: string): Promise<boolean> {
  if (appLockWaitSeconds() > 0) return false;
  let ok = false;
  try {
    const saltRaw = window.localStorage.getItem(SALT_KEY);
    const hash = window.localStorage.getItem(HASH_KEY);
    ok = Boolean(saltRaw && hash && await deriveHash(pin, fromBase64(saltRaw)) === hash);
  } catch {
    ok = false;
  }
  try {
    if (ok) window.localStorage.removeItem(ATTEMPTS_KEY);
    else {
      const state = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) || "{}") as { count?: number };
      const count = (state.count || 0) + 1;
      const until = count >= 5 ? Date.now() + 30_000 * 2 ** Math.min(6, count - 5) : 0;
      safeSetItem(window.localStorage, ATTEMPTS_KEY, JSON.stringify({ count, until }));
    }
  } catch {
    /* fără stocare, fără contor */
  }
  return ok;
}

export function disableAppLock(): void {
  try {
    window.localStorage.removeItem(ENABLED_KEY);
    window.localStorage.removeItem(HASH_KEY);
    window.localStorage.removeItem(SALT_KEY);
    window.localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    /* ignore */
  }
}
