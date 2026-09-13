/**
 * Bonuri mobile: procesare și interpretare locală înainte de persistență.
 * Fotografiile și textul OCR nu sunt trimise către un serviciu financiar extern.
 */
const MAX_ORIGINAL_BYTES = 25_000_000;
const TARGET_COMPRESSED_BYTES = 600_000;
const MAX_EDGE = 1600;
const moneyPattern = /-?\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{2})|-?\d+[,.]\d{2}/g;
const receiptTotalPattern = /-?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.]\d{1,2})?/g;
const footerLinePattern = /\b(subtotal|numerar|rest(?:\s*lei)?|tva|cash|card|visa|mastercard|bon\s*fiscal|operator|casa|aprob|cif|cui|nr\.?\s*tranzact|puncte|economisit|id\s*unic|extra\s*plu|^plu:|cod\s*identificare|total\s*tva|totaltva)\b/i;
const totalLinePattern = /\b(total\s*lei|suma(?:\s*de)?\s*plata|de\s*plata|amount\s*paid|total)\b/i;
const discountLinePattern = /\b(reducere|rabat|discount|promo)\b/i;
const legalVendorPattern = /\b(s\.?\s*r\.?\s*l\.?|s\.?\s*a\.?|pfa|cif|cui|romania|com\.|centru|parter|str\.|nr\.|tel|jud\.|operator|fashion|consulting|retail)\b/i;
const qtyOnlyPattern = /^\s*\d+(?:[.,]\d+)?\s*(?:buc(?:ati)?|pet|kg|g|l|ml)?\s*[@x×*]\s*/i;
const vatRowPattern = /^(?:\d{1,2}\s*%|tva\s*[abe]\b|total\s*tva|totaltva)/i;
const taxLetter = /\s+[abe]\s*$/i;
const HEIC_PATTERN = /heic|heif/i;
const IMAGE_NAME_PATTERN = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

const readBlobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Imaginea nu a putut fi citită.")); reader.readAsDataURL(blob);
});
const loadImage = (file: Blob) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Fișierul nu pare a fi o imagine validă.")); }; image.src = url;
});
const loadDataUrlImage = (dataUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Imaginea nu a putut fi pregătită pentru citire."));
  image.src = dataUrl;
});
const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Nu s-a putut comprima imaginea.")), "image/jpeg", quality));

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Camera Android trimite adesea type gol sau octet-stream; nu respingem până nu eșuează decodarea. */
export function isReceiptImageFile(file: File) {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  if (!type || type === "application/octet-stream") return true;
  if (IMAGE_NAME_PATTERN.test(file.name)) return true;
  return false;
}

async function decodeReceiptImage(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => {
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
        },
      };
    } catch {
      /* cad pe Image() */
    }
  }
  try {
    const image = await loadImage(file);
    return {
      width: image.width,
      height: image.height,
      draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => ctx.drawImage(image, 0, 0, width, height),
    };
  } catch (reason) {
    if (HEIC_PATTERN.test(`${file.type} ${file.name}`)) {
      throw new Error("Poza e în format HEIC. Alege JPEG din galerie sau fotografiază din nou din aplicație.");
    }
    throw reason instanceof Error ? reason : new Error("Fișierul nu pare a fi o imagine validă.");
  }
}

export async function compressReceiptImage(file: File) {
  if (!isReceiptImageFile(file)) throw new Error("Alege o fotografie a bonului, nu alt tip de fișier.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("O poză poate avea cel mult 25 MB. Alege din galerie sau fotografiază mai aproape.");
  const image = await decodeReceiptImage(file);
  const ratio = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browserul nu poate procesa fotografia.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  image.draw(context, canvas.width, canvas.height);
  let blob = await canvasBlob(canvas, 0.84);
  for (const quality of [0.76, 0.68, 0.6, 0.52]) {
    if (blob.size <= TARGET_COMPRESSED_BYTES) break;
    blob = await canvasBlob(canvas, quality);
  }
  return readBlobAsDataUrl(blob);
}

export type ReceiptDetectedItem = { label: string; amount: number; category: string; raw: string };
export type LocalReceiptOcr = { text: string; vendor?: string; amount?: number; date?: string; items: ReceiptDetectedItem[] };

const parseAmount = (raw: string) => {
  const normalized = raw.replace(/[\s\u00A0]/g, "").replace(/lei|ron|eur|usd/gi, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};

const parseSignedAmount = (raw: string) => {
  const trimmed = raw.trim();
  const negative = /^-/.test(trimmed) || /-$/.test(trimmed) || /^\(.*\)$/.test(trimmed);
  const amount = parseAmount(trimmed.replace(/^[-+(]+|[) ]+$/g, ""));
  if (amount === undefined) return undefined;
  return negative ? -amount : amount;
};

const suggestedCategory = (label: string) => {
  const value = label.toLocaleLowerCase("ro-RO");
  if (/(jucarie|jucării|scutec|bibero)/.test(value)) return "Consumabile copil";
  if (/(ciorap|tenis|hain|pantal|chilot|rochie|bluza|geaca|tricou|incalt|punga|hanorac)/.test(value)) return "Timp liber";
  if (/(apa|suc|cola|bere|vin|cafea|ceai|bautur)/.test(value)) return "Băuturi";
  if (/(ciocol|kinder|biscuit|bombo|dulce|napolitan|prajitur|cookie|pie)/.test(value)) return "Dulciuri";
  if (/(deterg|sapun|igien|servetel|hartie|burete|solutie|sac menaj|sacosa|lipici)/.test(value)) return "Casă & facturi";
  if (/(taxi|uber|bolt|benz|motorin|parcar|transport)/.test(value)) return "Transport";
  if (/(farmac|medic|vitamin|pastil)/.test(value)) return "Sănătate";
  if (/(paine|lapte|iaurt|branza|oua|carne|mezel|fruct|legum|orez|paste|faina|malai|ulei|zahar|aliment|cereale)/.test(value)) return "Alimente";
  return "Alimente";
};

const lastMoney = (line: string) => {
  const cleaned = line.replace(taxLetter, "");
  const matches = Array.from(cleaned.matchAll(moneyPattern));
  const last = [...matches].reverse().find((match) => {
    if (typeof match.index !== "number") return false;
    const after = cleaned.slice(match.index + match[0].length);
    if (/^\s*%/.test(after)) return false;
    if (/^\s*(?:l|ml|cl|g|kg|gr)\b/i.test(after)) return false;
    return true;
  });
  if (!last || typeof last.index !== "number") return undefined;
  return { raw: last[0], index: last.index, signed: parseSignedAmount(last[0]), amount: parseAmount(last[0]) };
};

const stripPercentages = (line: string) => line.replace(/\d+[.,]\d+\s*%/g, " ");

const cleanProductLabel = (line: string, priceIndex: number) => {
  let label = line.slice(0, priceIndex);
  label = label.replace(/^\s*[A-Z0-9]{2,}(?:-[A-Z0-9]{2,}){1,5}\s+/i, "");
  label = label.replace(/^\s*\d{6,}\s+/, "");
  label = label.replace(moneyPattern, " ");
  label = label.replace(/\b\d+(?:[,.]\d+)?\s*(?:buc(?:ati)?|pet|kg|g|l|ml)\b/gi, " ");
  label = label.replace(/\b\d+(?:[,.]\d+)?\s*[@xX×]\b/g, " ");
  label = label.replace(/\b[xX×@]\b/g, " ");
  label = label.replace(/[=*]+/g, " ");
  label = label.replace(/^\s*[#*._\-\d]+\s*/, "");
  return label.replace(/\s{2,}/g, " ").trim();
};

const titleVendor = (raw: string) => {
  const cleaned = raw.replace(/[:_|]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  return cleaned.charAt(0).toLocaleUpperCase("ro-RO") + cleaned.slice(1).toLocaleLowerCase("ro-RO");
};

/**
 * Antetul unui bon românesc are de obicei mai multe rânduri scurte (denumire legală,
 * stradă, oraș), iar euristica generală alegea primul rând fără cifre — adesea greșit.
 * Lanțurile cunoscute sunt verificate întâi, pentru că numele lor apare aproape mereu
 * în antet și este ceea ce recunoaște utilizatorul.
 */
const knownVendors: Array<[RegExp, string]> = [
  [/\blidl\b/i, "Lidl"],
  [/\bkaufland\b/i, "Kaufland"],
  [/\bcarrefour\b/i, "Carrefour"],
  [/\bmega\s*image\b/i, "Mega Image"],
  [/\bprofi\b/i, "Profi"],
  [/\bauchan\b/i, "Auchan"],
  [/\bpenny\b/i, "Penny"],
  [/\bselgros\b/i, "Selgros"],
  [/\bmetro\b/i, "Metro"],
  [/\bcora\b/i, "Cora"],
  [/\bla\s*doi\s*pasi\b/i, "La Doi Pași"],
  [/\bannabella\b/i, "Annabella"],
  [/\bdedeman\b/i, "Dedeman"],
  [/\bhornbach\b/i, "Hornbach"],
  [/\bleroy\s*merlin\b/i, "Leroy Merlin"],
  [/\bbricostore|\bbrico\s*depot\b/i, "Brico Dépôt"],
  [/\bjysk\b/i, "JYSK"],
  [/\bpepco\b/i, "Pepco"],
  [/\bsinsay\b/i, "Sinsay"],
  [/\bfamiliaro\b|\bfamilia\s*ro\b/i, "Familiiaro"],
  [/\bdm\s+drogerie|\bdrogerie\s*markt\b/i, "dm drogerie markt"],
  [/\brossmann\b/i, "Rossmann"],
  [/\baltex\b/i, "Altex"],
  [/\bflanco\b/i, "Flanco"],
  [/\bemag\b/i, "eMAG"],
  [/\bdecathlon\b/i, "Decathlon"],
  [/\bcatena\b/i, "Catena"],
  [/\bdona\b/i, "Farmacia Dona"],
  [/\bhelp\s*net\b/i, "HelpNet"],
  [/\btezyo\b/i, "Tezyo"],
  [/\bmol\b/i, "MOL"],
  [/\bomv\b/i, "OMV"],
  [/\bpetrom\b/i, "Petrom"],
  [/\brompetrol\b/i, "Rompetrol"],
];

function inferVendor(lines: string[]) {
  const blob = lines.join(" ");
  for (const [pattern, name] of knownVendors) {
    if (pattern.test(blob)) return name;
  }
  const head = lines.slice(0, 12).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length >= 3);
  for (const line of head) {
    const magazin = line.match(/\bmagazin\s+([A-ZĂÂÎȘȚa-zăâîșț]{3,})\b/i);
    if (magazin?.[1] && !legalVendorPattern.test(magazin[1])) return titleVendor(magazin[1]);
  }
  for (const line of head) {
    if (legalVendorPattern.test(line)) continue;
    if (lastMoney(line)) continue;
    if (/\d{3,}/.test(line)) continue;
    if (!/[a-zA-ZăâîșțĂÂÎȘȚ]{3,}/.test(line)) continue;
    const words = line.split(" ").filter(Boolean);
    if (words.length > 4) continue;
    if (line.length > 28) continue;
    return titleVendor(line);
  }
  return undefined;
}

const MONTHS: Array<[RegExp, number]> = [
  [/\b(ian(?:uarie)?|jan(?:uary)?)\b/i, 1],
  [/\b(feb(?:ruary|ruarie)?)\b/i, 2],
  [/\b(mar(?:tie|ch)?)\b/i, 3],
  [/\b(apr(?:il(?:ie)?)?)\b/i, 4],
  [/\b(mai|may)\b/i, 5],
  [/\b(iun(?:ie)?|jun(?:e)?)\b/i, 6],
  [/\b(iul(?:ie)?|jul(?:y)?)\b/i, 7],
  [/\b(aug(?:ust)?)\b/i, 8],
  [/\b(sep(?:t(?:ember|embrie)?)?)\b/i, 9],
  [/\b(oct(?:ombrie|ober)?)\b/i, 10],
  [/\b(noi(?:embrie)?|nov(?:ember)?)\b/i, 11],
  [/\b(dec(?:embrie|ember)?)\b/i, 12],
];

function civilDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || year < 2000 || year > 2100) return undefined;
  if (day > new Date(year, month, 0).getDate()) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Bonurile românești scriu ziua prima. Verificăm că ziua chiar există în luna citită, altfel data este ignorată. */
function inferDate(text: string) {
  for (const match of Array.from(text.matchAll(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/g))) {
    const found = civilDate(Number(match[3].length === 2 ? `20${match[3]}` : match[3]), Number(match[2]), Number(match[1]));
    if (found) return found;
  }
  for (const match of Array.from(text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))) {
    const found = civilDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (found) return found;
  }
  for (const [pattern, month] of MONTHS) {
    const monthFirst = new RegExp(`${pattern.source}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,\\s]+(\\d{4})`, "i");
    const monthHit = text.match(monthFirst);
    if (monthHit) {
      const found = civilDate(Number(monthHit[monthHit.length - 1]), month, Number(monthHit[monthHit.length - 2]));
      if (found) return found;
    }
    const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+${pattern.source}\\.?[,\\s]+(\\d{4})`, "i");
    const dayHit = text.match(dayFirst);
    if (dayHit) {
      const found = civilDate(Number(dayHit[dayHit.length - 1]), month, Number(dayHit[1]));
      if (found) return found;
    }
  }
  return undefined;
}

function inferTotal(lines: string[]) {
  const ranked: Array<{ amount: number; rank: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\s+/g, " ").trim();
    if (!totalLinePattern.test(line)) continue;
    if (/\b(economisit|puncte|tva|totaltva|numerar|rest|cash)\b/i.test(line)) continue;
    const inline = Array.from(line.matchAll(receiptTotalPattern)).map((match) => parseAmount(match[0])).filter((value): value is number => Boolean(value));
    let amount = inline.at(-1);
    if (!amount) {
      const next = (lines[index + 1] || "").replace(/\s+/g, " ").trim();
      if (next && !totalLinePattern.test(next) && !footerLinePattern.test(next) && !/[a-zA-ZăâîșțĂÂÎȘȚ]{4,}/.test(next.replace(taxLetter, ""))) {
        amount = lastMoney(next)?.amount;
      }
    }
    if (!amount) continue;
    const rank = /\btotal\s*lei\b/i.test(line) ? 4 : /\bsuma|\bde\s*plata|\bamount\s*paid\b/i.test(line) ? 3 : 2;
    ranked.push({ amount, rank });
  }
  ranked.sort((a, b) => b.rank - a.rank || b.amount - a.amount);
  return ranked[0]?.amount;
}

function parseQtyUnit(line: string) {
  const cleaned = line.replace(taxLetter, "");
  const withEq = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:buc(?:ati)?|pet|kg|g|l|ml)?\s*[@x×*]\s*(-?\d+[.,]\d{2})\s*=\s*(-?\d+[.,]\d{2})/i);
  if (withEq) {
    const qty = Number(withEq[1].replace(",", ".")) || 1;
    const unit = parseAmount(withEq[2]);
    const total = parseAmount(withEq[3]);
    if (unit && total) return { qty, unit, lineTotal: total };
  }
  const at = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:buc(?:ati)?|pet|kg|g|l|ml)?\s*[@x×*]\s*(-?\d+[.,]\d{2})/i);
  if (!at) return undefined;
  const qty = Number(at[1].replace(",", ".")) || 1;
  const unit = parseAmount(at[2]);
  if (!unit) return undefined;
  return { qty, unit, lineTotal: round2(qty * unit) };
}

function isUnitPriceLine(line: string) {
  return /^\s*\d+(?:[.,]\d+)?\s*buc(?:ati)?\s*@/i.test(line);
}

function isBarePriceLine(line: string) {
  const money = lastMoney(line);
  if (!money) return false;
  const label = cleanProductLabel(line, money.index);
  return label.length < 2 || qtyOnlyPattern.test(line);
}

function isHeaderLine(line: string) {
  if (lastMoney(line) || parseQtyUnit(line)) return false;
  if (legalVendorPattern.test(line) && line.length < 48) return true;
  return knownVendors.some(([pattern]) => {
    if (!pattern.test(line)) return false;
    const leftover = line.replace(pattern, "").replace(/[\s.:_\-/]/g, "");
    return leftover.length <= 8;
  });
}

function isIgnorableMergeLine(line: string) {
  return /^(?:plu|extra\s*plu|id\s*unic|c\.?i\.?f)\b/i.test(line) || vatRowPattern.test(line);
}

function isWrapContinuation(line: string) {
  if (isHeaderLine(line) || footerLinePattern.test(line) || totalLinePattern.test(line) || discountLinePattern.test(line)) return false;
  if (/^sgr\b/i.test(line)) return true;
  if (/^\d+(?:[.,]\d+)?\s*(?:l|ml|cl|g|kg)\b/i.test(line)) return true;
  return /^(?:naturala|necarbogaz|min\.|plata pet|carbogazoasa)/i.test(line);
}

function looksLikeNameLine(line: string) {
  if (!/[a-zA-ZăâîșțĂÂÎȘȚ]{3,}/.test(line)) return false;
  if (isHeaderLine(line) || footerLinePattern.test(line) || totalLinePattern.test(line) || discountLinePattern.test(line)) return false;
  if (vatRowPattern.test(line) || /^(?:plu|extra\s*plu|id\s*unic)\b/i.test(line)) return false;
  if (isUnitPriceLine(line) || lastMoney(line)) return false;
  return true;
}

function isNoiseLine(line: string) {
  if (!line) return true;
  if (vatRowPattern.test(line) || /^(?:plu|extra\s*plu|id\s*unic|c\.?i\.?f)\b/i.test(line)) return true;
  if (/^\d{1,2}\s*%/.test(line)) return true;
  if (isUnitPriceLine(line)) return true;
  return false;
}

function isSummaryDiscount(line: string, next: string) {
  if (!discountLinePattern.test(line)) return false;
  if (/economisit/i.test(line) || /economisit/i.test(next)) return true;
  const hasMinus = /[-−]/.test(line);
  return !hasMinus && (totalLinePattern.test(next) || /economisit/i.test(next));
}

function mergeReceiptLines(lines: string[]) {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || isIgnorableMergeLine(line)) continue;
    const prev = out[out.length - 1];
    if (prev && !lastMoney(prev) && !isHeaderLine(prev) && (parseQtyUnit(line) || qtyOnlyPattern.test(line) || isWrapContinuation(line))) {
      out[out.length - 1] = `${prev} ${line}`;
      continue;
    }
    if (prev && isBarePriceLine(prev) && looksLikeNameLine(line) && /^\d{5,}/.test(line)) {
      out[out.length - 1] = `${line} ${prev}`;
      continue;
    }
    out.push(line);
  }
  return out;
}

function applyLineDiscount(item: ReceiptDetectedItem, amounts: number[]) {
  const cut = Math.abs(amounts.at(-1) || 0);
  if (!cut) return;
  if (amounts.length >= 2) {
    const original = Math.abs(amounts[0]);
    if (Math.abs(item.amount - round2(original - cut)) <= 0.06) return;
  }
  const qty = parseQtyUnit(item.raw);
  if (qty && Math.abs(item.amount - round2(qty.qty * qty.unit - cut)) <= 0.06) return;
  if (qty && Math.abs(item.amount - qty.lineTotal) <= 0.06) {
    item.amount = round2(Math.max(0.01, item.amount - cut));
    return;
  }
  item.amount = round2(Math.max(0.01, item.amount - cut));
}

function parseProductLines(lines: string[]): ReceiptDetectedItem[] {
  const items: ReceiptDetectedItem[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\s+/g, " ").trim();
    const next = (lines[index + 1] || "").replace(/\s+/g, " ").trim();
    if (!line || isNoiseLine(line)) continue;
    if (isSummaryDiscount(line, next)) continue;
    if (discountLinePattern.test(line) || /^[-−]\s*\d+[.,]\d{2}\s*[abe]?\s*$/i.test(line)) {
      const previous = items.at(-1);
      const source = stripPercentages(line);
      let amounts = Array.from(source.matchAll(moneyPattern)).map((match) => parseSignedAmount(match[0])).filter((value): value is number => value !== undefined);
      if (!amounts.length && next && /^[-−]?\s*\d+[.,]\d{2}\s*[abe]?\s*$/i.test(stripPercentages(next))) {
        const taken = parseSignedAmount(next);
        if (taken !== undefined) {
          amounts = [taken];
          index += 1;
        }
      }
      if (previous && amounts.length) applyLineDiscount(previous, amounts);
      continue;
    }
    if (footerLinePattern.test(line) || totalLinePattern.test(line)) continue;
    const money = lastMoney(line);
    if (!money?.amount || money.index === undefined) continue;
    if (money.amount > 20000) continue;
    const label = cleanProductLabel(line, money.index);
    if (label.length < 2 || !/[a-zA-ZăâîșțĂÂÎȘȚ]/.test(label)) continue;
    items.push({ label, amount: money.amount, category: suggestedCategory(label), raw: line });
  }
  return items;
}

/** Colapsează liniile identice; folosit numai când suma cu dubluri nu se potrivește cu totalul. */
const collapseIdentical = (list: ReceiptDetectedItem[]) => {
  const unique = new Map<string, ReceiptDetectedItem>();
  for (const item of list) unique.set(`${item.label.toLowerCase()}-${item.amount}`, item);
  return Array.from(unique.values());
};

/**
 * Două produse identice cumpărate împreună și aceeași linie citită de două ori din poze
 * suprapuse arată la fel în text. Totalul bonului decide între ele: încercăm întâi varianta
 * completă, apoi cea colapsată, și o păstrăm pe cea care se reconciliază. Dacă nu se
 * închid banii, păstrăm produsele și credem totalul tipărit — nu aruncăm totul.
 */
function reconcileItems(items: ReceiptDetectedItem[], total?: number) {
  if (!items.length) return { items, amount: total };
  const sum = (list: ReceiptDetectedItem[]) => round2(list.reduce((value, item) => value + item.amount, 0));
  const capped = items.slice(0, 80);
  if (total) {
    for (const candidate of [capped, collapseIdentical(capped)]) {
      const withoutTotalDupes = candidate.filter((item) => Math.abs(item.amount - total) > 0.05);
      for (const list of [withoutTotalDupes, candidate]) {
        if (list.length && Math.abs(sum(list) - total) <= 0.06) return { items: list, amount: total };
      }
    }
    const kept = capped.filter((item) => Math.abs(item.amount - total) > 0.05);
    return { items: kept.length ? kept : capped, amount: total };
  }
  const unique = collapseIdentical(capped);
  if (unique.length === 1) return { items: unique, amount: unique[0].amount };
  return { items: unique.length <= 12 ? unique : [], amount: unique.length === 1 ? unique[0].amount : undefined };
}

export function interpretReceiptText(input: string | string[]): LocalReceiptOcr {
  const rawLines = (Array.isArray(input) ? input : input.split(/\r?\n/)).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const lines = mergeReceiptLines(rawLines);
  const text = rawLines.join("\n");
  const vendor = inferVendor(rawLines);
  const date = inferDate(text);
  const total = inferTotal(rawLines) ?? inferTotal(lines);
  const parsed = parseProductLines(lines);
  const reconciled = reconcileItems(parsed, total);
  return { text, vendor, date, amount: reconciled.amount, items: reconciled.items };
}

export function parseReceiptItems(lines: string[]): ReceiptDetectedItem[] {
  return interpretReceiptText(lines).items;
}

export function ocrTextLooksUseful(text: string) {
  const letters = (text.match(/[a-zA-ZăâîșțĂÂÎȘȚ]/g) || []).length;
  return letters >= 24 || /\b(total|lei|reducere|srl|bon)\b/i.test(text);
}

function lumaOf(data: Uint8ClampedArray, i: number) {
  return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
}

function otsuThreshold(data: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) hist[Math.round(lumaOf(data, i))] += 1;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let wB = 0, sumB = 0, best = 0, thresh = 128;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (!wB) continue;
    const wF = count - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thresh = t; }
  }
  return Math.max(90, Math.min(170, thresh));
}

function findPaperBox(data: Uint8ClampedArray, width: number, height: number) {
  const THRESH = otsuThreshold(data);
  const rowScore = new Float32Array(height);
  const colScore = new Float32Array(width);
  for (let y = 0; y < height; y += 1) {
    let bright = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (lumaOf(data, i) >= THRESH) {
        bright += 1;
        colScore[x] += 1;
      }
    }
    rowScore[y] = bright / width;
  }
  for (let x = 0; x < width; x += 1) colScore[x] /= height;
  let y0 = 0, y1 = height - 1, x0 = 0, x1 = width - 1;
  while (y0 < height && rowScore[y0] < 0.14) y0 += 1;
  while (y1 > y0 && rowScore[y1] < 0.14) y1 -= 1;
  while (x0 < width && colScore[x0] < 0.10) x0 += 1;
  while (x1 > x0 && colScore[x1] < 0.10) x1 -= 1;
  const padX = Math.round((x1 - x0) * 0.04);
  const padY = Math.round((y1 - y0) * 0.03);
  x0 = Math.max(0, x0 - padX);
  x1 = Math.min(width, x1 + padX);
  y0 = Math.max(0, y0 - padY);
  y1 = Math.min(height, y1 + padY);
  const area = Math.max(1, (x1 - x0) * (y1 - y0));
  if (area < width * height * 0.10) return { x0: 0, y0: 0, x1: width, y1: height };
  return { x0, y0, x1, y1 };
}

function alreadyHighContrast(data: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) hist[Math.round(lumaOf(data, i))] += 1;
  const cut = Math.max(1, Math.floor(count * 0.05));
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && acc < cut) { acc += hist[lo]; lo += 1; }
  acc = 0;
  while (hi > lo && acc < cut) { acc += hist[hi]; hi -= 1; }
  return hi - lo > 170;
}

function stretchContrast(data: Uint8ClampedArray) {
  if (alreadyHighContrast(data)) return;
  const hist = new Uint32Array(256);
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) hist[Math.round(lumaOf(data, i))] += 1;
  const cut = Math.max(1, Math.floor(count * 0.01));
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && acc < cut) { acc += hist[lo]; lo += 1; }
  acc = 0;
  while (hi > lo && acc < cut) { acc += hist[hi]; hi -= 1; }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    const stretched = Math.max(0, Math.min(255, Math.round((lumaOf(data, i) - lo) * 255 / span)));
    const boosted = stretched < 128
      ? Math.round((stretched * stretched) / 128)
      : Math.round(255 - ((255 - stretched) * (255 - stretched) / 127));
    data[i] = data[i + 1] = data[i + 2] = boosted;
    data[i + 3] = 255;
  }
}

export async function prepareReceiptImageForOcr(dataUrl: string) {
  const image = await loadDataUrlImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return dataUrl;
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) return dataUrl;
  sourceCtx.drawImage(image, 0, 0);
  const pixels = sourceCtx.getImageData(0, 0, width, height);
  const box = findPaperBox(pixels.data, width, height);
  const cropW = Math.max(1, box.x1 - box.x0);
  const cropH = Math.max(1, box.y1 - box.y0);
  const maxEdge = Math.max(cropW, cropH);
  const scale = maxEdge < 1500 ? Math.min(2.8, 1800 / maxEdge) : maxEdge > 2400 ? 2200 / maxEdge : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropW * scale));
  canvas.height = Math.max(1, Math.round(cropH * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, box.x0, box.y0, cropW, cropH, 0, 0, canvas.width, canvas.height);
  const prepared = ctx.getImageData(0, 0, canvas.width, canvas.height);
  stretchContrast(prepared.data);
  ctx.putImageData(prepared, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.94);
}

function dateFromJpegExif(dataUrl: string) {
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return undefined;
    const head = atob(dataUrl.slice(comma + 1, comma + 1 + 16000));
    const match = head.match(/(\d{4}):(\d{2}):(\d{2})[ T:]/);
    if (!match) return undefined;
    return civilDate(Number(match[1]), Number(match[2]), Number(match[3]));
  } catch {
    return undefined;
  }
}

function scoreOcr(result: LocalReceiptOcr) {
  return (result.amount ? 8 : 0) + Math.min(result.items.length, 20) + (result.vendor ? 2 : 0) + (result.date ? 1 : 0);
}

type TesseractLine = { text: string; confidence: number; bbox?: { y0: number; x0: number } };
type TesseractPage = {
  text: string;
  confidence: number;
  blocks?: Array<{ paragraphs: Array<{ lines: TesseractLine[] }> }> | null;
};

function collectOcrLines(page: TesseractPage) {
  const boxed = page.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)) || [];
  boxed.sort((a, b) => (a.bbox?.y0 ?? 0) - (b.bbox?.y0 ?? 0) || (a.bbox?.x0 ?? 0) - (b.bbox?.x0 ?? 0));
  const confident = boxed
    .filter((line) => line.confidence >= 22 || totalLinePattern.test(line.text) || discountLinePattern.test(line.text))
    .map((line) => line.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (confident.length >= 4) return confident;
  return page.text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export async function readReceiptLocally(images: string[], onProgress?: (percent: number) => void): Promise<LocalReceiptOcr> {
  if (!images.length) throw new Error("Adaugă cel puțin o fotografie înainte de citire.");
  const { createWorker, PSM } = await import("tesseract.js");
  onProgress?.(4);
  let worker;
  try {
    worker = await createWorker("ron+eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text" && typeof message.progress === "number") onProgress?.(10 + Math.round(message.progress * 70));
      },
    });
  } catch {
    worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text" && typeof message.progress === "number") onProgress?.(10 + Math.round(message.progress * 70));
      },
    });
  }
  try {
    const runPass = async (mode: number) => {
      await worker.setParameters({
        tessedit_pageseg_mode: mode,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      const parts: string[] = [];
      const lineTexts: string[] = [];
      for (let index = 0; index < images.length; index += 1) {
        let prepared = images[index];
        try { prepared = await prepareReceiptImageForOcr(images[index]); } catch { prepared = images[index]; }
        const result = await worker.recognize(prepared, { rotateAuto: true }, { text: true, blocks: true });
        const page = result.data as TesseractPage;
        parts.push(page.text);
        lineTexts.push(...collectOcrLines(page));
      }
      const interpreted = interpretReceiptText(lineTexts.length ? lineTexts : parts);
      return { ...interpreted, text: parts.join("\n").trim() || interpreted.text };
    };
    let interpreted = await runPass(PSM.SINGLE_COLUMN);
    if (scoreOcr(interpreted) < 10) {
      onProgress?.(84);
      const retry = await runPass(PSM.AUTO);
      if (scoreOcr(retry) > scoreOcr(interpreted)) interpreted = retry;
    }
    if (!interpreted.date) {
      const fromPhoto = images.map(dateFromJpegExif).find(Boolean);
      if (fromPhoto) interpreted = { ...interpreted, date: fromPhoto };
    }
    onProgress?.(100);
    return interpreted;
  } finally {
    await worker.terminate();
  }
}
