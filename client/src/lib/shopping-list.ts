/**
 * Lista de cumpărături a familiei. Se sincronizează ca restul setărilor familiei: fiecare
 * produs are `updatedAt`, iar la unire câștigă varianta mai nouă. Nimic nu se șterge de-a
 * binelea: „Golește ce am luat” marchează produsele `cleared`, ca partenerul să nu le
 * readucă la sincronizare; după 30 de zile ies și din pachet.
 */
export type ShoppingItem = { id: string; text: string; done?: boolean; cleared?: boolean; by?: string; updatedAt: string };

const DAY = 86_400_000;
export const SHOPPING_LIMIT = 200;

const stamp = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : undefined);

/** Curăță ce vine din stocare sau din pachetul partenerului. */
export function normalizeShoppingList(raw: unknown, now = Date.now()): ShoppingItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ShoppingItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<ShoppingItem>;
    const id = typeof entry.id === "string" ? entry.id.slice(0, 80) : "";
    const text = typeof entry.text === "string" ? entry.text.trim().slice(0, 80) : "";
    const updatedAt = stamp(entry.updatedAt);
    if (!id || !text || !updatedAt || seen.has(id)) continue;
    if (entry.cleared && now - Date.parse(updatedAt) > 30 * DAY) continue;
    seen.add(id);
    out.push({ id, text, updatedAt, ...(entry.done ? { done: true } : {}), ...(entry.cleared ? { cleared: true } : {}), ...(typeof entry.by === "string" && entry.by ? { by: entry.by.slice(0, 80) } : {}) });
  }
  return out.slice(0, SHOPPING_LIMIT);
}

/** Unirea a două liste: pe același produs, câștigă modificarea mai nouă. */
export function mergeShoppingLists(local: ReadonlyArray<ShoppingItem>, remote: ReadonlyArray<ShoppingItem>): ShoppingItem[] {
  const byId = new Map<string, ShoppingItem>();
  for (const item of [...remote, ...local]) {
    const existing = byId.get(item.id);
    if (!existing || (Date.parse(item.updatedAt) || 0) >= (Date.parse(existing.updatedAt) || 0)) byId.set(item.id, item);
  }
  return Array.from(byId.values()).slice(0, SHOPPING_LIMIT);
}

/** Ce se vede: de luat întâi (cele mai noi sus), apoi cele bifate. */
export const visibleShopping = (list: ReadonlyArray<ShoppingItem>) => {
  const live = list.filter((item) => !item.cleared);
  const byNewest = (a: ShoppingItem, b: ShoppingItem) => b.updatedAt.localeCompare(a.updatedAt);
  return { todo: live.filter((item) => !item.done).sort(byNewest), done: live.filter((item) => item.done).sort(byNewest) };
};

/** „lapte, pâine, 2 x ouă” → trei produse; virgulă, punct și virgulă sau rând nou le despart. */
export const splitShoppingText = (text: string) => text.split(/[,;\n]+/).map((part) => part.trim().replace(/\s+/g, " ")).filter((part) => part.length > 0).map((part) => part.charAt(0).toLocaleUpperCase("ro-RO") + part.slice(1));
