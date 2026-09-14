/**
 * Catalog local de produse + clasificare. Fără cloud: căutarea e pe telefon,
 * categoria e o propunere din denumire, iar repartizarea se calculează din
 * liniile bonurilor deja salvate.
 */
import { foldRomanian, type Receipt } from "./finance-data";

export type CatalogProduct = { name: string; category: string; aliases?: string[] };
export type ProductHit = { name: string; category: string; source: "catalog" | "bon" | "online" };
export type SpendGroup = "Alimente" | "Nealimentare";
export type CategorySpend = { category: string; group: SpendGroup; amount: number; count: number };
export type ProductSpend = { key: string; label: string; category: string; group: SpendGroup; amount: number; count: number };

export const FOOD_CATEGORIES = new Set(["Alimente", "Băuturi", "Dulciuri", "Apă"]);

export function spendGroupOf(category: string): SpendGroup {
  return FOOD_CATEGORIES.has(category) ? "Alimente" : "Nealimentare";
}

const ITEMS: Array<[string, string, string?]> = [
  ["Pâine", "Alimente", "franzela paine alba paine neagra"],
  ["Lapte", "Alimente"],
  ["Iaurt", "Alimente"],
  ["Kefir", "Alimente"],
  ["Smântână", "Alimente", "smantana"],
  ["Brânză", "Alimente", "branza telemea cascaval"],
  ["Cașcaval", "Alimente", "cascaval"],
  ["Ouă", "Alimente", "oua"],
  ["Unt", "Alimente"],
  ["Ulei", "Alimente", "ulei floarea soarelui ulei masline"],
  ["Zahăr", "Alimente", "zahar"],
  ["Făină", "Alimente", "faina"],
  ["Mălai", "Alimente", "malai"],
  ["Orez", "Alimente"],
  ["Paste", "Alimente", "spaghetti macaroane"],
  ["Cartofi", "Alimente"],
  ["Ceapă", "Alimente", "ceapa"],
  ["Usturoi", "Alimente"],
  ["Roșii", "Alimente", "rosii"],
  ["Castraveti", "Alimente"],
  ["Ardei", "Alimente"],
  ["Morcovi", "Alimente"],
  ["Varză", "Alimente", "varza"],
  ["Salată", "Alimente", "salata"],
  ["Mere", "Alimente"],
  ["Banane", "Alimente"],
  ["Portocale", "Alimente"],
  ["Lămâi", "Alimente", "lamai"],
  ["Struguri", "Alimente"],
  ["Căpșuni", "Alimente", "capsuni"],
  ["Carne de pui", "Alimente", "pui piept pui pulpe pui"],
  ["Carne de porc", "Alimente", "porc"],
  ["Carne de vită", "Alimente", "vita"],
  ["Mincă", "Alimente", "minced carne tocata"],
  ["Mezeluri", "Alimente", "salam sunca parizer kaiser"],
  ["Salam", "Alimente"],
  ["Șuncă", "Alimente", "sunca"],
  ["Cârnați", "Alimente", "carnati"],
  ["Pește", "Alimente", "peste"],
  ["Conservă ton", "Alimente", "ton conserva"],
  ["Fasole", "Alimente"],
  ["Linte", "Alimente"],
  ["Năut", "Alimente", "naut"],
  ["Mazăre", "Alimente", "mazare"],
  ["Porumb", "Alimente"],
  ["Ketchup", "Alimente"],
  ["Maioneză", "Alimente", "maioneza"],
  ["Muștar", "Alimente", "mustar"],
  ["Sare", "Alimente"],
  ["Piper", "Alimente"],
  ["Bulion", "Alimente"],
  ["Conserve", "Alimente"],
  ["Cereale", "Alimente"],
  ["Fulgi ovăz", "Alimente", "ovaz"],
  ["Miere", "Alimente"],
  ["Gem", "Alimente"],
  ["Unt de arahide", "Alimente"],
  ["Nuci", "Alimente"],
  ["Semințe", "Alimente", "seminte"],
  ["Pâine toast", "Alimente", "toast"],
  ["Covrigi", "Alimente"],
  ["Croissant", "Alimente"],
  ["Pizza", "Alimente"],
  ["Supe", "Alimente", "supa"],
  ["Cartofi congelați", "Alimente", "cartofi prajiti"],
  ["Înghețată", "Dulciuri", "inghetata"],
  ["Ciocolată", "Dulciuri", "ciocolata kinder milka"],
  ["Biscuiți", "Dulciuri", "biscuiti"],
  ["Napolitane", "Dulciuri"],
  ["Bomboane", "Dulciuri"],
  ["Prăjituri", "Dulciuri", "prajituri"],
  ["Wafele", "Dulciuri"],
  ["Chipsuri", "Dulciuri", "chips lays"],
  ["Popcorn", "Dulciuri"],
  ["Gumă", "Dulciuri", "guma"],
  ["Apă", "Apă", "apa plata apa minerala bucovina dorna"],
  ["Apă minerală", "Apă", "apa minerala"],
  ["Suc", "Băuturi", "suc cola fanta sprite"],
  ["Cola", "Băuturi", "coca cola pepsi"],
  ["Cafea", "Băuturi"],
  ["Ceai", "Băuturi"],
  ["Bere", "Băuturi"],
  ["Vin", "Băuturi"],
  ["Energizant", "Băuturi", "red bull energy"],
  ["Lapte vegetal", "Alimente", "lapte ovaz lapte migdale"],
  ["Detergent", "Casă & facturi"],
  ["Detergent vase", "Casă & facturi", "fairy"],
  ["Balsam rufe", "Casă & facturi"],
  ["Săpun", "Casă & facturi", "sapun"],
  ["Șampon", "Casă & facturi", "sampon"],
  ["Gel duș", "Casă & facturi", "gel dus"],
  ["Pastă dinți", "Casă & facturi", "pasta dinti"],
  ["Periuță dinți", "Casă & facturi", "periuta"],
  ["Hârtie igienică", "Casă & facturi", "hartie igienica"],
  ["Șervețele", "Casă & facturi", "servetele"],
  ["Prosoape hârtie", "Casă & facturi", "prosop hartie"],
  ["Burete", "Casă & facturi"],
  ["Saci menajeri", "Casă & facturi", "saci gunoi"],
  ["Sacoșă", "Casă & facturi", "sacosa punga"],
  ["Soluție geamuri", "Casă & facturi", "solutie"],
  ["Clor", "Casă & facturi"],
  ["Oțet", "Alimente", "otet"],
  ["Bicarbonat", "Alimente"],
  ["Bec", "Casă & facturi"],
  ["Baterii", "Casă & facturi"],
  ["Lipici", "Casă & facturi"],
  ["Folie alimentară", "Casă & facturi", "folie"],
  ["Pungi congelator", "Casă & facturi"],
  ["Scutece", "Consumabile copil", "pampers"],
  ["Șervețele bebe", "Consumabile copil", "servetele bebe"],
  ["Lapte praf", "Consumabile copil"],
  ["Biberon", "Consumabile copil"],
  ["Jucărie", "Consumabile copil", "jucarie"],
  ["Paracetamol", "Sănătate", "nurofen ibuprofen"],
  ["Vitamine", "Sănătate"],
  ["Plasturi", "Sănătate"],
  ["Termometru", "Sănătate"],
  ["Ciorapi", "Timp liber", "ciorap sosete"],
  ["Șosete", "Timp liber", "sosete"],
  ["Hanorac", "Timp liber"],
  ["Tricou", "Timp liber"],
  ["Bluză", "Timp liber", "bluza"],
  ["Pantaloni", "Timp liber"],
  ["Rochie", "Timp liber"],
  ["Fustă", "Timp liber", "fusta"],
  ["Geacă", "Timp liber", "geaca"],
  ["Palton", "Timp liber"],
  ["Lenjerie", "Timp liber", "chiloti boxeri sutien"],
  ["Chiloți", "Timp liber", "chiloti"],
  ["Adidași", "Timp liber", "adidasi tenisi"],
  ["Încălțăminte", "Timp liber", "incaltaminte pantofi"],
  ["Cureă", "Timp liber", "curea"],
  ["Geantă", "Timp liber", "geanta"],
  ["Rucsac", "Timp liber"],
  ["Căciulă", "Timp liber", "caciula"],
  ["Eșarfă", "Timp liber", "esarfa"],
  ["Mănuși", "Timp liber", "manusi"],
  ["Benzină", "Transport", "benzina"],
  ["Motorină", "Transport", "motorina"],
  ["Parcare", "Transport"],
  ["Bilet transport", "Transport", "bilet metro stb"],
  ["Garanție SGR", "Alimente", "garantie pet sgr"],
];

const RULES: Array<[RegExp, string]> = [
  [/\b(garantie|garanție|sgr|pet sgr)\b/, "Alimente"],
  [/\b(scutec|pampers|bibero|jucarie|jucării|bebe|copil)\b/, "Consumabile copil"],
  [/\b(ciorap|sosete|hanorac|bluza|tricou|pantal|rochie|fusta|geaca|palton|incalt|adidasi|tenisi|chilot|boxer|sutien|lenjerie|salopeta|vesta|caciula|esarfa|curea|geanta|rucsac|hain|pulover|cardigan)\b/, "Timp liber"],
  [/\b(apa|suc|cola|fanta|sprite|bere|vin|cafea|ceai|bautur|red bull|pepsi)\b/, "Băuturi"],
  [/\b(ciocol|kinder|biscuit|bombo|dulce|napolitan|prajitur|cookie|inghetata|wafe|chips|guma)\b/, "Dulciuri"],
  [/\b(deterg|sapun|igien|servetel|hartie|burete|solutie|sac menaj|sacosa|punga|lipici|sampon|pasta dinti|periuta|clor|fairy|ariel|dash)\b/, "Casă & facturi"],
  [/\b(taxi|uber|bolt|benz|motorin|parcar|transport|metrou|stb)\b/, "Transport"],
  [/\b(farmac|medic|vitamin|pastil|nurofen|paracetamol|plasture)\b/, "Sănătate"],
  [/\b(paine|lapte|iaurt|branza|oua|carne|mezel|fruct|legum|orez|paste|faina|malai|ulei|zahar|aliment|cereale|unt|cascaval|salam|sunca|pui|porc)\b/, "Alimente"],
];

const catalog: CatalogProduct[] = ITEMS.map(([name, category, aliases]) => ({
  name,
  category,
  aliases: aliases ? aliases.split(" ").filter(Boolean) : undefined,
}));

const foldedName = (item: CatalogProduct) => foldRomanian([item.name, ...(item.aliases || [])].join(" "));

export function classifyProductLabel(label: string): string {
  const folded = foldRomanian(label);
  if (!folded) return "Alimente";
  const exact = catalog.find((item) => foldRomanian(item.name) === folded);
  if (exact) return exact.category;
  const named = catalog.find((item) => {
    const hay = foldedName(item);
    return hay.split(" ").some((token) => token.length >= 4 && folded.includes(token)) || folded.includes(foldRomanian(item.name));
  });
  if (named) return named.category;
  const rule = RULES.find(([pattern]) => pattern.test(folded));
  return rule?.[1] || "Alimente";
}

export function dominantReceiptCategory(items: Array<{ category?: string; amount: number; label?: string }>): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    const category = item.category || classifyProductLabel(item.label || "");
    totals.set(category, (totals.get(category) || 0) + Math.max(0, item.amount));
  }
  let best = "Alimente";
  let max = -1;
  totals.forEach((amount, category) => {
    if (amount > max) {
      best = category;
      max = amount;
    }
  });
  return best;
}

export function searchProductCatalog(query: string, receipts: Receipt[] = [], limit = 12): ProductHit[] {
  const needle = foldRomanian(query).trim();
  const hits: ProductHit[] = [];
  const seen = new Set<string>();
  const push = (hit: ProductHit) => {
    const key = foldRomanian(hit.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };
  if (needle.length >= 2) {
    for (const receipt of receipts) {
      for (const line of receipt.lines || []) {
        if (!line.label) continue;
        if (foldRomanian(line.label).includes(needle)) push({ name: line.label, category: line.category || classifyProductLabel(line.label), source: "bon" });
      }
    }
    const ranked = catalog
      .map((item) => {
        const hay = foldedName(item);
        const name = foldRomanian(item.name);
        const score = name === needle ? 3 : name.startsWith(needle) || hay.startsWith(needle) ? 2 : hay.includes(needle) ? 1 : 0;
        return { item, score };
      })
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name, "ro"));
    for (const row of ranked) push({ name: row.item.name, category: row.item.category, source: "catalog" });
  }
  return hits.slice(0, limit);
}

export function productSpendBreakdown(receipts: Receipt[], month?: string) {
  const scoped = month ? receipts.filter((item) => item.date.startsWith(month)) : receipts;
  const byCategory = new Map<string, CategorySpend>();
  const byProduct = new Map<string, ProductSpend>();
  let food = 0;
  let nonFood = 0;
  for (const receipt of scoped) {
    const lines = receipt.lines?.length ? receipt.lines : [{ id: "whole", category: receipt.category, amount: receipt.amount, label: receipt.vendor }];
    for (const line of lines) {
      if (!(line.amount > 0)) continue;
      const category = line.category || classifyProductLabel(line.label || receipt.vendor);
      const group = spendGroupOf(category);
      if (group === "Alimente") food += line.amount;
      else nonFood += line.amount;
      const cat = byCategory.get(category) || { category, group, amount: 0, count: 0 };
      cat.amount += line.amount;
      cat.count += 1;
      byCategory.set(category, cat);
      const key = foldRomanian(line.label || category) || category;
      const product = byProduct.get(key) || { key, label: line.label || category, category, group, amount: 0, count: 0 };
      product.amount += line.amount;
      product.count += 1;
      byProduct.set(key, product);
    }
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    food: round(food),
    nonFood: round(nonFood),
    total: round(food + nonFood),
    byCategory: Array.from(byCategory.values()).map((item) => ({ ...item, amount: round(item.amount) })).sort((left, right) => right.amount - left.amount),
    products: Array.from(byProduct.values()).map((item) => ({ ...item, amount: round(item.amount) })).sort((left, right) => right.amount - left.amount),
    receiptCount: scoped.length,
  };
}

export const catalogSize = catalog.length;

type OffProduct = {
  product_name?: string;
  product_name_ro?: string;
  product_name_en?: string;
  brands?: string;
  categories_tags?: string[];
  quantity?: string;
};

/** Mapează etichetele Open Food Facts / Open Products Facts pe categoriile casei. */
export function categoryFromOnlineTags(tags: string[] = [], name = ""): string {
  const hay = foldRomanian(`${tags.join(" ")} ${name}`);
  if (/\b(water|waters|mineral-water|apa)\b/.test(hay)) return "Apă";
  if (/\b(beverage|beverages|soda|juices|beer|wines|coffee|teas|suc|bere|bautur)\b/.test(hay)) return "Băuturi";
  if (/\b(chocolate|chocolates|sweet|sweets|biscuit|biscuits|candy|cookies|ice-cream|ciocol|dulce)\b/.test(hay)) return "Dulciuri";
  if (/\b(baby|infant|diaper|nappies|scutec|bibero)\b/.test(hay)) return "Consumabile copil";
  if (/\b(clean|cleaning|detergent|soap|hygiene|paper-tissues|household|deterg|sapun)\b/.test(hay)) return "Casă & facturi";
  if (/\b(clothes|clothing|socks|footwear|textile|ciorap|hain)\b/.test(hay)) return "Timp liber";
  return classifyProductLabel(name);
}

function onlineProductName(product: OffProduct): string | undefined {
  const raw = (product.product_name_ro || product.product_name || product.product_name_en || "").replace(/\s+/g, " ").trim();
  if (raw.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, "").length < 3) return undefined;
  const brand = (product.brands || "").split(",")[0]?.trim();
  const labeled = brand && !foldRomanian(raw).includes(foldRomanian(brand)) ? `${brand} ${raw}` : raw;
  const withQty = product.quantity && !labeled.includes(product.quantity) ? `${labeled} ${product.quantity}` : labeled;
  return withQty.slice(0, 72).trim();
}

async function searchOffHost(host: string, query: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<ProductHit[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "8",
    lc: "ro",
    cc: "ro",
  });
  const response = await fetchImpl(`https://${host}/cgi/search.pl?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];
  const payload = await response.json() as { products?: OffProduct[] };
  const hits: ProductHit[] = [];
  for (const product of payload.products || []) {
    const name = onlineProductName(product);
    if (!name) continue;
    hits.push({
      name,
      category: categoryFromOnlineTags(product.categories_tags || [], name),
      source: "online",
    });
    if (hits.length >= 8) break;
  }
  return hits;
}

/**
 * Caută în cataloagele deschise Open Food Facts (alimente) și Open Products Facts
 * (casă / nealimentare). Pleacă doar denumirea căutată — fără poze, fără registru.
 */
export async function searchOnlineProducts(
  query: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ProductHit[]> {
  const needle = query.trim();
  if (needle.length < 3) return [];
  const fetchImpl = options.fetchImpl || fetch;
  const settled = await Promise.allSettled([
    searchOffHost("world.openfoodfacts.org", needle, fetchImpl, options.signal),
    searchOffHost("world.openproductsfacts.org", needle, fetchImpl, options.signal),
  ]);
  const merged: ProductHit[] = [];
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const hit of result.value) {
      const key = foldRomanian(hit.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
  }
  return merged.slice(0, 10);
}
