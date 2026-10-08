/**
 * Istoricul prețurilor din bonurile deja salvate și coșul etalon al gospodăriei.
 *
 * Nu cere nicio sursă externă de prețuri: totul se calculează din liniile bonurilor
 * fotografiate de utilizator. Etichetele vin din OCR și sunt scurte și inconsecvente,
 * așa că normalizarea este conservatoare — preferăm să nu potrivim două produse decât
 * să le confundăm. Rezultatul este o observație, nu un adevăr de piață: două cumpărături
 * ale aceluiași produs pot diferi prin gramaj, promoție sau lot.
 */
import { foldRomanian, isoToday, type AppData, type Receipt } from "./finance-data";

export type PriceObservation = { receiptId: string; vendor: string; date: string; amount: number; category: string; label: string };

export type ProductPriceHistory = {
  key: string;
  label: string;
  category: string;
  observations: PriceObservation[];
  latest: PriceObservation;
  earliest: PriceObservation;
  /** Diferența dintre ultima și prima observație, în lei și procentual. */
  change: number;
  changePercent: number;
  /** Magazinele în care produsul a fost cumpărat, cu cel mai mic preț observat în fiecare. */
  byVendor: Array<{ vendor: string; amount: number; date: string }>;
  cheapest?: { vendor: string; amount: number; date: string };
  dearest?: { vendor: string; amount: number; date: string };
};

const UNIT_PATTERN = /\b\d+(?:[,.]\d+)?\s*(?:buc(?:ati|ăți)?|kg|g|gr|l|ml|cl|x)\b/gi;
const CODE_PATTERN = /\b[a-z]?\d{4,}\b/gi;

/**
 * Cheia de potrivire a două linii de bon. Renunțăm la gramaje, coduri și punctuație,
 * pentru că OCR-ul le citește diferit de la un bon la altul. Etichetele prea scurte
 * sau fără litere nu produc cheie: mai bine niciun istoric decât unul greșit.
 */
export function normalizeProductKey(label: string): string | undefined {
  const folded = foldRomanian(label)
    .replace(UNIT_PATTERN, " ")
    .replace(CODE_PATTERN, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const letters = folded.replace(/[^a-z]/g, "");
  if (letters.length < 3) return undefined;
  const words = folded.split(" ").filter((word) => word.length > 1);
  if (!words.length) return undefined;
  return words.slice(0, 4).join(" ");
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Bonul scanat se salvează ca „Cumpărături Profi”: în istoric contează doar magazinul. */
export function receiptVendorName(vendor: string | undefined): string {
  const name = (vendor || "").trim().replace(/^(?:cump[aă]r[aă]turi|shopping)\s+/i, "").trim();
  return name || "Magazin necunoscut";
}

/**
 * Rândul unui bon scanat poartă cantitatea și reducerea în etichetă: „Crenvurști pui × 2 (reducere −2,45)”.
 * Pentru comparație contează produsul și prețul pe bucată: scoatem adaosurile și împărțim la cantitate.
 */
export function receiptLineUnit(label: string, amount: number): { label: string; amount: number } {
  let clean = label.replace(/\s*\((?:reducere|discount)\s*[−-][^)]*\)\s*$/i, "").trim();
  const quantity = /\s[×x]\s*(\d+(?:[.,]\d+)?)(\s*kg)?\s*$/i.exec(clean);
  let unit = amount;
  if (quantity) {
    const count = Number(quantity[1].replace(",", "."));
    clean = clean.slice(0, quantity.index).trim();
    // Bucăți întregi → preț pe bucată; „× 0,456 kg” scris de mână → preț pe kg.
    // Un „× 0,456” fără unitate (de pe bon scanat) păstrează prețul plătit pe rând.
    if (quantity[2] && count > 0) unit = amount / count;
    else if (Number.isInteger(count) && count > 1) unit = amount / count;
  }
  return { label: clean || label.trim(), amount: round2(unit) };
}

function observationsFrom(receipts: Receipt[]) {
  const groups = new Map<string, PriceObservation[]>();
  for (const receipt of receipts) {
    const vendor = receiptVendorName(receipt.vendor);
    for (const line of receipt.lines || []) {
      if (!line.label || line.amount <= 0 || line.label === "Rest bon" || line.label === "Diferență neînregistrată" || line.label === "Diferență față de bon") continue;
      const unit = receiptLineUnit(line.label, line.amount);
      const key = normalizeProductKey(unit.label);
      if (!key) continue;
      const list = groups.get(key) || [];
      list.push({ receiptId: receipt.id, vendor, date: receipt.date, amount: unit.amount, category: line.category, label: unit.label });
      groups.set(key, list);
    }
  }
  return groups;
}

/**
 * Istoricul fiecărui produs recunoscut. `minObservations` implicit 2, pentru că un
 * singur preț nu spune nimic despre evoluție.
 */
export function productPriceHistories(data: AppData, options: { minObservations?: number } = {}): ProductPriceHistory[] {
  const minObservations = Math.max(1, options.minObservations ?? 2);
  const groups = observationsFrom(data.receipts);
  const histories: ProductPriceHistory[] = [];
  groups.forEach((entries, key) => {
    if (entries.length < minObservations) return;
    const observations = [...entries].sort((left, right) => left.date.localeCompare(right.date) || left.receiptId.localeCompare(right.receiptId));
    const earliest = observations[0];
    const latest = observations[observations.length - 1];
    const perVendor = new Map<string, { vendor: string; amount: number; date: string }>();
    for (const item of observations) {
      const known = perVendor.get(item.vendor);
      // Reținem cel mai mic preț observat în fiecare magazin; la egalitate, pe cel mai recent.
      if (!known || item.amount < known.amount) perVendor.set(item.vendor, { vendor: item.vendor, amount: item.amount, date: item.date });
    }
    const byVendor = Array.from(perVendor.values()).sort((left, right) => left.amount - right.amount);
    histories.push({
      key,
      label: latest.label,
      category: latest.category,
      observations,
      earliest,
      latest,
      change: round2(latest.amount - earliest.amount),
      changePercent: earliest.amount > 0 ? Math.round((latest.amount / earliest.amount - 1) * 1000) / 10 : 0,
      byVendor,
      cheapest: byVendor[0],
      dearest: byVendor.length > 1 ? byVendor[byVendor.length - 1] : undefined,
    });
  });
  return histories.sort((left, right) => right.observations.length - left.observations.length || right.latest.date.localeCompare(left.latest.date));
}

export type BasketLine = {
  key: string;
  label: string;
  current: number;
  baseline: number;
  change: number;
  changePercent: number;
  currentDate: string;
  baselineDate: string;
  vendor: string;
};

export type BasketIndex = {
  lines: BasketLine[];
  currentTotal: number;
  baselineTotal: number;
  change: number;
  changePercent: number;
  /** Produsele alese care nu au încă două prețuri la distanță suficientă pentru comparație. */
  pending: string[];
  windowDays: number;
};

/**
 * Coșul etalon: cât costa acum un set de produse alese de utilizator, față de cât costa
 * cu `windowDays` în urmă. Este un indice al gospodăriei, calculat din bonurile proprii,
 * nu o statistică națională. Un produs fără o observație suficient de veche este raportat
 * ca în așteptare, nu completat cu presupuneri.
 */
export function referenceBasket(data: AppData, keys: string[], options: { windowDays?: number; asOf?: string } = {}): BasketIndex {
  const windowDays = Math.max(7, options.windowDays ?? 90);
  const asOf = options.asOf || isoToday();
  const boundary = new Date(`${asOf}T12:00:00`);
  boundary.setDate(boundary.getDate() - windowDays);
  const boundaryIso = `${boundary.getFullYear()}-${String(boundary.getMonth() + 1).padStart(2, "0")}-${String(boundary.getDate()).padStart(2, "0")}`;
  const histories = new Map(productPriceHistories(data, { minObservations: 1 }).map((item) => [item.key, item]));
  const lines: BasketLine[] = [];
  const pending: string[] = [];
  for (const key of keys) {
    const history = histories.get(key);
    if (!history) { pending.push(key); continue; }
    const upToDate = history.observations.filter((item) => item.date <= asOf);
    const current = upToDate[upToDate.length - 1];
    // Reperul este ultima observație de dinaintea ferestrei; fără ea, produsul nu se poate compara.
    const baseline = upToDate.filter((item) => item.date <= boundaryIso).at(-1);
    if (!current || !baseline || baseline.receiptId === current.receiptId) { pending.push(history.label); continue; }
    lines.push({
      key,
      label: history.label,
      current: current.amount,
      baseline: baseline.amount,
      change: round2(current.amount - baseline.amount),
      changePercent: baseline.amount > 0 ? Math.round((current.amount / baseline.amount - 1) * 1000) / 10 : 0,
      currentDate: current.date,
      baselineDate: baseline.date,
      vendor: current.vendor,
    });
  }
  const currentTotal = round2(lines.reduce((sum, line) => sum + line.current, 0));
  const baselineTotal = round2(lines.reduce((sum, line) => sum + line.baseline, 0));
  return {
    lines: lines.sort((left, right) => right.changePercent - left.changePercent),
    currentTotal,
    baselineTotal,
    change: round2(currentTotal - baselineTotal),
    changePercent: baselineTotal > 0 ? Math.round((currentTotal / baselineTotal - 1) * 1000) / 10 : 0,
    pending,
    windowDays,
  };
}

/** Produsele cele mai potrivite pentru coșul etalon: cele cumpărate cel mai des. */
export const basketCandidates = (data: AppData, limit = 20) =>
  productPriceHistories(data, { minObservations: 2 }).slice(0, limit);

export type KnownProduct = { label: string; category: string; amount: number; count: number };

/**
 * Denumirile din bonurile salvate (scanate sau scrise), pentru sugestii când omul scrie un articol:
 * așa același produs are mereu același nume și intră în istoricul de prețuri. Cele mai cumpărate primele.
 */
export function knownProducts(data: AppData, limit = 300): KnownProduct[] {
  const byKey = new Map<string, KnownProduct & { date: string }>();
  for (const receipt of data.receipts) {
    for (const line of receipt.lines || []) {
      if (!line.label || line.amount <= 0 || line.label === "Rest bon" || line.label === "Diferență neînregistrată" || line.label === "Diferență față de bon") continue;
      const unit = receiptLineUnit(line.label, line.amount);
      const key = normalizeProductKey(unit.label);
      if (!key) continue;
      const known = byKey.get(key);
      const newer = !known || receipt.date >= known.date;
      byKey.set(key, {
        label: newer ? unit.label : known!.label,
        category: newer ? line.category : known!.category,
        amount: newer ? unit.amount : known!.amount,
        date: newer ? receipt.date : known!.date,
        count: (known?.count || 0) + 1,
      });
    }
  }
  return Array.from(byKey.values())
    .sort((left, right) => right.count - left.count || right.date.localeCompare(left.date))
    .slice(0, limit)
    .map(({ label, category, amount, count }) => ({ label, category, amount, count }));
}

/** Produsul știut cu exact această denumire (fără diferențe de litere mari sau diacritice). */
export function findKnownProduct(products: KnownProduct[], label: string): KnownProduct | undefined {
  const key = normalizeProductKey(label);
  return key ? products.find((item) => normalizeProductKey(item.label) === key) : undefined;
}
