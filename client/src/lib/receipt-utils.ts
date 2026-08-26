/**
 * Bonuri mobile: procesare locală înainte de persistență.
 * Nu trimite fotografia unui bon către un serviciu financiar extern.
 */
import { createWorker } from "tesseract.js";

const MAX_ORIGINAL_BYTES = 12_000_000;
const TARGET_COMPRESSED_BYTES = 600_000;
const MAX_EDGE = 1600;

const readBlobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Imaginea nu a putut fi citită."));
  reader.readAsDataURL(blob);
});

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Fișierul nu pare a fi o imagine validă.")); };
  image.src = url;
});

const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Nu s-a putut comprima imaginea.")), "image/jpeg", quality);
});

export async function compressReceiptImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Alege o fotografie a bonului, nu alt tip de fișier.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("O poză poate avea cel mult 12 MB înainte de comprimare.");
  const image = await loadImage(file);
  const ratio = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browserul nu poate procesa fotografia.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let blob = await canvasBlob(canvas, 0.84);
  for (const quality of [0.76, 0.68, 0.6, 0.52]) {
    if (blob.size <= TARGET_COMPRESSED_BYTES) break;
    blob = await canvasBlob(canvas, quality);
  }
  return readBlobAsDataUrl(blob);
}

export type LocalReceiptOcr = { text: string; amount?: number; date?: string };

const parseAmount = (raw: string) => {
  const normalized = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};

function inferReceiptFields(text: string): Pick<LocalReceiptOcr, "amount" | "date"> {
  const dateMatch = text.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
  const date = dateMatch ? `${dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}` : undefined;
  const totalLine = text.split(/\r?\n/).reverse().find((line) => /\b(total|suma|de\s*plata|total\s*lei)\b/i.test(line));
  const candidates = (totalLine || text).match(/\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{2})|\b\d+[,.]\d{2}\b/g) || [];
  const amounts = candidates.map(parseAmount).filter((value): value is number => Boolean(value));
  return { date, amount: amounts.length ? amounts[amounts.length - 1] : undefined };
}

export async function readReceiptLocally(images: string[], onProgress?: (percent: number) => void): Promise<LocalReceiptOcr> {
  if (!images.length) throw new Error("Adaugă cel puțin o fotografie înainte de citire.");
  const worker = await createWorker("eng", 1, { logger: (message) => { if (message.status === "recognizing text" && typeof message.progress === "number") onProgress?.(Math.round(message.progress * 100)); } });
  try {
    const parts: string[] = [];
    for (let index = 0; index < images.length; index += 1) {
      const result = await worker.recognize(images[index]);
      parts.push(result.data.text);
    }
    const text = parts.join("\n").trim();
    return { text, ...inferReceiptFields(text) };
  } finally {
    await worker.terminate();
  }
}
