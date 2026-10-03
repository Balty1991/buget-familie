/**
 * Averea familiei: ce aveți (banii din toate sursele și bunurile trecute de mână) minus ce
 * datorați. Istoricul pe 12 luni se reface din mișcări: soldul fiecărei surse la sfârșitul
 * lunii, iar datoria de atunci e cea de azi plus ratele plătite de atunci încoace. Bunurile
 * intră cu valoarea de azi. Obiectivele de economii nu se adună separat: banii lor stau deja
 * într-o sursă.
 */
import { sourceBalance, type AppData } from "./finance-data";
import type { Asset } from "./asset-data";

export type NetWorthPoint = { key: string; net: number };
export type NetWorth = { cash: number; assets: number; debts: number; net: number; liveAssets: Asset[]; history: NetWorthPoint[]; yearChange?: number; monthChange?: number };

const round = (value: number) => Math.round(value * 100) / 100;
const monthEnd = (key: string) => { const date = new Date(`${key}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0); return date.toISOString().slice(0, 10); };
const shift = (key: string, offset: number) => { const date = new Date(`${key.slice(0, 7)}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };

export function netWorth(data: AppData, today: string): NetWorth {
  const cash = round(data.settings.paymentSources.reduce((sum, source) => sum + sourceBalance(data, source.id), 0));
  const liveAssets = (data.settings.assets || []).filter((item) => !item.deleted);
  const assets = round(liveAssets.reduce((sum, item) => sum + item.value, 0));
  const debts = round(data.debts.reduce((sum, item) => sum + Math.max(0, item.remaining), 0));
  const net = round(cash + assets - debts);
  const archived = data.settings.archivedThrough || "";
  const history: NetWorthPoint[] = [];
  for (let offset = -12; offset <= 0; offset += 1) {
    const key = shift(today, offset);
    const end = offset === 0 ? today : monthEnd(key);
    if (archived && end <= archived) continue;
    // Ce s-a mișcat după `end` se scoate din soldul de azi; ratele de după `end` se adaugă înapoi la datorie.
    let after = 0, repaid = 0;
    for (const item of data.transactions) {
      if (item.date <= end) continue;
      if (!item.sourceId || !data.settings.paymentSources.some((source) => source.id === item.sourceId)) continue;
      after += item.kind === "income" ? item.amount : -item.amount;
      if (item.debtId && item.kind === "expense") repaid += item.amount;
    }
    history.push({ key, net: round(cash - after + assets - (debts + repaid)) });
  }
  const first = history[0], last = history[history.length - 1];
  const previous = history.length >= 2 ? history[history.length - 2] : undefined;
  return { cash, assets, debts, net, liveAssets, history, ...(first && last && first.key === shift(today, -12) ? { yearChange: round(last.net - first.net) } : {}), ...(previous ? { monthChange: round(net - previous.net) } : {}) };
}
