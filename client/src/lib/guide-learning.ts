/**
 * Ghidul local învață de la tine.
 *
 * Când nu înțelege o frază, o citește modelul online (Gemini sau Groq). Dacă propunerea lui e
 * bună și o confirmi, ghidul de pe telefon reține **forma** frazei, cu suma scoasă: „am câștigat
 * # la pariuri” → venit „Câștig pariuri”. Data viitoare, „am câștigat 150 la pariuri” se
 * înțelege direct pe telefon, fără internet și fără să consume din cota ghidului online.
 *
 * Se învață doar ce ai confirmat tu, doar fraze cu o singură sumă și doar cheltuieli și
 * venituri: o propunere tot trebuie confirmată, deci o formă învățată greșit nu scrie nimic
 * singură în registru.
 */
import { foldRomanian } from "./finance-data";
import type { AssistantIntent } from "./assistant-intents";

export type LearnedPhrase = {
  /** Fraza fără diacritice și cu suma înlocuită de „#”. */
  shape: string;
  kind: "expense" | "income";
  title: string;
  category?: string;
  count: number;
  lastAt: string;
};

const AMOUNT = /\d+(?:[.\s]\d{3})*(?:[.,]\d{1,2})?/g;
const MAX_LEARNED = 60;

/** Forma frazei: fără diacritice, fără semne, cu suma ca „#”. Nimic dacă nu are exact o sumă. */
export function messageShape(raw: string): string | undefined {
  const folded = foldRomanian(raw).replace(/\b(lei|ron|leu)\b/g, " ").replace(/[^a-z0-9.,\s-]+/g, " ");
  const amounts = folded.match(AMOUNT) || [];
  if (amounts.length !== 1) return undefined;
  const shape = folded.replace(AMOUNT, " # ").replace(/[.,-]+/g, " ").replace(/\s+/g, " ").trim();
  const words = shape.split(" ").filter((word) => /^[a-z]{3,}$/.test(word));
  if (!words.length || shape.length < 5 || shape.length > 90) return undefined;
  return shape;
}

const amountOf = (raw: string) => {
  const token = foldRomanian(raw).match(AMOUNT)?.[0];
  if (!token) return 0;
  const clean = token.replace(/\s/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(clean) ? clean.replace(/\./g, "") : clean;
  return Number(normalized) || 0;
};

/** Reține forma unei fraze confirmate. Ce e deja învățat se întărește, restul se păstrează. */
export function rememberPhrasing(list: LearnedPhrase[] = [], raw: string, intent: AssistantIntent, now = new Date().toISOString()): LearnedPhrase[] {
  if (intent.kind !== "expense" && intent.kind !== "income") return list;
  const shape = messageShape(raw);
  if (!shape) return list;
  const before = list.find((item) => item.shape === shape);
  const next: LearnedPhrase = {
    shape,
    kind: intent.kind,
    title: intent.title,
    category: intent.kind === "expense" ? intent.category : undefined,
    count: (before?.count || 0) + 1,
    lastAt: now,
  };
  return [...list.filter((item) => item.shape !== shape), next].slice(-MAX_LEARNED);
}

/** O frază cu aceeași formă ca una învățată devine aceeași intenție, cu suma nouă. */
export function recallPhrasing(list: LearnedPhrase[] = [], raw: string, date: string): AssistantIntent | undefined {
  const shape = messageShape(raw);
  if (!shape) return undefined;
  const hit = list.find((item) => item.shape === shape);
  if (!hit) return undefined;
  const amount = amountOf(raw);
  if (!amount || amount <= 0) return undefined;
  return hit.kind === "income"
    ? { kind: "income", amount, title: hit.title, date }
    : { kind: "expense", amount, title: hit.title, category: hit.category || "Altele", date };
}
