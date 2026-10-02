/**
 * Călătoria din modul vacanță, așa cum stă în setările familiei: tipul, curățarea a ce vine din
 * stocare sau de la partener și unirea a două variante. Fără importuri, ca `finance-data` să o
 * poată folosi fără cerc.
 */
export type Trip = { id: string; name: string; budget: number; start: string; end: string; currency?: string; closedAt?: string; updatedAt: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T/;

export function normalizeTrip(raw: unknown): Trip | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const item = raw as Partial<Trip>;
  const name = typeof item.name === "string" ? item.name.trim().slice(0, 60) : "";
  const budget = Math.round(Math.max(0, Number(item.budget) || 0) * 100) / 100;
  if (!name || typeof item.id !== "string" || !item.id || !ISO_DAY.test(String(item.start)) || !ISO_DAY.test(String(item.end)) || String(item.end) < String(item.start) || !ISO_TIME.test(String(item.updatedAt))) return undefined;
  const currency = typeof item.currency === "string" && /^[A-Z]{3}$/.test(item.currency) && item.currency !== "RON" ? item.currency : undefined;
  return { id: item.id.slice(0, 80), name, budget, start: item.start!, end: item.end!, updatedAt: item.updatedAt!, ...(currency ? { currency } : {}), ...(ISO_TIME.test(String(item.closedAt)) ? { closedAt: item.closedAt } : {}) };
}

/** Pe aceeași călătorie sau pe două diferite, câștigă ultima modificare. */
export function mergeTrip(local?: Trip, remote?: Trip): Trip | undefined {
  if (!local || !remote) return local || remote;
  return (Date.parse(remote.updatedAt) || 0) > (Date.parse(local.updatedAt) || 0) ? remote : local;
}
