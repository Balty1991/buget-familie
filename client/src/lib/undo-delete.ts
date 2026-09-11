/**
 * Anularea unei ștergeri.
 *
 * „Tombstones” păstrează doar identificatorul unei înregistrări șterse, nu și
 * conținutul ei, așa că din ele nu se poate reconstrui nimic. Ținem deci lângă
 * ștergere exact rândurile scoase și le punem la loc dacă omul se răzgândește.
 *
 * Reintroducerea este scrisă ca o modificare aplicată peste starea de *atunci*,
 * nu ca o revenire la o fotografie a întregului registru: între ștergere și
 * apăsarea pe „Anulează” pot apărea alte mișcări, iar acelea nu au voie să se piardă.
 *
 * Ștergerea lasă în urmă și un „tombstone”, care spune celorlalte telefoane să
 * scoată înregistrarea. La anulare acesta trebuie ridicat, altfel sincronizarea
 * ar șterge la loc ce tocmai am readus.
 */
import type { AppData, Debt, Receipt, RecurringPayment, SavingsGoal, Transaction } from "./finance-data";

export type UndoAction = {
  /** Ce i se spune omului: „Mișcarea a fost ștearsă.” */
  label: string;
  apply: (current: AppData) => AppData;
};

type Removed = {
  transactions?: Transaction[];
  receipts?: Receipt[];
  debts?: Debt[];
  savings?: SavingsGoal[];
  recurring?: RecurringPayment[];
};

const restoreInto = <T extends { id: string }>(existing: T[], removed: T[] | undefined) => {
  if (!removed?.length) return existing;
  // Dacă între timp a revenit prin sincronizare, nu o punem de două ori.
  const present = new Set(existing.map((item) => item.id));
  return [...existing, ...removed.filter((item) => !present.has(item.id))];
};

/** Construiește anularea pentru rândurile scoase; `undefined` dacă nu s-a scos nimic. */
export function buildUndo(label: string, removed: Removed): UndoAction | undefined {
  const ids = new Set(
    [
      ...(removed.transactions || []),
      ...(removed.receipts || []),
      ...(removed.debts || []),
      ...(removed.savings || []),
      ...(removed.recurring || []),
    ].map((item) => item.id),
  );
  if (!ids.size) return undefined;

  return {
    label,
    apply: (current) => ({
      ...current,
      transactions: restoreInto(current.transactions, removed.transactions),
      receipts: restoreInto(current.receipts, removed.receipts),
      debts: restoreInto(current.debts, removed.debts),
      savings: restoreInto(current.savings, removed.savings),
      recurring: restoreInto(current.recurring, removed.recurring),
      deleted: current.deleted.filter((item) => !ids.has(item.id)),
    }),
  };
}
