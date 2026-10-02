/**
 * Obiectiv atins: o singură felicitare pe obiectiv, pe telefonul acesta. La prima rulare,
 * obiectivele deja atinse se notează în tăcere, ca omul să nu primească zece felicitări vechi.
 */
import type { SavingsGoal } from "./finance-data";
import { safeSetItem, type StorageLike } from "./safe-storage";

export const CELEBRATED_KEY = "buget-familie:goals-celebrated";
const reached = (goal: SavingsGoal) => goal.target > 0 && goal.current >= goal.target;

export function pendingCelebration(savings: ReadonlyArray<SavingsGoal>, storage: StorageLike | undefined): SavingsGoal | undefined {
  if (!storage) return undefined;
  let seen: string[] | undefined;
  try { const raw = storage.getItem(CELEBRATED_KEY); seen = raw ? JSON.parse(raw) : undefined; } catch { seen = undefined; }
  if (!Array.isArray(seen)) {
    try { safeSetItem(storage, CELEBRATED_KEY, JSON.stringify(savings.filter(reached).map((goal) => goal.id))); } catch { /* fără stocare, fără felicitări */ }
    return undefined;
  }
  return savings.find((goal) => reached(goal) && !seen!.includes(goal.id));
}

export function markCelebrated(storage: StorageLike | undefined, id: string) {
  if (!storage) return;
  try {
    const raw = storage.getItem(CELEBRATED_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    safeSetItem(storage, CELEBRATED_KEY, JSON.stringify([...seen.filter((item) => item !== id), id].slice(-100)));
  } catch { /* nimic de salvat */ }
}
