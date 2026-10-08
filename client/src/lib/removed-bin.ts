/**
 * „Șterse recent”: tot ce dispare din registru (mișcări și bonuri) se păstrează aici 60 de zile,
 * oricine l-ar fi scos — omul, o corectură, sincronizarea cu alt telefon sau o greșeală a aplicației.
 * Piatra de mormânt ține doar id-ul; aici stă rândul întreg, ca să poată fi pus înapoi.
 * Coșul stă doar pe telefonul acesta și nu pleacă la sincronizare.
 */
import { safeSetItem } from "./safe-storage";
import type { AppData, Receipt, Transaction } from "./finance-data";

const KEY = "buget-familie:removed-bin";
const KEEP_DAYS = 60;
const MAX_ENTRIES = 400;
/** Peste atât, dintr-odată, e o operație în masă (închiderea anului, resetare, import): nu umple coșul. */
const BULK_LIMIT = 40;

export type RemovedEntry =
  | { key: string; entity: "transactions"; row: Transaction; removedAt: string }
  | { key: string; entity: "receipts"; row: Receipt; removedAt: string };

const storage = (): Storage | undefined => { try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; } };

export function readRemovedBin(now = Date.now()): RemovedEntry[] {
  try {
    const parsed = JSON.parse(storage()?.getItem(KEY) || "[]") as RemovedEntry[];
    const cutoff = now - KEEP_DAYS * 86_400_000;
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.row && (Date.parse(entry.removedAt) || 0) >= cutoff) : [];
  } catch {
    return [];
  }
}

function writeRemovedBin(entries: RemovedEntry[]) {
  const store = storage();
  if (!store) return;
  safeSetItem(store, KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  try { window.dispatchEvent(new Event("buget-familie:removed-bin")); } catch { /* fără fereastră (teste) */ }
}

/** Ce era în `before` și nu mai e în `after`. */
export function removedBetween(before: AppData, after: AppData, now = new Date().toISOString()): RemovedEntry[] {
  const txIds = new Set(after.transactions.map((item) => item.id));
  const receiptIds = new Set(after.receipts.map((item) => item.id));
  const transactions = before.transactions.filter((item) => !txIds.has(item.id));
  const receipts = before.receipts.filter((item) => !receiptIds.has(item.id));
  if (transactions.length + receipts.length > BULK_LIMIT) return [];
  return [
    ...transactions.map((row) => ({ key: `transactions:${row.id}:${now}`, entity: "transactions" as const, row, removedAt: now })),
    ...receipts.map((row) => ({ key: `receipts:${row.id}:${now}`, entity: "receipts" as const, row, removedAt: now })),
  ];
}

/** Ține minte ce a dispărut între două stări ale registrului. */
export function recordRemovals(before: AppData, after: AppData) {
  if (before === after || (before.transactions === after.transactions && before.receipts === after.receipts)) return;
  const fresh = removedBetween(before, after);
  if (!fresh.length) return;
  writeRemovedBin([...readRemovedBin(), ...fresh]);
}

/** Pune înapoi rândurile alese: devin „mai noi” decât ștergerea, ca sincronizarea să nu le scoată iar. */
export function restoreRemoved(data: AppData, keys: string[], now = new Date().toISOString()): AppData {
  const wanted = readRemovedBin().filter((entry) => keys.includes(entry.key));
  if (!wanted.length) return data;
  const txPresent = new Set(data.transactions.map((item) => item.id));
  const receiptPresent = new Set(data.receipts.map((item) => item.id));
  const transactions = wanted.flatMap((entry) => entry.entity === "transactions" && !txPresent.has(entry.row.id) ? [{ ...entry.row, updatedAt: now }] : []);
  const receipts = wanted.flatMap((entry) => entry.entity === "receipts" && !receiptPresent.has(entry.row.id) ? [{ ...entry.row, updatedAt: now }] : []);
  const ids = new Set(wanted.map((entry) => entry.row.id));
  writeRemovedBin(readRemovedBin().filter((entry) => !keys.includes(entry.key)));
  return {
    ...data,
    transactions: [...transactions, ...data.transactions],
    receipts: [...receipts, ...data.receipts],
    deleted: data.deleted.filter((item) => !ids.has(item.id)),
  };
}

/** Golește intrările alese (omul a văzut și nu le vrea înapoi). */
export function forgetRemoved(keys: string[]) {
  writeRemovedBin(readRemovedBin().filter((entry) => !keys.includes(entry.key)));
}

/**
 * Repară un bon pe două surse rămas cu o singură parte: întâi din coș (partea ștearsă, cu bonul ei și
 * articolele), altfel refăcută din totalul bonului, pe sursa știută. `undefined` când nu se poate ghici.
 */
export function repairSplit(
  data: AppData,
  broken: { kept: Transaction; missing: number; missingSource?: string },
  isPartner: (a: Transaction, b: Transaction) => boolean,
  makeId: () => string,
): AppData | undefined {
  const present = new Set(data.transactions.map((item) => item.id));
  const bin = readRemovedBin();
  const parts = bin.filter((entry): entry is Extract<RemovedEntry, { entity: "transactions" }> => entry.entity === "transactions" && !present.has(entry.row.id) && isPartner(broken.kept, entry.row));
  // Aceeași parte poate fi în coș de mai multe ori (scoasă, pusă, scoasă): luăm cea mai nouă.
  const latest = new Map<string, (typeof parts)[number]>();
  for (const entry of parts) latest.set(entry.row.id, entry);
  const chosen = Array.from(latest.values()).filter((entry) => Math.abs(entry.row.amount - broken.missing) <= 0.01 || latest.size === 1);
  if (chosen.length) {
    const ids = new Set(chosen.map((entry) => entry.row.id));
    const receiptIds = new Set(chosen.map((entry) => entry.row.receiptId).filter(Boolean));
    const receipts = bin.filter((entry) => entry.entity === "receipts" && !data.receipts.some((item) => item.id === entry.row.id)
      && (receiptIds.has(entry.row.id) || ids.has((entry.row as Receipt).linkedTransactionId || "")));
    return restoreRemoved(data, [...chosen.map((entry) => entry.key), ...receipts.map((entry) => entry.key)]);
  }
  const source = broken.missingSource ? data.settings.paymentSources.find((item) => item.name === broken.missingSource) : undefined;
  if (!source || !(broken.missing > 0)) return undefined;
  const now = new Date().toISOString();
  const splitId = broken.kept.splitId || makeId();
  const part: Transaction = { ...broken.kept, id: makeId(), amount: broken.missing, sourceId: source.id, source: source.name, splitId, receiptId: undefined, debtId: undefined, recurringId: undefined, createdAt: now, updatedAt: now };
  return { ...data, transactions: [part, ...data.transactions.map((item) => item.id === broken.kept.id ? { ...item, splitId, updatedAt: now } : item)] };
}
