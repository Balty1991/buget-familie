/**
 * Scanarea bonului: poza pleacă o singură dată la funcția `readReceipt` (Gemini, cu Claude ca rezervă), care
 * întoarce articolele pe categorii. Nimic nu se salvează singur: rezultatul umple
 * formularul „Adaugă mișcare”, iar omul verifică și apasă Salvează.
 */
import { expenseCategories, isoToday, type AppData, type PaymentKind } from "./finance-data";
import { t } from "./i18n";

const ENDPOINT = "https://europe-central2-buget-familie-a6a0d.cloudfunctions.net/readReceipt";
const CONSENT_KEY = "buget-familie:receipt-scan-consent";

export type ScannedReceipt = {
  store: string;
  date: string | null;
  total: number;
  items: Array<{ name: string; rawName?: string; quantity: number; amount: number; discount?: number; category: string }>;
  payments: Array<{ method: "cash" | "card" | "meal" | "voucher" | "other"; amount: number }>;
  confidence: "high" | "medium" | "low";
  /** Modelul care a citit bonul (Gemini sau, ca rezervă, Claude). */
  model?: string;
};

export type ScanPrefill = {
  /** Cine a citit: „gemini” de obicei, „claude” când Gemini era aglomerat. */
  readBy?: "gemini" | "claude";
  title: string;
  amount: number;
  date?: string;
  category: string;
  lines: Array<{ label: string; amount: number; category: string }>;
  /** Prima sursă (cea cu suma mai mare), dacă familia are una de felul plății. */
  sourceId?: string;
  /** A doua sursă, când bonul e plătit din două (ex. voucher SGR + numerar). */
  second?: { sourceId: string; amount: number };
  /** Reducerile de pe bon, adunate (ce s-a scăzut din prețul de raft). */
  discount: number;
  /** Ce trebuie verificat cu ochii: suma articolelor nu bate cu totalul sau poza a fost greu de citit. */
  warning?: string;
  count: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

const PAYMENT_KIND: Record<ScannedReceipt["payments"][number]["method"], PaymentKind | undefined> = {
  cash: "cash",
  card: "card",
  meal: "meal",
  voucher: "voucher",
  other: undefined,
};

/** Data de pe bon, doar dacă e plauzibilă: nu în viitor și nu mai veche de 60 de zile. */
function plausibleDate(date: string | null, today: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return undefined;
  const age = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000;
  return Number.isFinite(age) && age <= 60 ? date : undefined;
}

/** Ce citește modelul devine ce vede omul în formular: titlu, total, data, articolele și sursele. */
export function scanToPrefill(receipt: ScannedReceipt, data: AppData, memberId?: string, today = isoToday()): ScanPrefill {
  const known = new Set<string>([...data.settings.customCategories, ...receiptCategories(data)]);
  const fallback = "Altele";
  const lines = receipt.items
    .filter((item) => item.amount > 0)
    .map((item) => ({
      // Reducerea rămâne vizibilă pe rând: suma e cea plătită, eticheta spune cât s-a scăzut.
      label: `${item.quantity && Math.abs(item.quantity - 1) > 0.0001 ? `${item.name} × ${item.quantity.toLocaleString("ro-RO", { maximumFractionDigits: 3 })}` : item.name}${(item.discount || 0) > 0.004 ? ` ${t("(reducere −{amount})", { amount: (item.discount || 0).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}` : ""}`,
      amount: round(item.amount),
      category: known.has(item.category) ? item.category : fallback,
    }));
  const itemsSum = round(lines.reduce((sum, line) => sum + line.amount, 0));
  const total = receipt.total > 0 ? round(receipt.total) : itemsSum;
  const byCategory = new Map<string, number>();
  for (const line of lines) byCategory.set(line.category, (byCategory.get(line.category) || 0) + line.amount);
  const category = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Alimente";

  const sources = data.settings.paymentSources.filter((source) => source.kind !== "transfer" && !source.currency);
  const sourceFor = (method: ScannedReceipt["payments"][number]["method"], skip?: string) => {
    const kind = PAYMENT_KIND[method];
    if (!kind) return undefined;
    const fitting = sources.filter((source) => source.kind === kind && source.id !== skip);
    return fitting.find((source) => source.memberId === memberId) || fitting.find((source) => !source.memberId) || fitting[0];
  };
  const payments = [...receipt.payments].filter((payment) => payment.amount > 0).sort((a, b) => b.amount - a.amount);
  const first = payments[0] ? sourceFor(payments[0].method) : undefined;
  const secondSource = first && payments[1] ? sourceFor(payments[1].method, first.id) : undefined;
  const secondAmount = secondSource && payments[1] ? round(Math.min(payments[1].amount, total)) : 0;

  let warning: string | undefined;
  if (lines.length && Math.abs(itemsSum - total) > 0.05) {
    warning = t("Articolele fac {items} lei, iar totalul bonului e {total} lei. Verifică rândurile înainte să salvezi.", { items: itemsSum.toLocaleString("ro-RO", { minimumFractionDigits: 2 }), total: total.toLocaleString("ro-RO", { minimumFractionDigits: 2 }) });
  } else if (receipt.confidence === "low") {
    warning = t("Poza a fost greu de citit. Verifică sumele cu bonul în mână.");
  }

  const store = receipt.store.trim();
  return {
    title: store ? t("Cumpărături {store}", { store }) : t("Cumpărături"),
    amount: total,
    date: plausibleDate(receipt.date, today),
    category,
    lines,
    sourceId: first?.id,
    second: secondSource && secondAmount > 0 && secondAmount < total ? { sourceId: secondSource.id, amount: secondAmount } : undefined,
    warning,
    ...(receipt.model ? { readBy: receipt.model.startsWith("claude") ? "claude" as const : "gemini" as const } : {}),
    discount: round(receipt.items.reduce((sum, item) => sum + (item.discount && item.discount > 0 && item.amount > 0 ? item.discount : 0), 0)),
    count: lines.length,
  };
}

/** Categoriile pe care le primește modelul: ale aplicației și cele create de familie. */
export function receiptCategories(data: AppData): string[] {
  // Ratele și creditele nu apar pe bonuri de cumpărături.
  const base = expenseCategories.filter((item) => item !== "Credite" && item !== "Rate produse");
  return Array.from(new Set([...base, ...data.settings.customCategories])).slice(0, 40);
}

/** Poza micșorată pe telefon: bonul rămâne lizibil, dar pleacă repede și costă puțin. */
export async function compressReceiptPhoto(file: File, maxSide = 2000): Promise<{ data: string; mimeType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(t("Poza nu s-a putut deschide.")));
      element.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t("Poza nu s-a putut pregăti."));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    canvas.width = 0;
    canvas.height = 0;
    return { data: dataUrl.replace(/^data:[^,]+,/, ""), mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function requestReceiptScan(image: { data: string; mimeType: string }, categories: string[]): Promise<ScannedReceipt> {
  // Firebase se încarcă abia la prima scanare, nu odată cu formularul.
  const { appCheckHeader, authHeader } = await import("./realtime-sync");
  // Verificarea aplicației poate rămâne agățată fără rețea bună; după 8 s cererea pleacă oricum.
  const capped = <T,>(work: Promise<T>) => Promise.race([work, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8_000))]);
  const [token, identity] = await Promise.all([capped(appCheckHeader()), capped(authHeader())]);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["X-Firebase-AppCheck"] = token;
  if (identity) headers.Authorization = identity;
  let response: Response;
  try {
    response = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify({ image: image.data, mimeType: image.mimeType, categories }), signal: AbortSignal.timeout(95_000) });
  } catch {
    throw new Error(t("Nu am putut trimite poza. Verifică internetul și mai încearcă o dată."));
  }
  const payload = await response.json().catch(() => ({})) as { receipt?: ScannedReceipt; error?: string; reason?: string };
  if (!response.ok || !payload.receipt) {
    // Codul tehnic, scurt, ca omul să-l poată trimite când citirea nu merge.
    const code = payload.reason ? ` (${payload.reason})` : !response.ok ? ` (HTTP ${response.status})` : "";
    throw new Error(`${payload.error || t("Nu am putut citi bonul acum. Mai încearcă o dată.")}${code}`);
  }
  return payload.receipt;
}

export function receiptScanConsented(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; }
}

export function rememberReceiptScanConsent() {
  try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* fără stocare: întrebăm din nou data viitoare */ }
}
