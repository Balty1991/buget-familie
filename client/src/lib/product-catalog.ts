/**
 * Catalog local de produse + clasificare + căutare în cataloage deschise
 * (Open Food Facts / Open Products Facts). Căutarea online trimite doar
 * denumirea tastată — fără poze și fără registru.
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
  ["Ciocolată", "Dulciuri", "ciocolata"],
  ["Kinder Ou", "Dulciuri", "kinder surprise kinder egg kinder oua kinder joy"],
  ["Kinder Joy", "Dulciuri"],
  ["Kinder Bueno", "Dulciuri"],
  ["Kinder Bueno White", "Dulciuri", "kinder bueno alb"],
  ["Kinder Ciocolată", "Dulciuri", "kinder chocolate kinder ciocolata"],
  ["Kinder Country", "Dulciuri"],
  ["Kinder Delice", "Dulciuri"],
  ["Kinder Schoko-Bons", "Dulciuri", "kinder schokobons schoko bons"],
  ["Kinder Cards", "Dulciuri"],
  ["Kinder Happy Hippo", "Dulciuri", "happy hippo"],
  ["Kinder Pingui", "Dulciuri"],
  ["Kinder Felie de lapte", "Dulciuri", "kinder milk slice"],
  ["Kinder Tronky", "Dulciuri"],
  ["Kinder Duplo", "Dulciuri"],
  ["Kinder Maxi", "Dulciuri"],
  ["Milka", "Dulciuri"],
  ["Poiana", "Dulciuri"],
  ["Africana", "Dulciuri"],
  ["Rom", "Dulciuri", "ciocolata rom"],
  ["Joe", "Dulciuri"],
  ["Oreo", "Dulciuri"],
  ["Nutella", "Dulciuri"],
  ["Twix", "Dulciuri"],
  ["Snickers", "Dulciuri"],
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
        const tokens = needle.split(/\s+/).filter((token) => token.length >= 2);
        const allTokens = tokens.length > 0 && tokens.every((token) => hay.includes(token));
        const brand = tokens[0] && tokens[0].length >= 4 && (name.startsWith(tokens[0]) || hay.split(" ").includes(tokens[0]));
        const score = name === needle ? 6
          : name.startsWith(needle) || hay.startsWith(needle) ? 5
          : hay.includes(needle) ? 4
          : allTokens ? 3
          : brand ? 2
          : 0;
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
  brands?: string | string[];
  categories_tags?: string[];
  quantity?: string;
};

/** Mapează etichetele Open Food Facts / Open Products Facts pe categoriile casei. */
export function categoryFromOnlineTags(tags: string[] = [], name = ""): string {
  const hay = foldRomanian(`${tags.join(" ")} ${name}`);
  if (/\b(milk|milks|dairy|dairies|yogurts|cheeses|butter|lapte|iaurt|branza|unt)\b/.test(hay)) return "Alimente";
  if (/\b(water|waters|mineral-water|apa)\b/.test(hay)) return "Apă";
  if (/\b(beverage|beverages|soda|juices|beer|wines|coffee|teas|suc|bere|bautur)\b/.test(hay)) return "Băuturi";
  if (/\b(chocolate|chocolates|sweet|sweets|biscuit|biscuits|candy|cookies|ice-cream|ciocol|dulce)\b/.test(hay)) return "Dulciuri";
  if (/\b(baby|infant|diaper|nappies|scutec|bibero)\b/.test(hay)) return "Consumabile copil";
  if (/\b(clean|cleaning|detergent|soap|hygiene|paper-tissues|household|deterg|sapun)\b/.test(hay)) return "Casă & facturi";
  if (/\b(clothes|clothing|socks|footwear|textile|ciorap|hain)\b/.test(hay)) return "Timp liber";
  return classifyProductLabel(name);
}

function brandOf(product: OffProduct): string {
  const raw = product.brands;
  if (Array.isArray(raw)) return (raw[0] || "").trim();
  return (raw || "").split(",")[0]?.trim() || "";
}

function onlineProductName(product: OffProduct): string | undefined {
  const raw = (product.product_name_ro || product.product_name || product.product_name_en || "").replace(/\s+/g, " ").trim();
  if (raw.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, "").length < 3) return undefined;
  const brand = brandOf(product);
  const labeled = brand && !foldRomanian(raw).includes(foldRomanian(brand)) ? `${brand} ${raw}` : raw;
  const withQty = product.quantity && !labeled.includes(product.quantity) ? `${labeled} ${product.quantity}` : labeled;
  return withQty.slice(0, 72).trim();
}

function relevantOnlineName(name: string, query: string): boolean {
  const hay = foldRomanian(name);
  const tokens = foldRomanian(query).split(/\s+/).filter((token) => token.length >= 3);
  const main = [...tokens].sort((left, right) => right.length - left.length)[0] || foldRomanian(query);
  return Boolean(main) && hay.includes(main);
}

function expandOnlineQueries(query: string): string[] {
  const folded = foldRomanian(query);
  const queries = [query.trim()];
  if (/\bkinder\b/.test(folded) && /\b(ou|oua|egg|joy)\b/.test(folded)) {
    queries.push("Kinder Surprise", "Kinder Joy");
  }
  return Array.from(new Set(queries.filter(Boolean)));
}

function hitsFromPayload(payload: { products?: OffProduct[]; hits?: OffProduct[] }, query: string): ProductHit[] {
  const hits: ProductHit[] = [];
  const seen = new Set<string>();
  for (const product of payload.hits || payload.products || []) {
    const name = onlineProductName(product);
    if (!name || !relevantOnlineName(name, query)) continue;
    const key = foldRomanian(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    hits.push({
      name,
      category: categoryFromOnlineTags(product.categories_tags || [], name),
      source: "online",
    });
    if (hits.length >= 10) break;
  }
  return hits;
}

async function searchOffUrl(url: string, query: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<ProductHit[]> {
  const response = await fetchImpl(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  return hitsFromPayload(await response.json() as { products?: OffProduct[]; hits?: OffProduct[] }, query);
}

async function searchOffHost(host: string, query: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<ProductHit[]> {
  const params = new URLSearchParams({
    action: "process",
    json: "1",
    page_size: "12",
    search_terms: query,
  });
  return searchOffUrl(`https://${host}/cgi/search.pl?${params.toString()}`, query, fetchImpl, signal);
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
  const queries = expandOnlineQueries(needle);
  const requests: Array<Promise<ProductHit[]>> = [];
  for (const term of queries) {
    const search = new URLSearchParams({ q: term, page_size: "12", langs: "ro,en" });
    requests.push(searchOffUrl(`https://search.openfoodfacts.org/search?${search.toString()}`, term, fetchImpl, options.signal));
    requests.push(searchOffHost("world.openfoodfacts.org", term, fetchImpl, options.signal));
  }
  requests.push(searchOffHost("world.openproductsfacts.org", needle, fetchImpl, options.signal));
  const settled = await Promise.allSettled(requests);
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
  return merged.slice(0, 12);
}

const CHAT_SKIP = new Set([
  "ok", "da", "nu", "bine", "merci", "multumesc", "salut", "hey", "hi", "alo", "gata", "stop",
  "hello", "yes", "no", "thanks", "ajutor", "help", "ce", "cum",
]);

/** Un cuvânt-două fără sumă: omul caută un articol, nu vorbește cu ghidul. */
export function looksLikeProductSearch(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 3 || text.length > 48) return false;
  const folded = foldRomanian(text);
  if (!folded || CHAT_SKIP.has(folded)) return false;
  if (/[?]/.test(text)) return false;
  if (/\b(lei|ron|eur|cheltui|platit|am dat|adaug|muta|transfer|venit|salariu|factura|plic|bon)\b/.test(folded)) return false;
  if (/^(ce |cum |cat |cati |cate |unde |de ce |cand )/.test(folded)) return false;
  const words = folded.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 5;
}

export const CATALOG_STARTERS = ["Kinder", "Lapte", "Napolact", "Pâine", "Ariel", "Detergent", "Ciorapi", "Ouă"];
