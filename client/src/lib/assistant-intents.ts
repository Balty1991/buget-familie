/**
 * Ce vrea utilizatorul, în cuvintele lui.
 *
 * Asistentul citea până acum „prima sumă din mesaj” și presupunea un venit, așa că
 * „fă-mi plic Alimente, 2400, cu limita săptămânală 600 lei” devenea „salariu 600 lei”.
 * Aici mesajul este împărțit în segmente după marcatorii de intenție, fiecare segment
 * este citit cu regulile lui, iar sumele primesc rol din cuvintele din jur, nu din ordine.
 *
 * Modulul este pur și nu scrie nimic: întoarce propuneri pe care interfața le arată
 * spre confirmare. Nicio mișcare nu intră în registru fără o apăsare explicită.
 */
import { expenseCategories, guessCategoryFromText, isoDate, isoToday, parseRomanianAmount } from "./finance-data";

/**
 * Normalizare care păstrează lungimea textului. `foldRomanian` descompune în NFD și
 * elimină semnele diacritice, ceea ce scurtează șirul — iar poziția unui marcator
 * găsit în varianta normalizată nu s-ar mai potrivi cu textul original, deci segmentele
 * ar fi tăiate greșit. Aici fiecare literă este înlocuită cu una singură.
 */
const DIACRITICS: Record<string, string> = { "ă": "a", "â": "a", "î": "i", "ș": "s", "ş": "s", "ț": "t", "ţ": "t", "Ă": "A", "Â": "A", "Î": "I", "Ș": "S", "Ş": "S", "Ț": "T", "Ţ": "T" };
const fold = (value: string) => value.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, (char) => DIACRITICS[char] || char).toLowerCase();

export type AssistantIntent =
  | { kind: "expense"; amount: number; category: string; title: string; date: string }
  | { kind: "income"; amount: number; title: string; date: string }
  | { kind: "envelope"; label: string; amount: number; category?: string; weeklyLimit?: number; weeklyPace: boolean }
  | { kind: "debt"; name: string; remaining: number; monthly?: number }
  | { kind: "recurring"; name: string; amount: number; dueDay: number; category: string }
  | { kind: "goal"; name: string; target: number; current?: number; dueDate?: string }
  | { kind: "payday"; date: string; flexDays: number };

export type ParsedIntent = { intent: AssistantIntent; segment: string };

/* ------------------------------------------------------------------ date */

const clampDay = (year: number, month: number, day: number) => Math.min(Math.max(1, day), new Date(year, month, 0).getDate());
const iso = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(clampDay(year, month, day)).padStart(2, "0")}`;
const valid = (month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= 31;

/** `explicit` marchează o dată scrisă cu cifre; „luna viitoare” este doar o aproximare. */
export type DateHit = { start: string; end?: string; index: number; length: number; explicit: boolean };

/**
 * Datele sunt citite înaintea sumelor și scoase din text, altfel „07/10-10-2026”
 * ar fi fost interpretat ca patru sume. Formatul cu interval este cel scris de mână:
 * „între data 07/10-10-2026” înseamnă de pe 7 până pe 10 octombrie.
 */
export function extractDates(raw: string, asOf = isoToday()): { hits: DateHit[]; masked: string } {
  const hits: DateHit[] = [];
  const today = new Date(`${asOf}T12:00:00`);
  const push = (hit: DateHit) => { if (!hits.some((item) => hit.index < item.index + item.length && item.index < hit.index + hit.length)) hits.push(hit); };

  // interval scris de mână: 07/10-10-2026
  for (const m of Array.from(raw.matchAll(/\b(\d{1,2})[./](\d{1,2})\s*[-–]\s*(\d{1,2})[-./](\d{4})\b/g))) {
    const [d1, m1, d2, year] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (!valid(m1, d1) || !valid(m1, d2)) continue;
    push({ start: iso(year, m1, d1), end: iso(year, m1, d2), index: m.index!, length: m[0].length, explicit: true });
  }
  // zi.lună.an
  for (const m of Array.from(raw.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g))) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    if (!valid(month, day) || year < 2000 || year > 2100) continue;
    push({ start: iso(year, month, day), index: m.index!, length: m[0].length, explicit: true });
  }
  // zi.lună fără an: alegem următoarea apariție
  for (const m of Array.from(raw.matchAll(/\b(\d{1,2})[./](\d{1,2})\b(?![./-]\d)/g))) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (!valid(month, day)) continue;
    const year = month < today.getMonth() + 1 || (month === today.getMonth() + 1 && day < today.getDate()) ? today.getFullYear() + 1 : today.getFullYear();
    push({ start: iso(year, month, day), index: m.index!, length: m[0].length, explicit: true });
  }

  const folded = fold(raw);
  const relative: Array<[RegExp, () => string]> = [
    [/\bpoimaine\b/, () => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2))],
    [/\bmaine\b/, () => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))],
    [/\balaltaieri\b/, () => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2))],
    [/\bieri\b/, () => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))],
    [/\b(azi|astazi)\b/, () => asOf],
    [/\bluna viitoare\b/, () => iso(today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear(), today.getMonth() === 11 ? 1 : today.getMonth() + 2, today.getDate())],
  ];
  for (const [pattern, resolve] of relative) {
    const m = folded.match(pattern);
    if (m && typeof m.index === "number") push({ start: resolve(), index: m.index, length: m[0].length, explicit: false });
  }

  hits.sort((a, b) => a.index - b.index);
  let masked = raw;
  for (const hit of [...hits].sort((a, b) => b.index - a.index)) {
    masked = masked.slice(0, hit.index) + " ".repeat(hit.length) + masked.slice(hit.index + hit.length);
  }
  return { hits, masked };
}

/* ----------------------------------------------------------------- sume */

export type AmountHit = { value: number; index: number; length: number };

/** Sumele se citesc din textul deja curățat de date, ca zilele să nu fie luate drept lei. */
export function extractAmounts(masked: string): AmountHit[] {
  const out: AmountHit[] = [];
  for (const m of Array.from(masked.matchAll(/\b\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\b|\b\d+(?:[.,]\d{1,2})?\b/g))) {
    const value = parseRomanianAmount(m[0]);
    if (value > 0) out.push({ value, index: m.index!, length: m[0].length });
  }
  return out;
}

const WEEKLY = /\b(saptaman|pe saptamana|weekly)/;
const MONTHLY = /\b(lunar|pe luna|luna)/;

/**
 * Suma care aparține unui cuvânt-cheie. Ancora este cuvântul, nu suma: o fereastră în
 * jurul sumei ar fi prins și „2400” din „2400, cu limita săptămânală 600”, pentru că
 * textul cheie cade în raza ei. Luăm prima sumă de după cuvânt, iar dacă nu există, pe
 * cea imediat dinaintea lui.
 */
const amountNear = (masked: string, amounts: AmountHit[], pattern: RegExp, window = 30) => {
  const anchored = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const match = fold(masked).match(anchored);
  if (!match || typeof match.index !== "number") return undefined;
  const at = match.index;
  const after = amounts.filter((hit) => hit.index >= at && hit.index - at <= window).sort((a, b) => a.index - b.index)[0];
  if (after) return after;
  return amounts.filter((hit) => hit.index < at && at - hit.index <= window).sort((a, b) => b.index - a.index)[0];
};

/* ------------------------------------------------------------ marcatori */

type Marker = { kind: AssistantIntent["kind"]; index: number; length: number };

const MARKERS: Array<[AssistantIntent["kind"], RegExp]> = [
  // Ordinea contează: „următorul salariu” este o dată de plan, nu un venit încasat.
  ["payday", /\b(urmatorul salariu|urmatorul venit|urmatoarea leafa|salariul urmator|data salariului|salariul (vine|intra)|urmatoarea plata a salariului)\b/g],
  ["envelope", /\b(fa-?mi|fa |creeaza|creaza|adauga|vreau|pune)?\s*(un |o )?plic(ul)?\b/g],
  ["recurring", /\b(abonament|chirie|factura|scadenta|rata lunara la)\b/g],
  ["debt", /\b(datorie|datorii|credit|imprumut|mai am de (platit|achitat))\b/g],
  ["goal", /\b(obiectiv|vreau sa strang|sa strang|economisesc pentru|fond de (siguranta|urgenta))\b/g],
  ["income", /\b(am primit|am incasat|mi-?a intrat|venit de|salariu)\b/g],
  ["expense", /\b(am cheltuit|am dat|am platit|am luat|cheltuiala|plata de)\b/g],
];

function findMarkers(folded: string): Marker[] {
  const found: Marker[] = [];
  for (const [kind, pattern] of MARKERS) {
    for (const m of Array.from(folded.matchAll(pattern))) {
      const index = m.index!;
      // Un marcator mai specific, găsit mai devreme, acoperă zona: „următorul salariu” bate „salariu”.
      if (found.some((item) => index >= item.index && index < item.index + item.length)) continue;
      found.push({ kind, index, length: m[0].length });
    }
  }
  const sorted = found.sort((a, b) => a.index - b.index);
  // „am primit 4500 lei salariu” conține doi marcatori de venit. Fără unire, al doilea ar
  // deschide un segment fără sumă, iar primul ar pierde cuvântul care îi dă titlul.
  return sorted.filter((marker, index) => index === 0 || sorted[index - 1].kind !== marker.kind);
}

/* ------------------------------------------------------------ extractoare */

/**
 * Cuvintele de umplutură se compară fără diacritice, pe token: scrise cu jumătate de
 * diacritice („săptămânala”), o listă de tipare fixe le-ar fi ratat.
 */
const STOPWORDS = new Set([
  "lei", "ron", "de", "cu", "si", "in", "pe", "la", "un", "o", "pentru", "limita", "limite",
  "saptamanala", "saptamanal", "saptamana", "lunar", "lunara", "luna", "total", "totalul",
  "suma", "sume", "mi", "imi", "vreau", "sa", "am", "e", "este", "banca", "estimativ", "intre", "data",
]);
const cleanLabel = (raw: string) => raw
  .replace(/\b\d[\d.,\s]*\b/g, " ")
  .replace(/[,.;:!?()\-–]+/g, " ")
  .split(/\s+/)
  .filter((word) => word && !STOPWORDS.has(fold(word)))
  .join(" ")
  .trim();

const titleCase = (raw: string) => raw ? raw.charAt(0).toLocaleUpperCase("ro-RO") + raw.slice(1) : raw;

function parseEnvelope(segment: string, masked: string, amounts: AmountHit[], markerLength: number): AssistantIntent | undefined {
  if (!amounts.length) return undefined;
  const folded = fold(masked);
  const weekly = amountNear(masked, amounts, WEEKLY);
  // Totalul este cea mai mare sumă rămasă după ce scoatem limita săptămânală.
  const rest = amounts.filter((item) => item !== weekly);
  const total = rest.sort((a, b) => b.value - a.value)[0] || weekly;
  if (!total) return undefined;
  const label = titleCase(cleanLabel(segment.slice(markerLength)));
  const category = guessCategoryFromText(label || segment);
  return {
    kind: "envelope",
    label: label || category || "Plic nou",
    amount: total.value,
    category,
    weeklyLimit: weekly && weekly !== total ? weekly.value : undefined,
    // Un plic cu limită săptămânală are ritm săptămânal; altfel contează doar totalul ciclului.
    weeklyPace: Boolean(weekly && weekly !== total) || WEEKLY.test(folded),
  };
}

function parsePayday(dates: DateHit[]): AssistantIntent | undefined {
  // „Următorul salariu luna viitoare între 07/10-10-2026” conține și o aproximare, și o
  // dată scrisă. Data scrisă este cea pe care a ales-o utilizatorul.
  const hit = dates.find((item) => item.explicit) || dates[0];
  if (!hit) return undefined;
  const flex = hit.end ? Math.max(0, Math.min(5, Math.round((new Date(`${hit.end}T12:00:00`).valueOf() - new Date(`${hit.start}T12:00:00`).valueOf()) / 86_400_000))) : 0;
  // Data prudentă este prima din interval; fereastra spune cât poate întârzia.
  return { kind: "payday", date: hit.start, flexDays: flex };
}

function parseExpense(segment: string, amounts: AmountHit[], dates: DateHit[], asOf: string, categories: string[]): AssistantIntent | undefined {
  const amount = amounts[0];
  if (!amount) return undefined;
  const category = guessCategoryFromText(segment, categories) || "Altele";
  const label = cleanLabel(segment.replace(/\b(am cheltuit|am dat|am platit|am luat|cheltuiala|plata de)\b/gi, ""));
  return { kind: "expense", amount: amount.value, category, title: titleCase(label) || category, date: dates[0]?.start || asOf };
}

function parseIncome(segment: string, amounts: AmountHit[], dates: DateHit[], asOf: string): AssistantIntent | undefined {
  const amount = amounts[0];
  if (!amount) return undefined;
  const salary = /salariu|leafa/.test(fold(segment));
  const label = cleanLabel(segment.replace(/\b(am primit|am incasat|mi-?a intrat|venit de)\b/gi, ""));
  return { kind: "income", amount: amount.value, title: salary ? "Salariu" : titleCase(label) || "Venit", date: dates[0]?.start || asOf };
}

function parseDebt(segment: string, masked: string, amounts: AmountHit[]): AssistantIntent | undefined {
  if (!amounts.length) return undefined;
  const monthly = amountNear(masked, amounts, MONTHLY) || amountNear(masked, amounts, /\brata\b/);
  const rest = amounts.filter((item) => item !== monthly);
  const remaining = rest.sort((a, b) => b.value - a.value)[0];
  if (!remaining) return undefined;
  const name = titleCase(cleanLabel(segment.replace(/\b(datorie|datorii|mai am de (platit|achitat)|sold|rata)\b/gi, "")));
  return { kind: "debt", name: name || "Datorie", remaining: remaining.value, monthly: monthly && monthly !== remaining ? monthly.value : undefined };
}

function parseRecurring(segment: string, masked: string, amounts: AmountHit[], dates: DateHit[]): AssistantIntent | undefined {
  const amount = amounts[0];
  if (!amount) return undefined;
  const dayMatch = fold(masked).match(/\b(?:pe|in|din) (?:data (?:de )?)?(\d{1,2})\b/);
  const dueDay = dates[0] ? Number(dates[0].start.slice(8, 10)) : dayMatch ? Math.min(31, Math.max(1, Number(dayMatch[1]))) : 1;
  const name = titleCase(cleanLabel(segment.replace(/\b(abonament(ul)?|scadenta|factura)\b/gi, ""))) || "Plată recurentă";
  return { kind: "recurring", name, amount: amount.value, dueDay, category: guessCategoryFromText(segment) || "Casă & facturi" };
}

function parseGoal(segment: string, masked: string, amounts: AmountHit[], dates: DateHit[]): AssistantIntent | undefined {
  if (!amounts.length) return undefined;
  const current = amountNear(masked, amounts, /\b(am strans|am deja|pana acum)\b/);
  const target = amounts.filter((item) => item !== current).sort((a, b) => b.value - a.value)[0];
  if (!target) return undefined;
  const name = titleCase(cleanLabel(segment.replace(/\b(obiectiv(ul)?|vreau sa strang|sa strang|economisesc pentru|fond de (siguranta|urgenta))\b/gi, "")));
  return { kind: "goal", name: name || "Obiectiv", target: target.value, current: current?.value, dueDate: dates[0]?.start };
}

/* ------------------------------------------------------------------ API */

/**
 * Citește un mesaj și întoarce toate intențiile găsite, în ordinea din text.
 * Un mesaj poate conține mai multe: „fă-mi plic X … Următorul salariu pe …”.
 */
export function parseAssistantMessage(raw: string, options: { asOf?: string; categories?: string[] } = {}): ParsedIntent[] {
  const text = raw.trim();
  if (!text) return [];
  const asOf = options.asOf || isoToday();
  const categories = options.categories || expenseCategories;
  const folded = fold(text);
  const markers = findMarkers(folded);
  if (!markers.length) return [];

  const results: ParsedIntent[] = [];
  markers.forEach((marker, index) => {
    const from = marker.index;
    const to = index + 1 < markers.length ? markers[index + 1].index : text.length;
    const segment = text.slice(from, to).trim();
    if (!segment) return;
    const { hits: dates, masked } = extractDates(segment, asOf);
    const amounts = extractAmounts(masked);
    const intent =
      marker.kind === "envelope" ? parseEnvelope(segment, masked, amounts, marker.length)
      : marker.kind === "payday" ? parsePayday(dates)
      : marker.kind === "expense" ? parseExpense(segment, amounts, dates, asOf, categories)
      : marker.kind === "income" ? parseIncome(segment, amounts, dates, asOf)
      : marker.kind === "debt" ? parseDebt(segment, masked, amounts)
      : marker.kind === "recurring" ? parseRecurring(segment, masked, amounts, dates)
      : marker.kind === "goal" ? parseGoal(segment, masked, amounts, dates)
      : undefined;
    if (intent) results.push({ intent, segment });
  });
  return results;
}
