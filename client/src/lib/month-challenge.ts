/**
 * Provocarea lunii: o singură țintă, aleasă de om, pentru o categorie pe care o poate controla
 * („Timp liber sub 450 lei”). Se propune în primele 10 zile, pornind de la luna trecută.
 * Rămâne pe telefon (preferință locală), ca orice altă alegere de afișare.
 */
import { addIsoDays } from "@/lib/finance-data";

/** Categorii pe care omul le poate strânge de la o lună la alta; rate, facturi, abonamente și categoriile proprii (pot fi grădinița) nu. */
const FLEXIBLE = new Set(["Alimente", "Timp liber", "Transport", "Băuturi", "Dulciuri", "Altele", "Consumabile copil", "Sănătate"]);
const FIXED = new Set(["Casă & facturi", "Credite", "Rate produse", "Abonamente", "Educație", "Apă", "Salariu", "Venit"]);

export type MonthChallenge = { month: string; category: string; target: number; last: number };
type Move = { date: string; kind: string; category: string; amount: number; adjustment?: boolean; transferId?: string };

const monthOf = (iso: string) => iso.slice(0, 7);
const previousMonth = (month: string) => monthOf(addIsoDays(`${month}-01`, -1));
const spentIn = (items: ReadonlyArray<Move>, month: string, category?: string) => items
  .filter((item) => item.kind === "expense" && !item.adjustment && !item.transferId && monthOf(item.date) === month && (!category || item.category === category))
  .reduce((sum, item) => sum + item.amount, 0);

/** Propunerea: categoria flexibilă cu cele mai mari cheltuieli luna trecută (măcar 200 lei), cu 10% mai puțin, rotunjit la 50. */
export function suggestChallenge(items: ReadonlyArray<Move>, today: string): MonthChallenge | undefined {
  const month = monthOf(today);
  const last = previousMonth(month);
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "expense" || item.adjustment || item.transferId || monthOf(item.date) !== last) continue;
    if (FIXED.has(item.category)) continue;
    totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  }
  const ranked = Array.from(totals.entries()).filter(([name, sum]) => sum >= 200 && FLEXIBLE.has(name)).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return undefined;
  const target = Math.floor((top[1] * 0.9) / 50) * 50;
  if (target <= 0) return undefined;
  return { month, category: top[0], target, last: Math.round(top[1]) };
}

export type ChallengeProgress = { spent: number; projected: number; share: number; state: "good" | "watch" | "over"; done: boolean; early: boolean };

/** Cât s-a cheltuit în categorie luna asta și unde ajunge la ritmul de acum. */
export function challengeProgress(items: ReadonlyArray<Move>, challenge: MonthChallenge, today: string): ChallengeProgress {
  const spent = Math.round(spentIn(items, challenge.month, challenge.category) * 100) / 100;
  const [year, month] = challenge.month.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = monthOf(today) === challenge.month ? Number(today.slice(8, 10)) : daysInMonth;
  // Din primele zile nu se poate ghici luna: o plată mare pe 1 ar „proiecta” de 30 de ori mai mult.
  const early = day < 7;
  const projected = early ? spent : Math.round((spent / Math.max(1, day)) * daysInMonth);
  const share = challenge.target > 0 ? spent / challenge.target : 0;
  const state = spent > challenge.target ? "over" : !early && projected > challenge.target ? "watch" : "good";
  return { spent, projected, share, state, done: monthOf(today) !== challenge.month, early };
}

const KEY = (month: string) => `buget-familie:challenge-${month}`;
type Store = Pick<Storage, "getItem" | "setItem">;

/** Provocarea acceptată pentru luna dată, „skip” dacă omul a refuzat, sau nimic. */
export function readChallenge(storage: Store, month: string): MonthChallenge | "skip" | undefined {
  try {
    const raw = storage.getItem(KEY(month));
    if (!raw) return undefined;
    if (raw === "skip") return "skip";
    const parsed = JSON.parse(raw) as MonthChallenge;
    return parsed && typeof parsed.category === "string" && parsed.target > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveChallenge(storage: Store, month: string, value: MonthChallenge | "skip") {
  try { storage.setItem(KEY(month), value === "skip" ? "skip" : JSON.stringify(value)); } catch { /* fără stocare: se propune din nou */ }
}
