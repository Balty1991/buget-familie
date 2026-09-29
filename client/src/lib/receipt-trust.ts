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
  return true;
}
