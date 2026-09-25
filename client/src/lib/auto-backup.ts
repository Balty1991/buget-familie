/**
 * Copia de siguranță săptămânală. Pe telefon (aplicația Android) se scrie singură în
 * Descărcări; în browser nu se poate scrie fără apăsare, așa că vine o reamintire.
 * Pornește doar după ce omul spune „da”: fișierul are sumele în clar, iar Descărcările
 * le pot vedea și alte aplicații cu acces la fișiere.
 * Preferința e a telefonului, nu a familiei: stă în stocarea locală, nu se sincronizează.
 */
import { safeSetItem } from "./safe-storage";

export const AUTO_BACKUP_KEY = "buget-familie:auto-backup-v1";
export const AUTO_BACKUP_DAYS = 7;

export type AutoBackupPrefs = { enabled: boolean; asked: boolean; lastAt?: string; lastPath?: string; lastError?: string };

export const readAutoBackup = (): AutoBackupPrefs => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTO_BACKUP_KEY) || "{}") as Partial<AutoBackupPrefs>;
    return { enabled: parsed.enabled === true, asked: parsed.asked === true, lastAt: typeof parsed.lastAt === "string" ? parsed.lastAt : undefined, lastPath: typeof parsed.lastPath === "string" ? parsed.lastPath : undefined, lastError: typeof parsed.lastError === "string" ? parsed.lastError : undefined };
  } catch {
    return { enabled: false, asked: false };
  }
};

export const writeAutoBackup = (patch: Partial<AutoBackupPrefs>) => {
  const next = { ...readAutoBackup(), ...patch };
  try { safeSetItem(window.localStorage, AUTO_BACKUP_KEY, JSON.stringify(next)); } catch { /* fără stocare, doar nu ține minte */ }
  window.dispatchEvent(new CustomEvent("buget-familie:auto-backup", { detail: next }));
  return next;
};

/** E timpul pentru o copie: pornită și fără copie în ultimele 7 zile. */
export const autoBackupDue = (prefs: AutoBackupPrefs, now = Date.now()) =>
  prefs.enabled && (!prefs.lastAt || now - Date.parse(prefs.lastAt) >= AUTO_BACKUP_DAYS * 86_400_000);

/** Merită întrebat: familia are deja câteva mișcări de pierdut și n-a răspuns încă. */
export const autoBackupWorthAsking = (prefs: AutoBackupPrefs, movements: number) => !prefs.asked && movements >= 10;

/** Numele fișierului automat, cu data: se păstrează câteva săptămâni în urmă. */
export const autoBackupName = (date = new Date()) => `buget-familie-copie-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}.json`;
