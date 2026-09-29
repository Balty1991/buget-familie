import { foldRomanian } from "./finance-data";
import { receiptReadIsReconciled, type LocalReceiptOcr } from "./receipt-utils";

/** Nume de produs, nu de magazin. */
export function looksLikeKnownProduct(label: string) {
  const folded = foldRomanian(label);
  if (!folded || folded.length < 4) return false;
  if (/\b(mega image|profi|kaufland|lidl|carrefour|penny|auchan|megaimage)\b/.test(folded)) return false;
  return /\b(mentos|portocal|banana|banane|kinder|ketchup|crenvurst|actimel|akadika|delaco|iaurt|punga|biodegradabil|pepermint|peppermint)\b/.test(folded);
}

/** Destul de sigură ca ghidul să propună cheltuiala fără model. */
export function receiptReadIsTrustworthy(result: LocalReceiptOcr) {
  if (!receiptReadIsReconciled(result)) return false;
  if (result.items.length < 2) return false;
  if (looksLikeKnownProduct(result.vendor || "")) return false;
  // Câteva produse care se adună între ele nu fac un bon: suma trebuie să fie cea de pe rândul TOTAL.
  const printed = printedReceiptTotal(result.text);
  if (printed === undefined || Math.abs(printed - result.amount) > 0.01) return false;
  return true;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Suma de pe rândul TOTAL al bonului (nu TOTAL TVA), dacă OCR-ul l-a prins. */
export function printedReceiptTotal(text: string): number | undefined {
  for (const line of text.split(/\r?\n/)) {
    const match = foldRomanian(line).match(/^\s*total\b(?!\s*tva)\D{0,12}(\d{1,5}(?:[.,]\d{3})*[.,]\d{2})\b/);
    if (!match) continue;
    const amount = Number(match[1].replace(/[.,](?=\d{3}[.,])/g, "").replace(",", "."));
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return undefined;
}

export type ModelReceiptRead = {
  amount?: number;
  vendor?: string;
  title?: string;
  date?: string;
  category?: string;
  totalLabel?: string;
  cashGiven?: number;
  receiptLines?: Array<{ name?: string; quantity?: number; amount?: number }>;
  confidence?: "high" | "medium" | "low";
};

/**
 * Ce a citit modelul de pe poză trece prin reguli fixe, nu e crezut pe cuvânt:
 * banul dat (CASH/NUMERAR/REST) nu e totalul, un magazin care arată a produs nu e magazin,
 * iar dacă produsele nu dau totalul, suma se arată ca „verifică”, nu ca sigură.
 */
export function checkModelReceipt(read?: ModelReceiptRead) {
  if (!read) return undefined;
  const lines = (read.receiptLines || []).filter((line) => typeof line.amount === "number" && line.amount > 0 && line.amount < 100_000);
  const sum = round2(lines.reduce((total, line) => total + (line.amount || 0), 0));
  let amount = typeof read.amount === "number" && read.amount > 0 && read.amount < 100_000 ? round2(read.amount) : undefined;
  const matchesLines = (value: number) => lines.length >= 2 && Math.abs(sum - value) <= 0.1;
  const label = foldRomanian(read.totalLabel || "");
  if (amount && /\b(cash|numerar|rest)\b/.test(label)) amount = undefined;
  // CASH 200 poate fi totalul doar când s-a plătit exact; atunci și produsele dau aceeași sumă.
  if (amount && read.cashGiven && Math.abs(amount - read.cashGiven) < 0.01 && lines.length && !matchesLines(amount)) amount = undefined;
  if (!amount && lines.length >= 2) amount = sum;
  if (!amount) return undefined;
  const vendorRaw = (read.vendor || "").replace(/\s+/g, " ").trim();
  const vendor = vendorRaw && !looksLikeKnownProduct(vendorRaw) ? vendorRaw : undefined;
  return {
    amount,
    vendor,
    date: read.date,
    category: read.category,
    lines,
    confidence: matchesLines(amount) ? "high" as const : "low" as const,
  };
}
