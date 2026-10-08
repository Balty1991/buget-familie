/**
 * Cantitatea unui articol scris de mână: „2 buc × 4,55” sau „0,456 kg × 12,90 lei/kg”.
 * Pe bon rămâne un singur rând, ca la bonurile scanate: „Roșii × 0,456 kg” cu suma plătită.
 */
import { amountInput, parseRomanianAmount } from "./finance-data";

export type QuantityUnit = "buc" | "kg";

const round2 = (value: number) => Math.round(value * 100) / 100;
const qtyText = (qty: number) => String(Math.round(qty * 1000) / 1000).replace(".", ",");

/** Cât face rândul: prețul pe bucată (sau pe kg) înmulțit cu cantitatea; fără cantitate, prețul scris. */
export function lineTotal(price: string, qty?: string): number {
  const unitPrice = parseRomanianAmount(price) || 0;
  const count = parseRomanianAmount(qty || "") || 0;
  return round2(count > 0 ? unitPrice * count : unitPrice);
}

/** Rândul de bon salvat: eticheta cu cantitatea și suma întreagă. */
export function withQuantity(label: string, price: string, qty?: string, unit: QuantityUnit = "buc"): { label: string; amount: string } {
  const count = parseRomanianAmount(qty || "") || 0;
  const total = lineTotal(price, qty);
  const plain = label.trim();
  if (!(count > 0) || (count === 1 && unit === "buc")) return { label: plain, amount: price };
  return { label: `${plain} × ${qtyText(count)}${unit === "kg" ? " kg" : ""}`, amount: amountInput(total) };
}

/** La corectură: „Roșii × 0,456 kg” cu 5,88 lei devine 0,456 kg la 12,89 lei/kg. */
export function splitQuantity(label: string, amount: number): { label: string; price: string; qty: string; unit: QuantityUnit } {
  const match = /^(.*\S)\s+×\s*(\d+(?:[.,]\d+)?)(\s*kg)?$/i.exec(label.trim());
  const count = match ? Number(match[2].replace(",", ".")) : 0;
  // Doar bucăți întregi sau kilograme scrise: un „× 0,456” de pe bon scanat rămâne cum l-a citit.
  if (!match || !(count > 0) || (!match[3] && !Number.isInteger(count))) return { label, price: amountInput(amount), qty: "", unit: "buc" };
  return { label: match[1], price: amountInput(round2(amount / count)), qty: qtyText(count), unit: match[3] ? "kg" : "buc" };
}
