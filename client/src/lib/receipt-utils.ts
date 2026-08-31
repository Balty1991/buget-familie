/**
 * Bonuri mobile: procesare și interpretare locală înainte de persistență.
 * Fotografiile și textul OCR nu sunt trimise către un serviciu financiar extern.
 */
const MAX_ORIGINAL_BYTES = 25_000_000;
const TARGET_COMPRESSED_BYTES = 600_000;
const MAX_EDGE = 1600;
const moneyPattern = /-?\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{2})|-?\d+[,.]\d{2}/g;
const footerLinePattern = /\b(subtotal|numerar|rest(?:\s*lei)?|tva|cash|card|visa|mastercard|bon\s*fiscal|operator|casa|aprob|cif|cui|nr\.?\s*tranzact|puncte|economisit)\b/i;
const totalLinePattern = /\b(total\s*lei|suma(?:\s*de)?\s*plata|de\s*plata|total)\b/i;
const discountLinePattern = /\b(reducere|rabat|discount|promo)\b/i;
const legalVendorPattern = /\b(s\.?\s*r\.?\s*l\.?|s\.?\s*a\.?|pfa|cif|cui|romania|com\.|centru|parter|str\.|nr\.|tel|jud\.|operator|fashion)\b/i;
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
  const normalized = raw.replace(/[\s\u00A0]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
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
  if (/(ciorap|tenis|hain|pantal|rochie|bluza|geaca|tricou|incalt|punga|hanorac|rochie)/.test(value)) return "Timp liber";
  if (/(apa|suc|cola|bere|vin|cafea|ceai|bautur)/.test(value)) return "Băuturi";
  if (/(ciocol|biscuit|bombo|dulce|napolitan|prajitur)/.test(value)) return "Dulciuri";
  if (/(deterg|sapun|igien|servetel|hartie|burete|solutie|sac menaj)/.test(value)) return "Casă & facturi";
  if (/(taxi|uber|bolt|benz|motorin|parcar|transport)/.test(value)) return "Transport";
  if (/(farmac|medic|vitamin|pastil)/.test(value)) return "Sănătate";
  if (/(paine|lapte|iaurt|branza|oua|carne|mezel|fruct|legum|orez|paste|faina|ulei|zahar|aliment)/.test(value)) return "Alimente";
  return "Alimente";
};

const cleanProductLabel = (line: string, priceIndex: number) => {
  let label = line.slice(0, priceIndex);
  label = label.replace(/^\s*[A-Z0-9]{2,}(?:-[A-Z0-9]{2,}){1,5}\s+/i, "");
  label = label.replace(moneyPattern, " ");
  label = label.replace(/\b\d+(?:[,.]\d+)?\s*(?:buc(?:ati)?|kg|g|l|ml)\b/gi, " ");
  label = label.replace(/\b\d+(?:[,.]\d+)?\s*[xX]\b/g, " ");
  label = label.replace(/\b[xX]\b/g, " ");
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

function inferVendor(lines: string[]) {
  const head = lines.slice(0, 12).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length >= 3);
  for (const line of head) {
    const magazin = line.match(/\bmagazin\s+([A-ZĂÂÎȘȚa-zăâîșț]{3,})\b/i);
    if (magazin?.[1] && !legalVendorPattern.test(magazin[1])) return titleVendor(magazin[1]);
  }
  for (const line of head) {
    if (legalVendorPattern.test(line)) continue;
    if (/\d{3,}/.test(line)) continue;
    if (!/[a-zA-ZăâîșțĂÂÎȘȚ]{3,}/.test(line)) continue;
    const words = line.split(" ").filter(Boolean);
    if (words.length > 4) continue;
    if (line.length > 28) continue;
    return titleVendor(line);
  }
  return undefined;
}

function inferDate(text: string) {
  const dateMatch = text.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
  if (!dateMatch) return undefined;
  const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
  return `${year}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
}

function inferTotal(lines: string[]) {
  const ranked: Array<{ amount: number; rank: number }> = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!totalLinePattern.test(line) || /\btva\b/i.test(line) || /\bnumerar\b/i.test(line) || /\brest\b/i.test(line)) continue;
    const amounts = Array.from(line.matchAll(moneyPattern)).map((match) => parseAmount(match[0])).filter((value): value is number => Boolean(value));
    const amount = amounts.at(-1);
    if (!amount) continue;
    const rank = /\btotal\s*lei\b/i.test(line) ? 3 : /\bsuma|\bde\s*plata\b/i.test(line) ? 2 : 1;
    ranked.push({ amount, rank });
  }
  ranked.sort((a, b) => b.rank - a.rank);
  return ranked[0]?.amount;
}

function parseProductLines(lines: string[]): ReceiptDetectedItem[] {
  const items: ReceiptDetectedItem[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (discountLinePattern.test(line)) {
      const amounts = Array.from(line.matchAll(moneyPattern)).map((match) => parseSignedAmount(match[0])).filter((value): value is number => value !== undefined);
      const discount = amounts.at(-1);
      const previous = items.at(-1);
      if (previous && discount) {
        const cut = Math.abs(discount);
        previous.amount = round2(Math.max(0.01, previous.amount - cut));
      }
      continue;
    }
    if (footerLinePattern.test(line) || totalLinePattern.test(line)) continue;
    const matches = Array.from(line.matchAll(moneyPattern));
    if (!matches.length) continue;
    const last = matches.at(-1);
    if (!last || typeof last.index !== "number") continue;
    const amount = parseAmount(last[0]);
    const label = cleanProductLabel(line, last.index);
    if (!amount || label.length < 2 || !/[a-zA-ZăâîșțĂÂÎȘȚ]/.test(label)) continue;
    if (amount > 20000) continue;
    items.push({ label, amount, category: suggestedCategory(label), raw: line });
  }
  return items;
}

function reconcileItems(items: ReceiptDetectedItem[], total?: number) {
  if (!items.length) return { items, amount: total };
  const unique = new Map<string, ReceiptDetectedItem>();
  for (const item of items) unique.set(`${item.label.toLowerCase()}-${item.amount}`, item);
  let next = Array.from(unique.values()).slice(0, 80);
  const sum = (list: ReceiptDetectedItem[]) => round2(list.reduce((value, item) => value + item.amount, 0));
  if (total) {
    const withoutTotalDupes = next.filter((item) => Math.abs(item.amount - total) > 0.05);
    if (Math.abs(sum(withoutTotalDupes) - total) <= 0.06) next = withoutTotalDupes;
    if (Math.abs(sum(next) - total) > 0.06) return { items: [], amount: total };
    return { items: next, amount: total };
  }
  if (next.length === 1) return { items: next, amount: next[0].amount };
  return { items: [], amount: undefined };
}

export function interpretReceiptText(input: string | string[]): LocalReceiptOcr {
  const lines = (Array.isArray(input) ? input : input.split(/\r?\n/)).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = lines.join("\n");
  const vendor = inferVendor(lines);
  const date = inferDate(text);
  const total = inferTotal(lines);
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

function findPaperBox(data: Uint8ClampedArray, width: number, height: number) {
  const THRESH = 128;
  const rowScore = new Float32Array(height);
  const colScore = new Float32Array(width);
  for (let y = 0; y < height; y += 1) {
    let bright = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (luma >= THRESH) {
        bright += 1;
        colScore[x] += 1;
      }
    }
    rowScore[y] = bright / width;
  }
  for (let x = 0; x < width; x += 1) colScore[x] /= height;
  let y0 = 0, y1 = height - 1, x0 = 0, x1 = width - 1;
  while (y0 < height && rowScore[y0] < 0.16) y0 += 1;
  while (y1 > y0 && rowScore[y1] < 0.16) y1 -= 1;
  while (x0 < width && colScore[x0] < 0.12) x0 += 1;
  while (x1 > x0 && colScore[x1] < 0.12) x1 -= 1;
  const padX = Math.round((x1 - x0) * 0.04);
  const padY = Math.round((y1 - y0) * 0.03);
  x0 = Math.max(0, x0 - padX);
  x1 = Math.min(width, x1 + padX);
  y0 = Math.max(0, y0 - padY);
  y1 = Math.min(height, y1 + padY);
  const area = Math.max(1, (x1 - x0) * (y1 - y0));
  if (area < width * height * 0.12) return { x0: 0, y0: 0, x1: width, y1: height };
  return { x0, y0, x1, y1 };
}

function stretchContrast(data: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    hist[Math.round((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000)] += 1;
  }
  const cut = Math.max(1, Math.floor(count * 0.01));
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && acc < cut) { acc += hist[lo]; lo += 1; }
  acc = 0;
  while (hi > lo && acc < cut) { acc += hist[hi]; hi -= 1; }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    const y = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    const stretched = Math.max(0, Math.min(255, Math.round((y - lo) * 255 / span)));
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
  const scale = maxEdge < 1400 ? Math.min(2.5, 1600 / maxEdge) : maxEdge > 2200 ? 2000 / maxEdge : 1;
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
  return canvas.toDataURL("image/jpeg", 0.92);
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
    .filter((line) => line.confidence >= 28 || totalLinePattern.test(line.text) || discountLinePattern.test(line.text))
    .map((line) => line.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (confident.length >= 4) return confident;
  return page.text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export async function readReceiptLocally(images: string[], onProgress?: (percent: number) => void): Promise<LocalReceiptOcr> {
  if (!images.length) throw new Error("Adaugă cel puțin o fotografie înainte de citire.");
  const { createWorker, PSM } = await import("tesseract.js");
  onProgress?.(4);
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text" && typeof message.progress === "number") onProgress?.(12 + Math.round(message.progress * 86));
    },
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const parts: string[] = [];
    const lineTexts: string[] = [];
    for (let index = 0; index < images.length; index += 1) {
      onProgress?.(6);
      let prepared = images[index];
      try { prepared = await prepareReceiptImageForOcr(images[index]); } catch { prepared = images[index]; }
      const result = await worker.recognize(prepared, { rotateAuto: true }, { text: true, blocks: true });
      const page = result.data as TesseractPage;
      parts.push(page.text);
      lineTexts.push(...collectOcrLines(page));
    }
    const interpreted = interpretReceiptText(lineTexts.length ? lineTexts : parts);
    return { ...interpreted, text: parts.join("\n").trim() || interpreted.text };
  } finally {
    await worker.terminate();
  }
}
