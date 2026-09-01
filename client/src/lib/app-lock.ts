/**
 * Blocare locală opțională a aplicației cu un PIN de 4 cifre, doar pe acest telefon.
 * PIN-ul nu este niciodată salvat în clar, nu intră în backup și nu face parte din
 * pachetul sincronizat între telefoane — e strict o protecție a ecranului local.
 */
const ENABLED_KEY = "buget-familie:lock-enabled";
const HASH_KEY = "buget-familie:lock-hash";
const SALT_KEY = "buget-familie:lock-salt";

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
  window.localStorage.setItem(SALT_KEY, toBase64(salt));
  window.localStorage.setItem(HASH_KEY, hash);
  window.localStorage.setItem(ENABLED_KEY, "true");
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  try {
    const saltRaw = window.localStorage.getItem(SALT_KEY);
    const hash = window.localStorage.getItem(HASH_KEY);
    if (!saltRaw || !hash) return false;
    const candidate = await deriveHash(pin, fromBase64(saltRaw));
    return candidate === hash;
  } catch {
    return false;
  }
}

export function disableAppLock(): void {
  try {
    window.localStorage.removeItem(ENABLED_KEY);
    window.localStorage.removeItem(HASH_KEY);
    window.localStorage.removeItem(SALT_KEY);
  } catch {
    /* ignore */
  }
}
