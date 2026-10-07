/**
 * Un bon plătit din două surse (voucher + cash) e o singură cumpărătură. În registru stau două
 * mișcări, câte una pe sursă, ca soldul fiecărei surse să fie corect; pe ecran apar ca un rând.
 * Mișcările vechi, fără splitId, se recunosc după nota „Bon de …” identică, ziua și titlul.
 */
import type { Transaction } from "./finance-data";

export const isSplitPartner = (a: Transaction, b: Transaction) =>
  a.id !== b.id && a.kind === "expense" && b.kind === "expense"
  && (a.splitId ? b.splitId === a.splitId : Boolean(!b.splitId && a.note && /Bon de /.test(a.note) && b.note === a.note && b.date === a.date && b.title === a.title));

/** Id-ul mișcării și ale celorlalte părți ale aceluiași bon. */
export const splitGroupIds = (list: Transaction[], id: string): string[] => {
  const item = list.find((entry) => entry.id === id);
  return item ? [id, ...list.filter((entry) => isSplitPartner(item, entry)).map((entry) => entry.id)] : [id];
};

export type MergedMove = Transaction & { splitParts?: Array<{ id: string; source: string; amount: number }> };

/** Lista de pe ecran: părțile aceluiași bon devin un rând cu totalul și sursele lui. */
/**
 * Rândul din Mișcări sau de pe Astăzi poate fi bonul unit (suma ambelor părți, „A + B”).
 * Corectura pornește mereu de la mișcarea salvată, altfel formularul aduna încă o dată
 * partea a doua (39,76 + 11,26 = 51,02).
 */
export function storedMove(list: Transaction[], item: Transaction): Transaction {
  return list.find((entry) => entry.id === item.id) || item;
}

export function mergeSplitPayments(list: Transaction[]): MergedMove[] {
  const used = new Set<string>();
  const out: MergedMove[] = [];
  for (const item of list) {
    if (used.has(item.id)) continue;
    const partners = item.kind === "expense" ? list.filter((entry) => !used.has(entry.id) && isSplitPartner(item, entry)) : [];
    if (!partners.length) { out.push(item); continue; }
    const parts = [item, ...partners];
    parts.forEach((part) => used.add(part.id));
    const base = parts.find((part) => part.receiptId) || item;
    out.push({
      ...base,
      amount: Math.round(parts.reduce((sum, part) => sum + part.amount, 0) * 100) / 100,
      source: parts.map((part) => part.source).join(" + "),
      splitParts: parts.map((part) => ({ id: part.id, source: part.source, amount: part.amount })),
    });
  }
  return out;
}
