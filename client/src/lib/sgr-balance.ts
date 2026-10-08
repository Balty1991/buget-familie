/**
 * Garanția SGR: cât s-a plătit pe ambalaje (0,50 lei pe sticlă sau doză) și cât s-a recuperat
 * la reciclare (voucherele de la automat). Diferența e ce costă de fapt ambalajele nereturnate.
 */
import { foldRomanian, type AppData } from "./finance-data";

export type SgrBalance = { paid: number; recovered: number; net: number };

const GUARANTEE = /\b(garantie|sgr)\b/;
const RECYCLING = /\b(sgr|retur\w*|recicl\w*|garantie|ambalaj\w*)\b/;
const round = (value: number) => Math.round(value * 100) / 100;

export function sgrBalance(data: AppData, from: string, to = "9999-12-31"): SgrBalance {
  const vouchers = new Set(data.settings.paymentSources.filter((source) => source.kind === "voucher" || /voucher|\bsgr\b/i.test(source.name)).map((source) => source.id));
  let paid = 0;
  let recovered = 0;
  for (const item of data.transactions) {
    if (item.date < from || item.date > to || !(item.amount > 0)) continue;
    if (item.kind === "income") {
      const text = foldRomanian(`${item.title} ${item.note || ""}`);
      if (RECYCLING.test(text) || (item.sourceId && vouchers.has(item.sourceId))) recovered += item.amount;
      continue;
    }
    const receipt = item.receiptId ? data.receipts.find((entry) => entry.id === item.receiptId) : undefined;
    if (receipt?.lines?.length) {
      // Garanția stă pe rândurile bonului; bonul plătit din două surse e numărat o singură dată (pe partea cu bonul).
      paid += receipt.lines.filter((line) => line.category === "SGR" || GUARANTEE.test(foldRomanian(line.label || ""))).reduce((sum, line) => sum + line.amount, 0);
    } else if (item.category === "SGR") {
      paid += item.amount;
    }
  }
  return { paid: round(paid), recovered: round(recovered), net: round(paid - recovered) };
}
