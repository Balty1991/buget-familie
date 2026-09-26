/**
 * Pietre de mormânt pentru tot ce se poate șterge din plan și din setări: plicuri, transferuri,
 * reguli, evenimente, membri, categorii, surse. Fără ele, sincronizarea (care unește listele)
 * readucea de pe celălalt telefon tot ce ștergeai aici.
 *
 * Nu le scrie fiecare ecran în parte: se compară starea de dinainte cu cea de după fiecare
 * schimbare. O ștergere în masă (resetare, restaurare din backup) nu devine ștergere pentru
 * toată familia: peste 10 dispariții deodată, sau o colecție golită de tot, nu se propagă.
 * Un element readus (același id) își ridică piatra, ca să nu fie scos la loc.
 */
import type { AppData, DeletedRecord } from "./finance-data";

type Tracked = { entity: DeletedRecord["entity"]; ids: (data: AppData) => string[] };

const TRACKED: Tracked[] = [
  { entity: "allocations", ids: (data) => data.settings.salaryPlan.allocations.map((item) => item.id) },
  { entity: "transfers", ids: (data) => (data.settings.salaryPlan.transfers || []).map((item) => item.id) },
  { entity: "weekTransfers", ids: (data) => (data.settings.salaryPlan.weekTransfers || []).map((item) => item.id) },
  { entity: "salaryRules", ids: (data) => (data.settings.salaryPlan.salaryAllocationRules || []).map((item) => item.id) },
  { entity: "plannedEvents", ids: (data) => (data.settings.plannedEvents || []).map((item) => item.id) },
  { entity: "members", ids: (data) => data.settings.members.map((item) => item.id) },
  { entity: "categories", ids: (data) => data.settings.customCategories },
  { entity: "paymentSources", ids: (data) => data.settings.paymentSources.map((item) => item.id) },
  { entity: "exchangeRates", ids: (data) => (data.settings.exchangeRates || []).map((item) => item.currency) },
  { entity: "eventContributions", ids: (data) => (data.settings.plannedEvents || []).flatMap((event) => (event.contributions || []).map((item) => `${event.id}:${item.id}`)) },
];

const MAX_REMOVED = 10;

export function recordRemovals(previous: AppData, next: AppData, now = new Date().toISOString()): AppData {
  if (previous === next) return next;
  const added: DeletedRecord[] = [];
  const revived = new Set<string>();
  for (const tracked of TRACKED) {
    const before = tracked.ids(previous);
    const after = tracked.ids(next);
    if (before === after) continue;
    const afterSet = new Set(after);
    const beforeSet = new Set(before);
    const removed = before.filter((id) => !afterSet.has(id));
    const emptied = after.length === 0 && before.length >= 2;
    if (removed.length && removed.length <= MAX_REMOVED && !emptied) removed.forEach((id) => added.push({ entity: tracked.entity, id, deletedAt: now }));
    after.filter((id) => !beforeSet.has(id)).forEach((id) => revived.add(`${tracked.entity}:${id}`));
  }
  if (!added.length && !revived.size) return next;
  const kept = next.deleted.filter((item) => !revived.has(`${item.entity}:${item.id}`) && !added.some((entry) => entry.entity === item.entity && entry.id === item.id));
  const deleted = [...kept, ...added];
  if (deleted.length === next.deleted.length && !added.length) return next;
  // Categoriile n-au marcaj propriu: ținem minte când a fost creată din nou una ștearsă,
  // altfel piatra venită de la partener ar scoate-o iar.
  const revivedCategories = next.deleted.filter((item) => item.entity === "categories" && revived.has(`categories:${item.id}`)).map((item) => item.id);
  if (revivedCategories.length) {
    const stamps = { ...(next.settings.categoryRevivedAt || {}) };
    revivedCategories.forEach((name) => { stamps[name] = now; });
    return { ...next, deleted, settings: { ...next.settings, categoryRevivedAt: stamps } };
  }
  return { ...next, deleted };
}
