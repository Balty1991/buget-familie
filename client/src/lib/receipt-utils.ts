/**
 * Bonuri mobile: procesare și interpretare locală înainte de persistență.
 * Fotografiile și textul OCR nu sunt trimise către un serviciu financiar extern.
 */
import { createWorker } from "tesseract.js";

const MAX_ORIGINAL_BYTES = 12_000_000;
const TARGET_COMPRESSED_BYTES = 600_000;
const MAX_EDGE = 1600;
const moneyPattern = /\b\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{2})\b|\b\d+[,.]\d{2}\b/g;
const excludedLinePattern = /\b(total|subtotal|suma|de\s*plata|rest|tva|cash|numerar|card|visa|mastercard|bon\s*fiscal|operator|casa|aprob|discount|reducere)\b/i;

const readBlobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Imaginea nu a putut fi citită.")); reader.readAsDataURL(blob);
});
const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Fișierul nu pare a fi o imagine validă.")); }; image.src = url;
});
const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Nu s-a putut comprima imaginea.")), "image/jpeg", quality));

export async function compressReceiptImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Alege o fotografie a bonului, nu alt tip de fișier.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("O poză poate avea cel mult 12 MB înainte de comprimare.");
  const image = await loadImage(file); const ratio = Math.min(1, MAX_EDGE / Math.max(image.width, image.height)); const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d"); if (!context) throw new Error("Browserul nu poate procesa fotografia.");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let blob = await canvasBlob(canvas, 0.84); for (const quality of [0.76, 0.68, 0.6, 0.52]) { if (blob.size <= TARGET_COMPRESSED_BYTES) break; blob = await canvasBlob(canvas, quality); }
  return readBlobAsDataUrl(blob);
}

export type ReceiptDetectedItem = { label: string; amount: number; category: string; raw: string };
export type LocalReceiptOcr = { text: string; amount?: number; date?: string; items: ReceiptDetectedItem[] };

const parseAmount = (raw: string) => {
  const normalized = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."); const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};
const suggestedCategory = (label: string) => {
  const value = label.toLocaleLowerCase("ro-RO");
  if (/(apa|suc|cola|bere|vin|cafea|ceai|bautur)/.test(value)) return "Băuturi";
  if (/(ciocol|biscuit|bombo|dulce|napolitan|prajitur)/.test(value)) return "Dulciuri";
  if (/(deterg|sapun|igien|servetel|hartie|burete|solutie|sac menaj)/.test(value)) return "Casă & facturi";
  if (/(taxi|uber|bolt|benz|motorin|parcar|transport)/.test(value)) return "Transport";
  if (/(farmac|medic|vitamin|pastil)/.test(value)) return "Sănătate";
  if (/(paine|lapte|iaurt|branza|oua|carne|mezel|fruct|legum|orez|paste|faina|ulei|zahar|aliment)/.test(value)) return "Alimente";
  return "Alimente";
};
const cleanProductLabel = (line: string, priceIndex: number) => line.slice(0, priceIndex)
  .replace(moneyPattern, " ").replace(/\b\d+(?:[,.]\d+)?\s*[xX*]\s*/g, " ").replace(/\b\d+(?:[,.]\d+)?\s*(?:kg|g|l|ml|buc)\b/gi, " ")
  .replace(/^\s*[#*._\-\d]+\s*/, "").replace(/\s{2,}/g, " ").trim();

export function parseReceiptItems(lines: string[]): ReceiptDetectedItem[] {
  const unique = new Map<string, ReceiptDetectedItem>();
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim(); if (!line || excludedLinePattern.test(line)) continue;
    const matches = Array.from(line.matchAll(moneyPattern)); if (!matches.length) continue;
    const last = matches.at(-1); if (!last || typeof last.index !== "number") continue;
    const amount = parseAmount(last[0]); const label = cleanProductLabel(line, last.index);
    if (!amount || label.length < 2 || !/[a-zA-ZăâîșțĂÂÎȘȚ]/.test(label)) continue;
    const item = { label, amount, category: suggestedCategory(label), raw: line };
    unique.set(`${label.toLowerCase()}-${amount}`, item);
  }
  return Array.from(unique.values()).slice(0, 80);
}

function inferReceiptFields(text: string): Pick<LocalReceiptOcr, "amount" | "date"> {
  const dateMatch = text.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
  const date = dateMatch ? `${dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}` : undefined;
  const totalLine = text.split(/\r?\n/).reverse().find((line) => /\b(total|suma|de\s*plata|total\s*lei)\b/i.test(line));
  const candidates = (totalLine || text).match(moneyPattern) || []; const amounts = candidates.map(parseAmount).filter((value): value is number => Boolean(value));
  return { date, amount: amounts.length ? amounts.at(-1) : undefined };
}

export async function readReceiptLocally(images: string[], onProgress?: (percent: number) => void): Promise<LocalReceiptOcr> {
  if (!images.length) throw new Error("Adaugă cel puțin o fotografie înainte de citire.");
  const worker = await createWorker("eng", 1, { logger: (message) => { if (message.status === "recognizing text" && typeof message.progress === "number") onProgress?.(Math.round(message.progress * 100)); } });
  try {
    const parts: string[] = []; const lineTexts: string[] = [];
    for (let index = 0; index < images.length; index += 1) {
      const result = await worker.recognize(images[index], {}, { blocks: true }); parts.push(result.data.text);
      const lines = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => line.text))) || result.data.text.split(/\r?\n/);
      lineTexts.push(...lines);
    }
    const text = parts.join("\n").trim(); return { text, items: parseReceiptItems(lineTexts), ...inferReceiptFields(text) };
  } finally { await worker.terminate(); }
}
