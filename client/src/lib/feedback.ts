/**
 * „Spune-ne ce nu merge” — feedback pentru testarea închisă.
 * Pleacă doar textul omului, contactul dacă îl dă și, cu acordul lui, detalii tehnice.
 * Fără rețea, mesajul așteaptă pe telefon și pleacă la următoarea deschidere.
 */
import { APP_VERSION } from "@/lib/app-version";
import { isNativeApp } from "@/lib/app-storage";
import { getLocale } from "@/lib/i18n";
import { authHeader } from "@/lib/realtime-sync";
import { safeSetItem } from "@/lib/safe-storage";

const FEEDBACK_URL = "https://europe-central2-buget-familie-a6a0d.cloudfunctions.net/appFeedback";
const QUEUE_KEY = "buget-familie:feedback-queue-v1";

export type FeedbackKind = "problem" | "idea" | "other";
export type FeedbackPayload = { kind: FeedbackKind; message: string; contact?: string; details?: Record<string, string | boolean> };

/** Ce ajută la reproducere, fără nimic din registru. */
export function technicalDetails(screen: string, synced: boolean): Record<string, string | boolean> {
  const theme = (() => { try { return window.localStorage.getItem("buget-familie:theme") || ""; } catch { return ""; } })();
  return {
    version: APP_VERSION,
    screen,
    platform: isNativeApp() ? "android" : "web",
    device: typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 160),
    language: getLocale(),
    theme,
    viewport: typeof window === "undefined" ? "" : `${window.innerWidth}x${window.innerHeight}`,
    synced,
  };
}

async function post(payload: FeedbackPayload): Promise<{ ok: boolean; error?: string; retry: boolean }> {
  try {
    const identity = await authHeader();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (identity) headers.Authorization = identity;
    const response = await fetch(FEEDBACK_URL, { method: "POST", headers, body: JSON.stringify(payload) });
    if (response.ok) return { ok: true, retry: false };
    const body = await response.json().catch(() => ({})) as { error?: string };
    // 4xx: mesajul în sine nu e bun sau s-a atins plafonul — nu-l mai retrimitem singuri.
    return { ok: false, error: body.error, retry: response.status >= 500 };
  } catch {
    return { ok: false, retry: true };
  }
}

const readQueue = (): FeedbackPayload[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
};
const writeQueue = (items: FeedbackPayload[]) => {
  try {
    if (items.length) safeSetItem(window.localStorage, QUEUE_KEY, JSON.stringify(items.slice(-20)));
    else window.localStorage.removeItem(QUEUE_KEY);
  } catch { /* fără stocare, mesajul doar nu mai așteaptă */ }
};

export type FeedbackResult = "sent" | "queued" | { error: string };

export async function sendFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  const result = await post(payload);
  if (result.ok) return "sent";
  if (result.retry) {
    writeQueue([...readQueue(), payload]);
    return "queued";
  }
  return { error: result.error || "" };
}

/** La pornire: trimite ce a rămas în așteptare. */
export async function flushFeedbackQueue(): Promise<void> {
  const pending = readQueue();
  if (!pending.length || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const left: FeedbackPayload[] = [];
  for (const item of pending) {
    const result = await post(item);
    if (!result.ok && result.retry) left.push(item);
  }
  writeQueue(left);
}
