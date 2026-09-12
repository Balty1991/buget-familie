/**
 * Preferințe UI locale (nu intră în pachetul de sync).
 * Mod simplu / glosar văzut / prompt sold / doar offline — pe dispozitiv, via safeSetItem.
 */
import { safeSetItem } from "./safe-storage";

const SIMPLE_KEY = "buget-familie:simple-mode";
const GLOSSARY_KEY = "buget-familie:seen-envelope-glossary";
const BALANCE_PROMPT_KEY = "buget-familie:asked-opening-balance";
const OFFLINE_ONLY_KEY = "buget-familie:offline-only";

const storage = () => (typeof window !== "undefined" ? window.localStorage : null);

export function isSimpleMode(): boolean {
  try {
    return storage()?.getItem(SIMPLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSimpleMode(enabled: boolean): void {
  const store = storage();
  if (!store) return;
  if (enabled) safeSetItem(store, SIMPLE_KEY, "1");
  else {
    try {
      store.removeItem(SIMPLE_KEY);
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent("buget-familie:ui-prefs", { detail: { simpleMode: enabled } }));
}

/** Nu încarcă Firebase / sync cloud — registru doar pe telefon. */
export function isOfflineOnly(): boolean {
  try {
    return storage()?.getItem(OFFLINE_ONLY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOfflineOnly(enabled: boolean): void {
  const store = storage();
  if (!store) return;
  if (enabled) safeSetItem(store, OFFLINE_ONLY_KEY, "1");
  else {
    try {
      store.removeItem(OFFLINE_ONLY_KEY);
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent("buget-familie:ui-prefs", { detail: { offlineOnly: enabled } }));
}

export function hasSeenEnvelopeGlossary(): boolean {
  try {
    return storage()?.getItem(GLOSSARY_KEY) === "1";
  } catch {
    return false;
  }
}

export function markEnvelopeGlossarySeen(): void {
  const store = storage();
  if (!store) return;
  safeSetItem(store, GLOSSARY_KEY, "1");
}

export function shouldAskOpeningBalance(): boolean {
  try {
    return storage()?.getItem(BALANCE_PROMPT_KEY) !== "1";
  } catch {
    return true;
  }
}

export function markOpeningBalanceAsked(): void {
  const store = storage();
  if (!store) return;
  safeSetItem(store, BALANCE_PROMPT_KEY, "1");
}
