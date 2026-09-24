/** Ghidul: memoria frazelor, cota zilnică online și bucățile mici de interfață (text, bara de cotă). */
import { type ReactNode } from "react";
import { type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import { aiDailyLimit } from "@/lib/entitlements";
import { FamilieUpgrade } from "@/components/FamilieUpgrade";
import {
  emptyGuideMemory,
  habitKey,
  rememberExpense,
  type FinancialUpdate,
  type GuideMemory,
} from "@/lib/understand";

export const money = (value: number) => `${Number(value.toFixed(2)).toLocaleString("ro-RO", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} RON`;
export const naturalTitle = (raw: string, category?: string) => /combustibil|benzina|motorina/i.test(raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? "Combustibil" : category || t("Cheltuială");

export function GuideText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  text.split(/\n+/).forEach((line, lineIndex) => {
    if (lineIndex) nodes.push(<br key={`br-${lineIndex}`} />);
    line.split(/(\*\*[^*]+\*\*)/g).forEach((chunk, chunkIndex) => {
      const bold = chunk.match(/^\*\*([^*]+)\*\*$/);
      nodes.push(bold ? <strong key={`${lineIndex}-${chunkIndex}`}>{bold[1]}</strong> : chunk);
    });
  });
  return <span className="ai-chat-text">{nodes}</span>;
}

export const QUOTA_KEY = "buget-familie:ai-quota-v2";
export const MEMORY_KEY = "buget-familie:ai-memory-v1";

const emptyMemory = emptyGuideMemory;

export function loadMemory(): GuideMemory {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MEMORY_KEY) || "null") as Partial<GuideMemory> | null;
    if (!parsed || !Array.isArray(parsed.phrases)) return emptyMemory();
    return { phrases: parsed.phrases.slice(-80), skippedOnline: Number(parsed.skippedOnline) || 0 };
  } catch {
    return emptyMemory();
  }
}

/** Memoria ghidului în sesiunea curentă, citită și scrisă și de componentă. */
export const guideMemory: { current: GuideMemory } = { current: emptyMemory() };

/** Reține alegerea și o salvează pe telefon. Corectura cântărește dublu. */
export function learn(update: Extract<FinancialUpdate, { kind: "expense" }>, weight: 1 | 2 = 1): GuideMemory {
  guideMemory.current = rememberExpense(guideMemory.current, update, weight);
  return guideMemory.current;
}

export function markLocalSave(): GuideMemory {
  guideMemory.current = { ...guideMemory.current, skippedOnline: guideMemory.current.skippedOnline + 1 };
  return guideMemory.current;
}

export function seedMemory(current: GuideMemory, data: AppData): GuideMemory {
  const map = new Map(current.phrases.map((item) => [item.key, item]));
  data.transactions.forEach((item) => {
    if (item.kind !== "expense") return;
    const key = habitKey(item.title);
    if (key.length < 3 || key === "altele" || key === "cheltuiala") return;
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        ...prev,
        category: prev.category || item.category,
        allocationId: prev.allocationId || item.allocationId,
        sourceId: prev.sourceId || item.sourceId,
        count: Math.max(prev.count, 1),
      });
      return;
    }
    map.set(key, {
      key,
      title: item.title,
      category: item.category,
      allocationId: item.allocationId,
      sourceId: item.sourceId,
      count: 1,
      lastAt: item.date,
    });
  });
  return { phrases: Array.from(map.values()).slice(-80), skippedOnline: current.skippedOnline };
}

export type QuotaInfo = { remaining: number; limit: number; resetAt: string; mode: "online" | "local" };

function nextLocalMidnight() {
  const at = new Date();
  at.setHours(24, 0, 0, 0);
  return at.toISOString();
}

export function emptyQuota(): QuotaInfo {
  const limit = aiDailyLimit();
  return { remaining: limit, limit, resetAt: nextLocalMidnight(), mode: "online" };
}

export function consumeQuota(current: QuotaInfo, payload: { remaining?: number | null; limit?: number | null; resetAt?: string | null } | undefined, ok: boolean, exhausted: boolean): QuotaInfo {
  const resetAt = current.resetAt && Date.parse(current.resetAt) > Date.now() ? current.resetAt : nextLocalMidnight();
  const limit = aiDailyLimit();
  if (exhausted) return { remaining: 0, limit, resetAt: payload?.resetAt || resetAt, mode: "local" };
  if (!ok) return { remaining: current.remaining, limit, resetAt, mode: current.remaining > 0 ? current.mode : "local" };
  const remaining = Math.max(0, current.remaining - 1);
  return { remaining, limit, resetAt, mode: remaining > 0 ? "online" : "local" };
}

export function loadQuota(): QuotaInfo {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUOTA_KEY) || "null") as Partial<QuotaInfo> | null;
    const limit = aiDailyLimit();
    if (!parsed || (parsed.mode !== "online" && parsed.mode !== "local")) return emptyQuota();
    if (!parsed.resetAt || Date.parse(parsed.resetAt) <= Date.now()) return emptyQuota();
    const used = Math.max(0, (Number(parsed.limit) || limit) - Number(parsed.remaining ?? limit));
    const remaining = Math.max(0, limit - used);
    return { remaining, limit, resetAt: parsed.resetAt, mode: remaining <= 0 ? "local" : parsed.mode === "local" ? "local" : "online" };
  } catch {
    return emptyQuota();
  }
}

export function formatReset(iso: string | null) {
  if (!iso) return t("mâine");
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return t("mâine");
  const time = at.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (at.toDateString() === now.toDateString()) return `azi la ${time}`;
  if (at.toDateString() === tomorrow.toDateString()) return `mâine la ${time}`;
  return `${at.toLocaleDateString(getLocale(), { day: "numeric", month: "short" })} la ${time}`;
}

function quotaPercent(quota: QuotaInfo) {
  if (quota.mode === "local" || quota.remaining <= 0) return 0;
  return Math.max(3, Math.min(100, Math.round((quota.remaining / Math.max(1, quota.limit)) * 100)));
}

export function GuideQuotaBar({ quota, habits }: { quota: QuotaInfo; habits: number }) {
  const low = quota.mode === "online" && quota.remaining <= 8;
  const local = quota.mode === "local" || quota.remaining <= 0;
  const learned = habits > 0 ? ` · ${habits} obiceiuri` : "";
  const longLabel = local
    ? `Ghid local · ${quota.remaining} / ${quota.limit} mesaje online azi · se reia ${formatReset(quota.resetAt)}${habits > 0 ? ` · ${habits} obiceiuri învățate local` : ""}`
    : `Ghid online · ${quota.remaining} / ${quota.limit} mesaje rămase azi · se reia ${formatReset(quota.resetAt)}${habits > 0 ? ` · ${habits} obiceiuri învățate local` : ""}`;
  const shortLabel = local
    ? `Local · se reia ${formatReset(quota.resetAt)}${learned}`
    : `${quota.remaining}/${quota.limit} azi${learned}`;
  return (
    <div className={`ai-quota ${local ? "is-local" : low ? "is-low" : "is-ok"}`} aria-live="polite">
      <div className="ai-quota-track" aria-hidden="true"><i style={{ width: `${quotaPercent(quota)}%` }} /></div>
      <p className="ai-quota-long">{longLabel}</p>
      <p className="ai-quota-short">{shortLabel}</p>
      {local ? <FamilieUpgrade reason="ai" /> : null}
    </div>
  );
}

