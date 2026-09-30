/**
 * Frazele pe care ghidul de pe telefon nu le-a înțeles singur și le-a trimis online.
 *
 * Rămân doar pe telefon: omul le vede în Setări, le poate copia (ca să ni le trimită,
 * dacă vrea) sau le poate șterge. Nimic din lista asta nu pleacă automat nicăieri.
 */
export const MISSED_KEY = "buget-familie:ai-missed-v1";
export const MISSED_LIMIT = 50;

export type MissedPhrase = { text: string; at: string };

export function loadMissed(): MissedPhrase[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MISSED_KEY) || "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is MissedPhrase => Boolean(item) && typeof (item as MissedPhrase).text === "string").slice(-MISSED_LIMIT)
      : [];
  } catch {
    return [];
  }
}

const save = (list: MissedPhrase[]) => {
  try { window.localStorage.setItem(MISSED_KEY, JSON.stringify(list.slice(-MISSED_LIMIT))); } catch { /* spațiu local indisponibil */ }
};

/** Aceeași frază de două ori urcă la final, nu se dublează. */
export function recordMissed(text: string, at = new Date().toISOString()): MissedPhrase[] {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!clean) return loadMissed();
  const key = clean.toLocaleLowerCase("ro-RO");
  const next = [...loadMissed().filter((item) => item.text.toLocaleLowerCase("ro-RO") !== key), { text: clean, at }].slice(-MISSED_LIMIT);
  save(next);
  return next;
}

export function clearMissed() {
  save([]);
}

/** Textul pentru „Copiază lista”: o frază pe rând, cea mai nouă prima. */
export const missedAsText = (list: MissedPhrase[]) => [...list].reverse().map((item) => `${item.at.slice(0, 10)} · ${item.text}`).join("\n");
