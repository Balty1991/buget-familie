/**
 * Prima sesiune arată doar salariul, data și plicul de mâncare.
 * Analiza, temele, asistentul și bonurile revin după 3 zile cu cheltuieli notate.
 */
import { safeSetItem } from "@/lib/safe-storage";

export const QUIET_START_KEY = "buget-familie:quiet-start";

const storage = () => (typeof window === "undefined" ? null : window.localStorage);

export function markQuietStart(): void {
  const store = storage();
  if (!store) return;
  safeSetItem(store, QUIET_START_KEY, "1");
}

export function clearQuietStart(): void {
  try {
    storage()?.removeItem(QUIET_START_KEY);
  } catch {
    /* ignore */
  }
}

export function isQuietStart(): boolean {
  try {
    return storage()?.getItem(QUIET_START_KEY) === "1";
  } catch {
    return false;
  }
}

export function distinctExpenseDays(transactions: Array<{ kind: string; date: string }>): number {
  const days = new Set<string>();
  for (const item of transactions) {
    if (item.kind === "expense" && item.date) days.add(item.date);
  }
  return days.size;
}
