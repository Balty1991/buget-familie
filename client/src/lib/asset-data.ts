/**
 * Bunurile familiei pentru „Averea familiei”: casa, mașina, investițiile, cu valoarea estimată.
 * Stau în setările familiei și se sincronizează; la unire câștigă modificarea mai nouă, iar
 * ștergerea lasă o piatră de mormânt (`deleted`), ca partenerul să nu readucă bunul.
 * Fără importuri, ca `finance-data` să le poată folosi fără cerc.
 */
export type AssetKind = "home" | "car" | "investment" | "other";
export type Asset = { id: string; name: string; kind: AssetKind; value: number; updatedAt: string; deleted?: boolean };

const KINDS: AssetKind[] = ["home", "car", "investment", "other"];

export function normalizeAssets(raw: unknown): Asset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Asset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<Asset>;
    const id = typeof entry.id === "string" ? entry.id.slice(0, 80) : "";
    const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 60) : "";
    const updatedAt = typeof entry.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(entry.updatedAt) ? entry.updatedAt : "";
    if (!id || !name || !updatedAt || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, kind: KINDS.includes(entry.kind as AssetKind) ? entry.kind as AssetKind : "other", value: Math.round(Math.max(0, Number(entry.value) || 0) * 100) / 100, updatedAt, ...(entry.deleted ? { deleted: true } : {}) });
  }
  return out.slice(0, 50);
}

export function mergeAssets(local: ReadonlyArray<Asset> = [], remote: ReadonlyArray<Asset> = []): Asset[] {
  const byId = new Map<string, Asset>();
  for (const item of [...remote, ...local]) {
    const known = byId.get(item.id);
    if (!known || (Date.parse(item.updatedAt) || 0) >= (Date.parse(known.updatedAt) || 0)) byId.set(item.id, item);
  }
  return Array.from(byId.values()).slice(0, 50);
}
