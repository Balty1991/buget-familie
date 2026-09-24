/**
 * Extrasul, oricum l-a dat banca: CSV, Excel (.xlsx) sau „.xls” care e de fapt o pagină HTML
 * (așa exportă unele internet banking-uri). Totul se citește pe telefon, fără bibliotecă nouă:
 * .xlsx e o arhivă zip cu XML, iar dezarhivarea o face browserul (DecompressionStream).
 */
import { decodeStatement, parseStatementCsv, parseStatementTable, type StatementParse } from "./statement-import";
import { t } from "./i18n";

const u16 = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);
const u32 = (bytes: Uint8Array, at: number) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error(t("Telefonul nu poate deschide fișiere Excel. Exportă extrasul ca CSV."));
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Fișierele dintr-o arhivă zip, după nume (doar cele cerute, ca să nu dezarhivăm imaginile). */
export async function readZipEntries(buffer: ArrayBuffer, wanted: (name: string) => boolean): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buffer);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at -= 1) {
    if (u32(bytes, at) === 0x06054b50) { end = at; break; }
  }
  if (end < 0) throw new Error(t("Fișierul Excel pare deteriorat."));
  const count = u16(bytes, end + 10);
  let at = u32(bytes, end + 16);
  const names = new TextDecoder("utf-8");
  const result: Record<string, string> = {};
  for (let index = 0; index < count && u32(bytes, at) === 0x02014b50; index += 1) {
    const method = u16(bytes, at + 10);
    const size = u32(bytes, at + 20);
    const nameLength = u16(bytes, at + 28);
    const extraLength = u16(bytes, at + 30);
    const commentLength = u16(bytes, at + 32);
    const local = u32(bytes, at + 42);
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (!wanted(name)) continue;
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const raw = bytes.subarray(start, start + size);
    const content = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : undefined;
    if (content) result[name] = new TextDecoder("utf-8").decode(content);
  }
  return result;
}

const unescapeXml = (value: string) => value
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCharCode(Number(dec)))
  .replace(/&amp;/g, "&");

/** Textul unui nod cu bucăți formatate diferit (<r><t>…</t></r>): se lipesc toate <t>-urile. */
const textOf = (xml: string) => (xml.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || []).map((piece) => unescapeXml(piece.replace(/^<t[^>]*>|<\/t>$/g, ""))).join("");

const columnIndex = (ref: string) => {
  const letters = (ref.match(/^[A-Z]+/) || ["A"])[0];
  let index = 0;
  for (let position = 0; position < letters.length; position += 1) index = index * 26 + (letters.charCodeAt(position) - 64);
  return index - 1;
};

/** Formatele de dată: cele încorporate în Excel și cele proprii care au zi/lună/an în cod. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
function dateStyles(stylesXml: string | undefined): boolean[] {
  if (!stylesXml) return [];
  const custom: Record<string, boolean> = {};
  (stylesXml.match(/<numFmt\s[^>]*>/g) || []).forEach((tag) => {
    const id = tag.match(/numFmtId="(\d+)"/)?.[1];
    const code = unescapeXml(tag.match(/formatCode="([^"]*)"/)?.[1] || "").replace(/"[^"]*"|\[[^\]]*\]/g, "");
    if (id) custom[id] = /[dy]/i.test(code) || /m{1,2}[^a-z]*y|d[^a-z]*m/i.test(code);
  });
  const cellXfs = stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] || "";
  return (cellXfs.match(/<xf\s[^>]*?\/?>/g) || []).map((tag) => {
    const id = Number(tag.match(/numFmtId="(\d+)"/)?.[1] || 0);
    return BUILTIN_DATE_FORMATS.has(id) || Boolean(custom[String(id)]);
  });
}

/** Ziua din numărul de serie Excel (1 = 1 ianuarie 1900, cu bug-ul lui 1900 inclus). */
const excelDate = (serial: number) => {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
};

/** Prima foaie a unui .xlsx, ca tabel de texte. Datele ies „zz.ll.aaaa”, sumele cu punct zecimal. */
export async function xlsxRows(buffer: ArrayBuffer): Promise<string[][]> {
  const files = await readZipEntries(buffer, (name) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(name));
  const firstSheetId = files["xl/workbook.xml"]?.match(/<sheet\s[^>]*r:id="([^"]+)"/)?.[1];
  const target = firstSheetId ? files["xl/_rels/workbook.xml.rels"]?.match(new RegExp(`<Relationship[^>]*Id="${firstSheetId}"[^>]*Target="([^"]+)"`))?.[1]
    || files["xl/_rels/workbook.xml.rels"]?.match(new RegExp(`<Relationship[^>]*Target="([^"]+)"[^>]*Id="${firstSheetId}"`))?.[1] : undefined;
  const sheetName = target ? `xl/${target.replace(/^\/?xl\//, "").replace(/^\//, "")}` : Object.keys(files).filter((name) => name.startsWith("xl/worksheets/")).sort()[0];
  const sheet = sheetName ? files[sheetName] : undefined;
  if (!sheet) throw new Error(t("Fișierul Excel nu are nicio foaie de citit."));
  const shared = (files["xl/sharedStrings.xml"]?.match(/<si>[\s\S]*?<\/si>/g) || []).map(textOf);
  const dates = dateStyles(files["xl/styles.xml"]);
  return (sheet.match(/<row[\s>][\s\S]*?<\/row>/g) || []).map((rowXml) => {
    const row: string[] = [];
    (rowXml.match(/<c\s[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).forEach((cellXml, order) => {
      const attributes = cellXml.match(/^<c\s[^>]*/)?.[0] || "";
      const ref = attributes.match(/\br="([A-Z]+)\d*"/)?.[1];
      const type = attributes.match(/\bt="([^"]+)"/)?.[1];
      const style = Number(attributes.match(/\bs="(\d+)"/)?.[1] || 0);
      const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(raw)] || "";
      else if (type === "inlineStr") value = textOf(cellXml);
      else if (type === "str" || type === "e") value = unescapeXml(raw || "");
      else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
      else if (raw !== undefined) {
        const number = Number(raw);
        value = !Number.isFinite(number) ? raw : dates[style] && number > 20_000 && number < 80_000 ? excelDate(number) : String(Math.round(number * 100) / 100);
      }
      row[ref ? columnIndex(ref) : order] = value;
    });
    return Array.from({ length: row.length }, (_value, index) => row[index] || "");
  });
}

/** Tabelul cu cele mai multe rânduri dintr-o pagină HTML (exporturile „.xls” ale unor bănci). */
export function htmlTableRows(html: string): string[][] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const clean = (cell: string) => unescapeXml(cell.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ")).replace(/\s+/g, " ").trim();
  const parsed = tables.map((table) => (table.match(/<tr[\s\S]*?<\/tr>/gi) || []).map((row) => (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(clean)));
  return parsed.sort((a, b) => b.length - a.length)[0] || [];
}

/** Citește extrasul după conținut, nu după extensie: băncile pun „.xls” pe fișiere foarte diferite. */
export async function readStatementFile(buffer: ArrayBuffer): Promise<StatementParse> {
  const head = new Uint8Array(buffer.slice(0, 8));
  if (head[0] === 0x50 && head[1] === 0x4b) return parseStatementTable(await xlsxRows(buffer));
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
    throw new Error(t("Fișierele Excel vechi (.xls) nu se pot citi pe telefon. Din aplicația băncii, alege exportul CSV sau .xlsx."));
  }
  const text = decodeStatement(buffer);
  if (/^\s*(<\?xml|<!doctype html|<html|<table|<meta)/i.test(text.replace(/^\uFEFF/, "")) && /<table/i.test(text)) {
    return parseStatementTable(htmlTableRows(text));
  }
  return parseStatementCsv(text);
}
