/**
 * Import local de extras de cont (CSV). Fișierul este citit în întregime pe telefon;
 * nimic nu pleacă spre un serviciu extern și nicio linie nu devine mișcare fără
 * confirmarea utilizatorului în centrul de revizuire.
 *
 * Băncile românești exportă formate diferite: separator `;` sau `,`, sume cu virgulă
 * zecimală, fie o coloană unică cu semn, fie coloane separate de debit și credit.
 * Detectăm formatul din conținut, nu îl cerem utilizatorului.
 */
import {
  allocationFromText,
  BASE_CURRENCY,
  exchangeRateFor,
  expenseCategories,
  foldRomanian,
  guessAllocationFromText,
  guessCategoryFromText,
  isKnownTransaction,
  matchingAllocationsForExpense,
  matchMerchantRule,
  newId,
  toBaseAmount,
  type AppData,
  type ReviewDraft,
  type Transaction,
  type TransactionKind,
} from "./finance-data";
import { t } from "./i18n";

export type StatementColumns = { date: number; description: number; amount?: number; debit?: number; credit?: number; /** Alte coloane cu text (Raiffeisen: beneficiar + detalii), lipite la descriere. */ details?: number[] };
export type StatementRow = { line: number; date: string; description: string; amount: number; kind: TransactionKind };
export type StatementSkip = { line: number; reason: string };
export type StatementBank = "bcr" | "bt" | "ing" | "raiffeisen" | "revolut" | "generic";

export type StatementParse = {
  rows: StatementRow[];
  skipped: StatementSkip[];
  delimiter: string;
  headers: string[];
  columns: StatementColumns;
  /** Banca recunoscută din antet, pentru mesajul de previzualizare. */
  bank: StatementBank;
};

const DELIMITERS = [";", ",", "\t", "|"];
const MAX_ROWS = 2000;

/**
 * Textul fișierului: UTF-8 dacă e valid, altfel Windows-1250 — codarea în care multe bănci
 * românești încă exportă („ş”, „ţ”). Citit ca UTF-8, „Plată” ar deveni „Plat�”.
 */
export function decodeStatement(buffer: ArrayBuffer): string {
  // „Text Unicode” din Excel și unele bănci: UTF-16 cu marcaj la început (FF FE / FE FF).
  const head = new Uint8Array(buffer.slice(0, 2));
  if (head[0] === 0xff && head[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer);
  if (head[0] === 0xfe && head[1] === 0xff) return new TextDecoder("utf-16be").decode(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder("windows-1250").decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }
}

/** Împarte textul respectând ghilimelele, inclusiv câmpurile care conțin rândul următor. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') { field += char; continue; }
      if (text[index + 1] === '"') { field += '"'; index += 1; continue; }
      quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === delimiter) { row.push(field); field = ""; continue; }
    if (char === "\r") continue;
    if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows.map((entry) => entry.map((value) => value.trim()));
}

/** Separatorul care produce cel mai constant număr de coloane, nu doar cele mai multe. */
function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 20).join("\n");
  let best = { delimiter: ";", score: -1 };
  for (const delimiter of DELIMITERS) {
    const rows = splitCsv(sample, delimiter).filter((row) => row.length > 1);
    if (!rows.length) continue;
    const widths = rows.map((row) => row.length);
    const common = widths.sort((a, b) => widths.filter((value) => value === a).length - widths.filter((value) => value === b).length).at(-1) || 0;
    const consistent = widths.filter((value) => value === common).length;
    const score = consistent * common;
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

/**
 * Sumele apar ca `1.234,56` (românesc) sau `1,234.56` (englezesc). Ultimul separator
 * întâlnit este cel zecimal; cel repetat înaintea lui separă miile.
 */
export function parseStatementAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[\s\u00a0]/g, "").replace(/(RON|LEI|EUR|USD)/gi, "");
  if (!/\d/.test(cleaned)) return undefined;
  const negative = /^-/.test(cleaned) || /-$/.test(cleaned) || /^\(.*\)$/.test(cleaned);
  const digits = cleaned.replace(/[^0-9.,]/g, "");
  if (!digits) return undefined;
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  let normalized = digits;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = digits.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    // O singură virgulă cu exact trei cifre după ea este ambiguă; o tratăm ca separator de mii.
    normalized = digits.length - lastComma - 1 === 3 && digits.split(",").length === 2 && lastComma > 0 && digits.length > 4
      ? digits.replace(",", "")
      : digits.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = digits.split(".");
    normalized = parts.length > 2 || parts[parts.length - 1].length === 3 ? parts.join("") : digits;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return undefined;
  return negative ? -Math.abs(value) : value;
}

/** Lunile scrise în litere, cum le pune ING („02 septembrie 2026”) sau exporturile englezești („2 Sep 2026”). */
const MONTH_NAMES: Array<[RegExp, number]> = [
  [/^ian|^jan/, 1], [/^feb/, 2], [/^mar/, 3], [/^apr/, 4], [/^mai|^may/, 5], [/^iun|^jun/, 6],
  [/^iul|^jul/, 7], [/^aug/, 8], [/^sep/, 9], [/^oct/, 10], [/^noi|^nov/, 11], [/^dec/, 12],
];
const monthFromName = (name: string) => MONTH_NAMES.find(([pattern]) => pattern.test(foldRomanian(name)))?.[1];

/** Acceptă zi-lună-an (formatul bancar românesc), an-lună-zi și luna în litere, cu validarea zilei reale. */
export function parseStatementDate(raw: string): string | undefined {
  const value = raw.trim();
  const iso = value.match(/\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/);
  const local = value.match(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/);
  const named = value.match(/^(\d{1,2})[\s./-]+([a-zăâîșţțş]{3,})\.?[\s./-]+(\d{4})\b/i);
  const namedMonth = named ? monthFromName(named[2]) : undefined;
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : local
      ? { year: Number(local[3].length === 2 ? `20${local[3]}` : local[3]), month: Number(local[2]), day: Number(local[1]) }
      : named && namedMonth
        ? { year: Number(named[3]), month: namedMonth, day: Number(named[1]) }
        : undefined;
  if (!parts) return undefined;
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.year < 2000 || parts.year > 2100) return undefined;
  if (parts.day > new Date(parts.year, parts.month, 0).getDate()) return undefined;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

const HEADER_DATE = /\bdata\b|\bdate\b|\bdata\s*(tranzactiei|procesarii|valutei|operatiunii)\b|completed\s*date|started\s*date|booking\s*date|value\s*date/;
const HEADER_DESCRIPTION = /descri|detalii|explicat|beneficiar|comerciant|ordonator|narrative|reference|referinta|denumire|\bdescription\b|\bmerchant\b|\bnume\b|(?<!data )tranzacti[ei]/;
const HEADER_AMOUNT = /\bsuma\b|\bvaloare\b|\bamount\b/;
const HEADER_DEBIT = /debit|plati|iesiri|retrageri|suma\s*debit/;
/** Coloane cu text care nu descriu mișcarea: conturi, coduri. */
const HEADER_NOT_TEXT = /iban|\bcont\b|\bcod\b|\bcui\b|\bcnp\b|\bswift\b|\bbic\b/;
const HEADER_REFERENCE = /referint|reference|\bref\b/;
const HEADER_CREDIT = /credit|incasari|intrari|alimentari|suma\s*credit/;

/** Preferă „Completed Date” față de „Started Date” pe exporturile Revolut. */
const HEADER_DATE_PREFERRED = /completed\s*date|data\s*(procesarii|valutei)|booking\s*date/;

export const STATEMENT_BANK_LABELS: Record<StatementBank, string> = {
  bcr: "BCR",
  bt: "Banca Transilvania",
  ing: "ING",
  raiffeisen: "Raiffeisen",
  revolut: "Revolut",
  generic: "Extras de cont",
};

/**
 * Recunoaște formatul din antet, fără a cere utilizatorului banca.
 * Heuristici pe coloane tipice din exporturile românești (BCR, BT, ING, Revolut RO).
 */
export function detectStatementBank(headers: string[]): StatementBank {
  const folded = headers.map((cell) => foldRomanian(cell)).join(" | ");
  if (/revolut|completed date|started date|product/.test(folded) && /\bamount\b|\bdescription\b/.test(folded)) return "revolut";
  if (/banca\s*transilvania|\bbt\b/.test(folded)) return "bt";
  if (/\bbcr\b|banca\s*comerciala\s*romana/.test(folded)) return "bcr";
  if (/\bing\b/.test(folded)) return "ing";
  if (/raiffeisen/.test(folded)) return "raiffeisen";
  // Antete tipice fără marca băncii în fișier
  if (/data tranzactiei/.test(folded) && /debit/.test(folded) && /credit/.test(folded) && /data procesarii|data valutei/.test(folded)) return "bcr";
  if (/detalii tranzactie|detalii/.test(folded) && /debit/.test(folded) && /credit/.test(folded) && !/data procesarii/.test(folded)) return "bt";
  if (/data inregistrare/.test(folded) && /suma debit/.test(folded)) return "raiffeisen";
  if (/data valuta\b/.test(folded) && /referinta tranzactiei/.test(folded)) return "bt";
  if (/\bnume\b/.test(folded) && /debit/.test(folded) && /credit/.test(folded)) return "ing";
  return "generic";
}

function findColumns(rows: string[][]): { headerIndex: number; headers: string[]; columns: StatementColumns } | undefined {
  for (let index = 0; index < Math.min(rows.length, 15); index += 1) {
    const row = rows[index];
    if (row.length < 2) continue;
    const folded = row.map((cell) => foldRomanian(cell));
    const preferredDate = folded.findIndex((cell) => HEADER_DATE_PREFERRED.test(cell));
    const date = preferredDate >= 0 ? preferredDate : folded.findIndex((cell) => HEADER_DATE.test(cell));
    if (date < 0) continue;
    const debit = folded.findIndex((cell) => HEADER_DEBIT.test(cell));
    const credit = folded.findIndex((cell) => HEADER_CREDIT.test(cell));
    const amount = folded.findIndex((cell) => HEADER_AMOUNT.test(cell) && !HEADER_DEBIT.test(cell) && !HEADER_CREDIT.test(cell));
    if (amount < 0 && (debit < 0 || credit < 0)) continue;
    const texts = folded
      .map((cell, position) => ({ cell, position }))
      .filter(({ cell, position }) => ![date, amount, debit, credit].includes(position) && HEADER_DESCRIPTION.test(cell) && !HEADER_NOT_TEXT.test(cell))
      // Referința e ultima variantă: e bună doar când nu există altă descriere.
      .sort((left, right) => Number(HEADER_REFERENCE.test(left.cell)) - Number(HEADER_REFERENCE.test(right.cell)))
      .map(({ position }) => position);
    const description = texts[0] ?? -1;
    const details = texts.slice(1).filter((position) => !HEADER_REFERENCE.test(folded[position]));
    return {
      headerIndex: index,
      headers: row,
      columns: {
        date,
        description: description >= 0 ? description : row.findIndex((_cell, position) => position !== date && position !== amount && position !== debit && position !== credit),
        amount: amount >= 0 ? amount : undefined,
        debit: debit >= 0 ? debit : undefined,
        credit: credit >= 0 ? credit : undefined,
        details: details.length ? details : undefined,
      },
    };
  }
  return undefined;
}

/** Fără antet recunoscut, deducem coloanele din conținut: prima coloană cu date, ultima cu sume. */
function inferColumns(rows: string[][]): StatementColumns | undefined {
  const body = rows.filter((row) => row.length >= 2).slice(0, 40);
  if (!body.length) return undefined;
  const width = Math.max(...body.map((row) => row.length));
  const dateScore: number[] = [];
  const amountScore: number[] = [];
  for (let column = 0; column < width; column += 1) {
    const cells = body.map((row) => row[column] || "");
    dateScore[column] = cells.filter((cell) => parseStatementDate(cell)).length;
    amountScore[column] = cells.filter((cell) => cell && !parseStatementDate(cell) && parseStatementAmount(cell) !== undefined).length;
  }
  const date = dateScore.indexOf(Math.max(...dateScore));
  const amount = amountScore.lastIndexOf(Math.max(...amountScore));
  if (dateScore[date] < body.length / 2 || amountScore[amount] < body.length / 2) return undefined;
  const description = Array.from({ length: width }, (_value, column) => column)
    .filter((column) => column !== date && column !== amount)
    .sort((left, right) => body.reduce((sum, row) => sum + (row[right] || "").length, 0) - body.reduce((sum, row) => sum + (row[left] || "").length, 0))[0];
  return { date, description: description ?? 0, amount };
}

export function parseStatementCsv(text: string): StatementParse {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) throw new Error(t("Fișierul este gol."));
  const delimiter = detectDelimiter(trimmed);
  return parseStatementTable(splitCsv(trimmed, delimiter), delimiter);
}

/** Același cititor pentru CSV, Excel și tabelele HTML: primește rândurile deja despărțite în celule. */
export function parseStatementTable(table: string[][], delimiter = ""): StatementParse {
  // Rândurile goale rămân: „rândul 5” trebuie să fie rândul 5 și în Excel, nu al cincilea plin.
  // Windows-1250 aduce „ş/ţ” cu sedilă; în română corecte sunt „ș/ț” cu virgulă.
  const all = table.map((row) => row.map((cell) => (cell || "").replace(/\s+/g, " ").trim().replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/Ş/g, "Ș").replace(/Ţ/g, "Ț")));
  if (all.filter((row) => row.some((cell) => cell)).length < 2) throw new Error(t("Fișierul nu conține rânduri de citit. Verifică dacă este un export CSV al băncii."));
  const header = findColumns(all);
  const columns = header?.columns || inferColumns(all);
  if (!columns) throw new Error(t("Nu am recunoscut coloanele de dată și sumă. Deschide fișierul și verifică dacă este extrasul de cont exportat în CSV."));
  const body = all.slice(header ? header.headerIndex + 1 : 0);
  const headers = header?.headers || [];
  const rows: StatementRow[] = [];
  const skipped: StatementSkip[] = [];
  let open: StatementRow | undefined;
  const stateIndex = headers.findIndex((cell) => /\bstate\b|\bstare\b|\bstatus\b/.test(foldRomanian(cell)));
  body.forEach((row, index) => {
    const line = (header ? header.headerIndex + 2 : 1) + index;
    if (rows.length >= MAX_ROWS) return;
    if (stateIndex >= 0) {
      const state = foldRomanian(row[stateIndex] || "");
      if (state && !/complet|completed|booked|posted|finalizat|reusit|success/.test(state) && /reverted|failed|pending|anulat|respins|declined/.test(state)) {
        skipped.push({ line, reason: t("Stare nefinalizată") });
        open = undefined;
        return;
      }
    }
    const date = parseStatementDate(row[columns.date] || "");
    if (!date) {
      // ING pune detaliile pe rândurile de sub mișcare, fără dată și fără sumă („Terminal: LIDL …”).
      const hasAmount = [columns.amount, columns.debit, columns.credit].some((column) => column !== undefined && parseStatementAmount(row[column] || "") !== undefined);
      const text = row.filter((cell) => cell).join(" ").replace(/\s+/g, " ").trim();
      if (open && !hasAmount && text) {
        if (!open.description.includes(text)) open.description = `${open.description}; ${text}`.slice(0, 400);
        return;
      }
      open = undefined;
      if (text) skipped.push({ line, reason: t("Dată necitibilă") });
      return;
    }
    open = undefined;
    const debit = columns.debit !== undefined ? parseStatementAmount(row[columns.debit] || "") : undefined;
    const credit = columns.credit !== undefined ? parseStatementAmount(row[columns.credit] || "") : undefined;
    const single = columns.amount !== undefined ? parseStatementAmount(row[columns.amount] || "") : undefined;
    let amount: number | undefined;
    let kind: TransactionKind = "expense";
    if (debit) { amount = Math.abs(debit); kind = "expense"; }
    else if (credit) { amount = Math.abs(credit); kind = "income"; }
    else if (single !== undefined && single !== 0) { amount = Math.abs(single); kind = single < 0 ? "expense" : "income"; }
    if (!amount) { skipped.push({ line, reason: t("Sumă lipsă sau zero") }); return; }
    const description = [columns.description, ...(columns.details || [])]
      .map((column) => (row[column] || "").replace(/\s+/g, " ").trim())
      .filter((text, position, all) => text && all.indexOf(text) === position)
      .join("; ");
    open = { line, date, description: description || t("Mișcare din extras"), amount: Math.round(amount * 100) / 100, kind };
    rows.push(open);
  });
  return { rows, skipped, delimiter, headers, columns, bank: detectStatementBank(headers) };
}

/** Orașele care apar la coada descrierilor POS („LIDL 0123 BUCURESTI RO”). */
const CITY_TAIL = /\s+(bucuresti|bucharest|cluj[- ]?napoca|cluj|iasi|timisoara|constanta|brasov|craiova|galati|ploiesti|oradea|sibiu|arad|pitesti|bacau|suceava|baia mare|buzau|botosani|satu mare|ramnicu valcea|drobeta[- ]turnu severin|piatra neamt|targu mures|targu jiu|focsani|bistrita|tulcea|resita|slatina|calarasi|alba iulia|giurgiu|deva|hunedoara|zalau|sfantu gheorghe|slobozia|alexandria|voluntari|otopeni|popesti[- ]leordeni|chiajna|bragadiru|pantelimon|dublin|london|vilnius|amsterdam|luxembourg|sector\s*\d)$/i;

/** Bucăți care descriu felul plății sau banca, nu comerciantul. */
const MERCHANT_NOISE: RegExp[] = [
  /\b(plata|plată|cumparare|cumpărare|tranzactie|tranzacție|achizitie|achiziție|retragere(\s+numerar)?|incasare|încasare)\b(\s+(la|cu|prin|de))?(\s+(pos|comerciant|online|e-?commerce|internet|card|atm))*/gi,
  /\bnon[- ]?bt\b/gi,
  /\b(cu\s+)?card(ul)?\b(\s+(visa|mastercard|maestro|debit|credit|virtual|business))*/gi,
  /\b(visa|mastercard|maestro|contactless|e-?pos|pos|apple pay|google pay|gpay)\b/gi,
  /\b(tid|mid|rrn|autorizare|auth(orization)?|ref(erinta|erință|erence)?|nr\.?\s*card|id tranzactie|cod)\s*[:.#]\s*\S+/gi,
  /\bdata\s*[:.]\s*\S+(\s+\d{1,2}:\d{2}(:\d{2})?)?/gi,
  /\bvaloare\s+tranzac\w*\s*:?\s*[\d.,]+\s*[a-z]{0,3}/gi,
  /\b(suma|sold|comision)\b.*$/gi,
  /[\d.,]+\s*(ron|lei|eur|usd|gbp)\b/gi,
  /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}(:\d{2})?\b/g,
  /\b[\dx*]{4,}\d{2,}\b|\*{2,}\d+|\b[x*]{4,}\d*/gi,
  /\b(s\.?r\.?l\.?|s\.?a\.?|s\.?c\.?s\.?|romania|românia|discount|ifn)(?=\s|$|[;,.])/gi,
  /\b(op|ordin de plat[aă])(\s+(inter|intra)(bancar)?)?\b|\bcanal electronic\b/gi,
  /(^|\s)(ro|rou|rom|lu|ie|gb|nl|us|de|fr|it|es|mt|cy|ee|lt|se|irl|gbr|nld|usa)$/i,
];

const LOWER = /[a-zăâîșțşţáéíóúäöüß]/;
const titleCase = (value: string) => value.replace(/[A-Za-zĂÂÎȘȚŞŢăâîșțşţÁÉÍÓÚÄÖÜáéíóúäöüß\d'’&.-]+/g, (word) => {
  if (LOWER.test(word)) return word;
  if (word.length <= 3 && /^[A-ZĂÂÎȘȚŞŢ]+$/.test(word) && !/^(LA|DE|SI|ȘI|CU|IN|ÎN|THE|AND|TO)$/.test(word)) return word;
  return word.charAt(0) + word.slice(1).toLocaleLowerCase("ro-RO");
});

function cleanMerchantSegment(segment: string): string {
  let text = segment.replace(/^(paypal|pp|sumup|sum up|zettle|stripe|izettle)\s*\*\s*/i, "");
  for (const pattern of MERCHANT_NOISE) text = text.replace(pattern, " ");
  // Numărul magazinului („LIDL 0123”, „KAUFLAND 5920”) nu face parte din nume.
  text = text.replace(/(^|\s)[a-z]?\d{2,}[a-z]?(?=\s|$)/gi, " ").replace(/[*#_]+/g, " ").replace(/\s+/g, " ").trim();
  for (let guard = 0; guard < 2 && CITY_TAIL.test(text); guard += 1) text = text.replace(CITY_TAIL, "").trim();
  return text.replace(/^[\s,.;:/|-]+|[\s,.;:/|-]+$/g, "").trim();
}

/**
 * Numele comerciantului dintr-o descriere de extras. Băncile pun înaintea lui felul plății, cardul,
 * terminalul, orașul și coduri („Plata la POS non-BT cu card VISA; LIDL DISCOUNT 0123 BUCURESTI RO;
 * RRN: …” → „Lidl”). Dacă nu rămâne nimic sigur, întoarce descrierea așa cum era.
 */
export function statementMerchant(description: string): string {
  const raw = description.replace(/\s+/g, " ").trim();
  if (!raw) return raw;
  if (/retragere\s+numerar|\batm\b/i.test(raw)) return t("Retragere numerar");
  const terminal = raw.match(/\bterminal\s*:\s*([^;]+?)(?=\s+(data|autorizare|nr\.?\s*card)\b|;|$)/i)?.[1];
  const segments = [terminal, ...raw.split(/[;|]|,\s+|\s+-\s+|\s{2,}/)].filter((item): item is string => Boolean(item));
  for (const segment of segments) {
    const cleaned = cleanMerchantSegment(segment);
    if (/[A-Za-zĂÂÎȘȚŞŢăâîșțşţ]{2,}/.test(cleaned) && !/^(op|transfer|ordin de plata|canal electronic|instant|intrabancar|interbancar)$/i.test(foldRomanian(cleaned))) {
      const title = titleCase(cleaned).slice(0, 60);
      return title.charAt(0).toLocaleUpperCase("ro-RO") + title.slice(1);
    }
  }
  return raw.slice(0, 80);
}

/** Cheia după care recunoaștem același comerciant: primul cuvânt al numelui, fără diacritice. */
export const merchantKey = (title: string) => foldRomanian(title).replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).find((word) => word.length >= 3 && !/^\d+$/.test(word)) || "";

type Learned = { category: string; allocationId?: string; count: number };

/**
 * Ce a ales familia înainte la același comerciant: categoria cea mai des folosită și plicul
 * ultimei cheltuieli (dacă mai există în plan). Mișcările confirmate din importuri trecute contează
 * la fel, deci o categorie corectată o dată se propune de acum încolo.
 */
export function learnedMerchantCategories(data: AppData): Map<string, Learned> {
  const tally = new Map<string, { counts: Map<string, number>; allocationId?: string; lastDate: string }>();
  const allocations = new Set(data.settings.salaryPlan.allocations.map((item) => item.id));
  for (const item of data.transactions) {
    if (item.kind !== "expense" || !item.category || item.category === "Altele") continue;
    const key = merchantKey(item.title || "");
    if (!key) continue;
    const entry = tally.get(key) || { counts: new Map<string, number>(), lastDate: "" };
    entry.counts.set(item.category, (entry.counts.get(item.category) || 0) + 1);
    if ((item.date || "") >= entry.lastDate) {
      entry.lastDate = item.date || "";
      entry.allocationId = item.allocationId && allocations.has(item.allocationId) ? item.allocationId : undefined;
    }
    tally.set(key, entry);
  }
  const learned = new Map<string, Learned>();
  tally.forEach((entry, key) => {
    const [category, count] = Array.from(entry.counts.entries()).sort((left, right) => right[1] - left[1])[0];
    learned.set(key, { category, allocationId: entry.allocationId, count });
  });
  return learned;
}

/**
 * Transformă rândurile citite în propuneri de verificat. Rândurile care există deja
 * în registru sau în coada de revizuire sunt numărate, nu propuse: un extras descărcat
 * de două ori pentru perioade suprapuse nu trebuie să dubleze nimic.
 */
export function statementDrafts(
  data: AppData,
  rows: StatementRow[],
  options: { sourceId: string; memberId: string; fileName?: string },
): { drafts: ReviewDraft[]; duplicates: number } {
  const source = data.settings.paymentSources.find((item) => item.id === options.sourceId);
  const member = data.settings.members.find((item) => item.id === options.memberId);
  if (!source || !member) return { drafts: [], duplicates: 0 };
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const now = new Date().toISOString();
  // Un extras al unui cont valutar are sumele în acea valută; registrul le păstrează în lei.
  const foreign = source.currency && source.currency !== BASE_CURRENCY ? source.currency : undefined;
  const rate = exchangeRateFor(data, foreign);
  if (foreign && !rate) return { drafts: [], duplicates: 0 };
  const learned = learnedMerchantCategories(data);
  const drafts: ReviewDraft[] = [];
  const staged: Array<Pick<Transaction, "date" | "amount" | "kind" | "sourceId">> = [];
  let duplicates = 0;
  for (const row of rows) {
    const base = foreign ? toBaseAmount(row.amount, rate) : row.amount;
    if (!base) continue;
    const candidate = { date: row.date, amount: base, kind: row.kind, sourceId: source.id };
    const alreadyStaged = staged.some((item) => item.date === candidate.date && item.kind === candidate.kind && Math.abs(item.amount - candidate.amount) < 0.005);
    if (alreadyStaged || isKnownTransaction(data, candidate)) { duplicates += 1; continue; }
    staged.push(candidate);
    const merchant = statementMerchant(row.description);
    const rules = data.settings.merchantRules || [];
    const rule = matchMerchantRule(`${merchant} ${row.description}`, rules);
    // Ordinea: regula scrisă de om, apoi ce a ales familia la același comerciant, apoi indiciile generale.
    const habit = row.kind === "expense" && !rule?.category ? learned.get(merchantKey(merchant)) : undefined;
    const habitCategory = habit && categories.includes(habit.category) ? habit.category : undefined;
    const category = row.kind === "income"
      ? "Venit"
      : habitCategory || guessCategoryFromText(`${merchant} ${row.description}`, categories, rules) || "Altele";
    // Plicul spus de text („Enel” → Lumină) aduce și categoria lui, dacă regula n-a spus alta.
    const textEnvelope = row.kind === "expense" && !rule?.category ? allocationFromText(data, `${merchant} ${row.description}`, { memberId: member.id, sourceId: source.id }) : undefined;
    const finalCategory = textEnvelope?.category && categories.includes(textEnvelope.category) ? textEnvelope.category : category;
    const allocationId = row.kind === "expense"
      ? (textEnvelope?.id || guessAllocationFromText(data, `${merchant} ${row.description}`)
        || (habitCategory ? habit?.allocationId : undefined)
        || matchingAllocationsForExpense(data, { category: finalCategory, memberId: member.id, sourceId: source.id })[0]?.id
        || "outside")
      : undefined;
    const transaction: Transaction = {
      id: newId("import-tx"),
      title: merchant,
      amount: base,
      originalAmount: foreign ? row.amount : undefined,
      originalCurrency: foreign,
      exchangeRate: foreign ? rate : undefined,
      kind: row.kind,
      category: finalCategory,
      sourceId: source.id,
      source: source.name,
      memberId: member.id,
      person: member.name,
      date: row.date,
      // Descrierea băncii rămâne în notiță: titlul e doar numele, dar nimic din extras nu se pierde.
      note: `${options.fileName ? `Import din ${options.fileName}, rândul ${row.line}` : `Import de extras, rândul ${row.line}`}${merchant !== row.description ? ` · ${row.description.slice(0, 240)}` : ""}`,
      shareScope: "shared",
      allocationId,
      createdAt: now,
    };
    drafts.push({
      id: newId("review"),
      origin: "import",
      reason: habitCategory
        ? t("Rândul {line} din extras · {category}, ca data trecută la {merchant}", { line: row.line, category: t(finalCategory), merchant })
        : t("Rândul {line} din extras · categorie propusă {category}", { line: row.line, category: t(finalCategory) }),
      createdAt: now,
      transaction,
    });
  }
  return { drafts, duplicates };
}
