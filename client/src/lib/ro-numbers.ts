/**
 * Sume spuse cum le spune omul: „cincizeci de lei”, „o sută”, „două sute cincizeci”,
 * „1,5k”, „2 mii”. Ghidul citea doar cifre, așa că „am dat o sută de lei la farmacie”
 * nu era înțeles deloc. Aici textul primește cifrele, iar restul citirii rămâne neschimbat.
 *
 * Prudența contează mai mult decât acoperirea: „de trei ori câte 25” sau „pe 3 luni” nu
 * sunt sume. Un număr mic scris în litere („trei”, „cinci”) devine cifră doar când e urmat
 * de lei/RON; unul compus („douăzeci și cinci”, „o sută”, „două mii”) e mereu o sumă.
 */

const fold = (value: string) => value.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[̀-ͯ]/g, "");

const UNITS: Record<string, number> = {
  zero: 0, unu: 1, una: 1, un: 1, o: 1, doi: 2, doua: 2, trei: 3, patru: 4, cinci: 5, sase: 6, sapte: 7, opt: 8, noua: 9,
};
const TEENS: Record<string, number> = {
  zece: 10, unsprezece: 11, unspe: 11, doisprezece: 12, douasprezece: 12, doispe: 12, treisprezece: 13, treispe: 13,
  paisprezece: 14, paispe: 14, cincisprezece: 15, cinspe: 15, saisprezece: 16, saispe: 16, saptesprezece: 17, saptespe: 17,
  optsprezece: 18, optspe: 18, nouasprezece: 19, nouaspe: 19,
};
const TENS: Record<string, number> = {
  douazeci: 20, treizeci: 30, patruzeci: 40, cincizeci: 50, saizeci: 60, saptezeci: 70, optzeci: 80, nouazeci: 90,
};
const HUNDRED = /^sut[aăe]$|^sute$/;
const THOUSAND = /^mi[ei]$/;

type Token = { word: string; start: number; end: number };

const isNumberWord = (word: string) => word in UNITS || word in TEENS || word in TENS || HUNDRED.test(word) || THOUSAND.test(word) || word === "si";

/** Valoarea unei secvențe de cuvinte-număr; undefined dacă nu formează un număr. */
function valueOf(words: string[]): { value: number; compound: boolean } | undefined {
  let total = 0;
  let current = 0;
  let compound = false;
  let seen = false;
  for (const word of words) {
    if (word === "si") continue;
    if (word in UNITS) { current += UNITS[word]; seen = true; continue; }
    if (word in TEENS) { current += TEENS[word]; seen = true; continue; }
    if (word in TENS) { current += TENS[word]; seen = true; compound = true; continue; }
    if (HUNDRED.test(word)) { current = (current || 1) * 100; seen = true; compound = true; continue; }
    if (THOUSAND.test(word)) { total += (current || 1) * 1000; current = 0; seen = true; compound = true; continue; }
    return undefined;
  }
  if (!seen) return undefined;
  return { value: total + current, compound };
}

/** „1,5k”, „2k”, „2 mii”, „3 mie” → cifre întregi. */
function expandShorthand(text: string): string {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*k\b/gi, (_, n: string) => String(Math.round(Number(n.replace(",", ".")) * 1000)))
    .replace(/(\d+(?:[.,]\d+)?)\s+mi[ei]\b/gi, (_, n: string) => String(Math.round(Number(n.replace(",", ".")) * 1000)));
}

export function spokenAmountsToDigits(text: string): string {
  const shorthand = expandShorthand(text);
  const folded = fold(shorthand);
  const tokens: Token[] = [];
  for (const match of Array.from(folded.matchAll(/[a-z]+/g))) tokens.push({ word: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  const replacements: Array<{ start: number; end: number; value: number }> = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (!isNumberWord(tokens[i].word) || tokens[i].word === "si") continue;
    let j = i;
    // Cuvintele unei sume stau lipite, legate doar de spații sau de „și”.
    while (j + 1 < tokens.length && isNumberWord(tokens[j + 1].word) && /^\s+$/.test(folded.slice(tokens[j].end, tokens[j + 1].start))) j += 1;
    while (j > i && tokens[j].word === "si") j -= 1;
    const words = tokens.slice(i, j + 1).map((item) => item.word);
    const read = valueOf(words);
    const after = folded.slice(tokens[j].end, tokens[j].end + 12);
    const money = /^\s*(de\s+)?(lei|ron|leu)\b/.test(after);
    // „o”/„un” singure sunt articole, nu sume; un număr mic devine sumă doar lângă „lei”.
    const lone = words.length === 1 && (words[0] === "o" || words[0] === "un" || words[0] === "una");
    if (read && !lone && (read.compound || money) && read.value > 0) {
      replacements.push({ start: tokens[i].start, end: tokens[j].end, value: read.value });
    }
    i = j;
  }
  if (!replacements.length) return shorthand;
  let out = "";
  let last = 0;
  for (const item of replacements) {
    out += shorthand.slice(last, item.start) + String(item.value);
    last = item.end;
  }
  return out + shorthand.slice(last);
}
