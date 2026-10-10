/**
 * Cheltuielile pe categorii, citite pe articole. Un bon de la Mega cu detergent, mâncare și
 * bere era o singură mișcare „Casă & facturi”: în Analiză berea nu apărea nicăieri. Aici
 * fiecare articol de pe bon merge la categoria lui; restul nescris de pe bon rămâne la
 * categoria mișcării.
 *
 * Un bon plătit din două surse are două mișcări cu aceeași categorie: fiecare ia partea ei din
 * fiecare articol. Un bon împărțit pe categorii (o mișcare pe categorie) e deja împărțit și nu
 * se mai desface o dată.
 */
import { foldRomanian, type AppData, type Receipt, type Transaction } from "./finance-data";

export type SpendPiece = { category: string; amount: number; label: string; store: string };

const round2 = (value: number) => Math.round(value * 100) / 100;

const linkedIds = (receipt: Receipt) => Array.from(new Set([receipt.linkedTransactionId, ...(receipt.linkedTransactionIds || [])].filter((id): id is string => Boolean(id))));

export function spendPieces(data: AppData, transactions: Transaction[]): SpendPiece[] {
  const byTx = new Map<string, Receipt>();
  for (const receipt of data.receipts || []) {
    if (!receipt.lines?.length) continue;
    for (const id of linkedIds(receipt)) byTx.set(id, receipt);
  }
  const txById = new Map(data.transactions.map((item) => [item.id, item]));
  const pieces: SpendPiece[] = [];
  for (const tx of transactions) {
    if (tx.kind !== "expense") continue;
    const receipt = byTx.get(tx.id);
    const store = receipt?.vendor || tx.title;
    const linked = receipt ? linkedIds(receipt).map((id) => txById.get(id)).filter((item): item is Transaction => Boolean(item)) : [];
    const alreadySplit = new Set(linked.map((item) => item.category)).size > 1;
    if (!receipt || alreadySplit) {
      pieces.push({ category: tx.category, amount: tx.amount, label: tx.title, store });
      continue;
    }
    const lines = receipt.lines!.filter((line) => line.amount > 0);
    const linesTotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const paid = linked.reduce((sum, item) => sum + item.amount, 0) || receipt.amount || tx.amount;
    const factor = tx.amount / Math.max(paid, linesTotal, 0.01);
    let used = 0;
    for (const line of lines) {
      const amount = round2(line.amount * factor);
      used += amount;
      pieces.push({ category: line.category || tx.category, amount, label: line.label || tx.title, store });
    }
    const rest = round2(tx.amount - used);
    if (Math.abs(rest) >= 0.01) pieces.push({ category: tx.category, amount: rest, label: tx.title, store });
  }
  return pieces;
}

/** Totalurile pe categorii, de la cea mai mare. */
export function categoryTotals(pieces: SpendPiece[]): Array<[string, number]> {
  const totals = new Map<string, number>();
  for (const piece of pieces) totals.set(piece.category, (totals.get(piece.category) || 0) + piece.amount);
  return Array.from(totals, ([name, value]): [string, number] => [name, round2(value)]).filter(([, value]) => value > 0.004).sort((a, b) => b[1] - a[1]);
}

export type Ranked = { label: string; amount: number; count: number };

const rank = (pieces: SpendPiece[], key: (piece: SpendPiece) => string): Ranked[] => {
  const groups = new Map<string, Ranked>();
  for (const piece of pieces) {
    const label = key(piece).trim();
    if (!label) continue;
    const folded = foldRomanian(label).replace(/\s+/g, " ");
    const group = groups.get(folded) || { label, amount: 0, count: 0 };
    group.amount = round2(group.amount + piece.amount);
    group.count += 1;
    groups.set(folded, group);
  }
  return Array.from(groups.values()).filter((item) => item.amount > 0.004).sort((a, b) => b.amount - a.amount || b.count - a.count);
};

/** Dintr-o categorie: pe ce s-a dus cel mai mult și la ce magazine. */
export function categoryDetail(pieces: SpendPiece[], category: string) {
  const mine = pieces.filter((piece) => piece.category === category);
  return { items: rank(mine, (piece) => piece.label), stores: rank(mine, (piece) => piece.store.replace(/^cump[aă]r[aă]turi\s+/i, "")) };
}
