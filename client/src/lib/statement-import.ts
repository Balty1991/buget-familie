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
  foldRomanian,
  guessCategoryFromText,
  isKnownTransaction,
  newId,
  type AppData,
  type ReviewDraft,
  type Transaction,
  type TransactionKind,
} from "./finance-data";

export type StatementColumns = { date: number; description: number; amount?: number; debit?: number; credit?: number };
export type StatementRow = { line: number; date: string; description: string; amount: number; kind: TransactionKind };
export type StatementSkip = { line: number; reason: string };
export type StatementParse = {
  rows: StatementRow[];
  skipped: StatementSkip[];
  delimiter: string;
  headers: string[];
  columns: StatementColumns;
};

const DELIMITERS = [";", ",", "\t", "|"];
const MAX_ROWS = 2000;

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
  const cleaned = raw.replace(/[\s ]/g, "").replace(/(RON|LEI|EUR|USD)/gi, "");
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

/** Acceptă zi-lună-an (formatul bancar românesc) și an-lună-zi, cu validarea zilei reale. */
export function parseStatementDate(raw: string): string | undefined {
  const value = raw.trim();
  const iso = value.match(/\b(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/);
  const local = value.match(/\b(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{2,4})\b/);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : local
      ? { year: Number(local[3].length === 2 ? `20${local[3]}` : local[3]), month: Number(local[2]), day: Number(local[1]) }
      : undefined;
  if (!parts) return undefined;
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.year < 2000 || parts.year > 2100) return undefined;
  if (parts.day > new Date(parts.year, parts.month, 0).getDate()) return undefined;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

const HEADER_DATE = /\bdata\b|\bdate\b|\bdata\s*(tranzactiei|procesarii|valutei|operatiunii)\b/;
const HEADER_DESCRIPTION = /descri|detalii|explicat|beneficiar|comerciant|ordonator|narrative|reference|referinta|tranzactie|denumire/;
const HEADER_AMOUNT = /\bsuma\b|\bvaloare\b|\bamount\b/;
const HEADER_DEBIT = /debit|plati|iesiri|retrageri/;
const HEADER_CREDIT = /credit|incasari|intrari|alimentari/;

function findColumns(rows: string[][]): { headerIndex: number; headers: string[]; columns: StatementColumns } | undefined {
  for (let index = 0; index < Math.min(rows.length, 15); index += 1) {
    const row = rows[index];
    if (row.length < 2) continue;
    const folded = row.map((cell) => foldRomanian(cell));
    const date = folded.findIndex((cell) => HEADER_DATE.test(cell));
    if (date < 0) continue;
    const debit = folded.findIndex((cell) => HEADER_DEBIT.test(cell));
    const credit = folded.findIndex((cell) => HEADER_CREDIT.test(cell));
    const amount = folded.findIndex((cell) => HEADER_AMOUNT.test(cell) && !HEADER_DEBIT.test(cell) && !HEADER_CREDIT.test(cell));
    if (amount < 0 && (debit < 0 || credit < 0)) continue;
    const description = folded.findIndex((cell, position) => position !== date && position !== amount && HEADER_DESCRIPTION.test(cell));
    return {
      headerIndex: index,
      headers: row,
      columns: {
        date,
        description: description >= 0 ? description : row.findIndex((_cell, position) => position !== date && position !== amount && position !== debit && position !== credit),
        amount: amount >= 0 ? amount : undefined,
        debit: debit >= 0 ? debit : undefined,
        credit: credit >= 0 ? credit : undefined,
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
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) throw new Error("Fișierul este gol.");
  const delimiter = detectDelimiter(trimmed);
  const all = splitCsv(trimmed, delimiter).filter((row) => row.some((cell) => cell));
  if (all.length < 2) throw new Error("Fișierul nu conține rânduri de citit. Verifică dacă este un export CSV al băncii.");
  const header = findColumns(all);
  const columns = header?.columns || inferColumns(all);
  if (!columns) throw new Error("Nu am recunoscut coloanele de dată și sumă. Deschide fișierul și verifică dacă este extrasul de cont exportat în CSV.");
  const body = all.slice(header ? header.headerIndex + 1 : 0);
  const rows: StatementRow[] = [];
  const skipped: StatementSkip[] = [];
  body.forEach((row, index) => {
    const line = (header ? header.headerIndex + 2 : 1) + index;
    if (rows.length >= MAX_ROWS) return;
    const date = parseStatementDate(row[columns.date] || "");
    if (!date) {
      if (row.some((cell) => cell)) skipped.push({ line, reason: "Dată necitibilă" });
      return;
    }
    const debit = columns.debit !== undefined ? parseStatementAmount(row[columns.debit] || "") : undefined;
    const credit = columns.credit !== undefined ? parseStatementAmount(row[columns.credit] || "") : undefined;
    const single = columns.amount !== undefined ? parseStatementAmount(row[columns.amount] || "") : undefined;
    let amount: number | undefined;
    let kind: TransactionKind = "expense";
    if (debit) { amount = Math.abs(debit); kind = "expense"; }
    else if (credit) { amount = Math.abs(credit); kind = "income"; }
    else if (single !== undefined && single !== 0) { amount = Math.abs(single); kind = single < 0 ? "expense" : "income"; }
    if (!amount) { skipped.push({ line, reason: "Sumă lipsă sau zero" }); return; }
    const description = (row[columns.description] || "").replace(/\s+/g, " ").trim();
    rows.push({ line, date, description: description || "Mișcare din extras", amount: Math.round(amount * 100) / 100, kind });
  });
  return { rows, skipped, delimiter, headers: header?.headers || [], columns };
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
  const categories = [...data.settings.customCategories];
  const now = new Date().toISOString();
  const drafts: ReviewDraft[] = [];
  const staged: Array<Pick<Transaction, "date" | "amount" | "kind" | "sourceId">> = [];
  let duplicates = 0;
  for (const row of rows) {
    const candidate = { date: row.date, amount: row.amount, kind: row.kind, sourceId: source.id };
    const alreadyStaged = staged.some((item) => item.date === candidate.date && item.kind === candidate.kind && Math.abs(item.amount - candidate.amount) < 0.005);
    if (alreadyStaged || isKnownTransaction(data, candidate)) { duplicates += 1; continue; }
    staged.push(candidate);
    const category = row.kind === "income" ? "Venit" : guessCategoryFromText(row.description, categories.length ? [...categories] : undefined) || "Altele";
    const transaction: Transaction = {
      id: newId("import-tx"),
      title: row.description.slice(0, 80),
      amount: row.amount,
      kind: row.kind,
      category,
      sourceId: source.id,
      source: source.name,
      memberId: member.id,
      person: member.name,
      date: row.date,
      note: options.fileName ? `Import din ${options.fileName}, rândul ${row.line}` : `Import de extras, rândul ${row.line}`,
      createdAt: now,
    };
    drafts.push({
      id: newId("review"),
      origin: "import",
      reason: `Rândul ${row.line} din extras · categorie propusă ${category}`,
      createdAt: now,
      transaction,
    });
  }
  return { drafts, duplicates };
}
