import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bot, ChevronDown, CircleCheck, FileText, Lightbulb, Maximize2, Minimize2, Paperclip, Send, Trash2, WalletCards, X } from "lucide-react";
import { allocationStatus, allocationWeekStatus, expenseCategories, formatDate, isoToday, parseNaturalSpendScenario, sourceBalance, type AppData, type Transaction } from "@/lib/finance-data";
import { todayBrief } from "@/lib/household-insights";
import type { MainView } from "@/pages/home-kit";
import "../ai-companion.css";
import { getLocale, t } from "@/lib/i18n";
import { parseAssistantMessage, type AssistantIntent, type ParsedIntent } from "@/lib/assistant-intents";
import { analyze, answerToText, SUGGESTED_QUESTIONS } from "@/lib/analyst";
import { planSpend, planIncome, type SpendPlan } from "@/lib/suggest-source";

export type NaturalDraft = Pick<Transaction, "amount" | "category" | "title" | "kind"> & { date?: string; note?: string };
export type GuidedRevert = { kind: "income" | "expense"; title: string; amount: number; date: string };
export type FinancialUpdate =
  | { kind: "income"; amount: number; title: string; date?: string; memberId?: string }
  | { kind: "expense"; amount: number; title: string; category: string; date?: string; allocationId?: string; sourceId?: string; memberId?: string }
  | { kind: "debt"; name: string; remaining: number; due?: string }
  | { kind: "debt-monthly"; amount: number; name?: string }
  | { kind: "allocation"; category: string; amount: number; weekly: boolean; weeklyAmount?: number; weeks?: number; payday?: string; label?: string }
  | { kind: "recurring"; name: string; amount: number; dueDay: number; category: string }
  | { kind: "goal"; name: string; target: number; current?: number; dueDate?: string }
  | { kind: "payday"; date: string; flexDays: number }
  | { kind: "transfer"; amount: number; fromId: string; toId: string; fromLabel: string; toLabel: string };
type Props = { data: AppData; view: MainView; onAdd: () => void; onGo: (view: MainView) => void; onNaturalEntry: (draft: NaturalDraft) => void; onFinancialUpdate: (update: FinancialUpdate) => void; onRevert?: (item: GuidedRevert) => void };
type ChatChoice = { label: string; update: FinancialUpdate };
type ChatMessage = { id: string; role: "assistant" | "user"; text: string; action?: { label: string; type: "add" | "plan" | "journal" | "insights" | "apply" }; updates?: FinancialUpdate[]; choices?: ChatChoice[]; undo?: GuidedRevert; /** Întrebări firești de după un răspuns de analiză; se trimit cu o atingere. */ followUps?: string[] };
type ChatAttachment = { name: string; mimeType: string; data: string };
type GuideStage = "income" | "debts" | "rate" | "allocation" | "ready";
const CHAT_KEY = "buget-familie:ai-chat-v1";
const shiftDay = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const today = () => shiftDay(0);
const money = (value: number) => `${Number(value.toFixed(2)).toLocaleString("ro-RO", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} RON`;
const naturalTitle = (raw: string, category?: string) => /combustibil|benzina|motorina/i.test(raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? "Combustibil" : category || "Cheltuială";


function GuideText({ text }: { text: string }) {
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

const QUOTA_KEY = "buget-familie:ai-quota-v2";
const MEMORY_KEY = "buget-familie:ai-memory-v1";
const DAILY_LIMIT = 100;

type PhraseHabit = { key: string; title: string; category: string; allocationId?: string; sourceId?: string; count: number; lastAt: string };
type GuideMemory = { phrases: PhraseHabit[]; skippedOnline: number };

function foldRo(raw: string) {
  return raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function habitKey(raw: string) {
  return foldRo(raw).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function emptyMemory(): GuideMemory {
  return { phrases: [], skippedOnline: 0 };
}

function loadMemory(): GuideMemory {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MEMORY_KEY) || "null") as Partial<GuideMemory> | null;
    if (!parsed || !Array.isArray(parsed.phrases)) return emptyMemory();
    return { phrases: parsed.phrases.slice(-80), skippedOnline: Number(parsed.skippedOnline) || 0 };
  } catch {
    return emptyMemory();
  }
}

let liveMemory: GuideMemory = emptyMemory();

function findHabit(raw: string, title: string) {
  const folded = habitKey(`${raw} ${title}`);
  return [...liveMemory.phrases]
    .filter((item) => item.key.length >= 2 && (folded.includes(item.key) || item.key.includes(habitKey(title))))
    .sort((left, right) => right.count - left.count || right.key.length - left.key.length)[0];
}

function rememberExpense(update: Extract<FinancialUpdate, { kind: "expense" }>): GuideMemory {
  const key = habitKey(update.title);
  if (key.length < 2 || key === "altele" || key === "cheltuiala") return liveMemory;
  const phrases = liveMemory.phrases.filter((item) => item.key !== key);
  phrases.push({
    key,
    title: update.title,
    category: update.category,
    allocationId: update.allocationId,
    sourceId: update.sourceId,
    count: (liveMemory.phrases.find((item) => item.key === key)?.count || 0) + 1,
    lastAt: new Date().toISOString(),
  });
  liveMemory = { phrases: phrases.slice(-80), skippedOnline: liveMemory.skippedOnline };
  return liveMemory;
}

function markLocalSave(): GuideMemory {
  liveMemory = { ...liveMemory, skippedOnline: liveMemory.skippedOnline + 1 };
  return liveMemory;
}

function seedMemory(current: GuideMemory, data: AppData): GuideMemory {
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

function localInsight(raw: string, data: AppData): string | undefined {
  const folded = foldRo(raw);
  if (!/cat (mai )?am|ramas|sold|situat|bilant|plicur|nealo|obicei|ce mai am|cat am pe/.test(folded)) return undefined;
  if (/adaug|cheltui|repartiz/.test(folded)) return undefined;
  const envelopes = data.settings.salaryPlan.allocations.map((envelope) => {
    const week = envelope.weeklyPace !== false ? allocationWeekStatus(data, envelope) : undefined;
    const left = week ? week.remaining : allocationStatus(data, envelope).remaining;
    return `• ${envelope.label}${week ? ` · S${week.index}` : ""}: ${money(left)}`;
  });
  const sources = data.settings.paymentSources.map((source) => `• Nealocat · ${source.name}: ${money(sourceBalance(data, source.id))}`);
  const known = liveMemory.phrases.filter((item) => item.count >= 2).slice(-6).map((item) => item.title);
  const learned = known.length ? `\nȚin minte de la tine: ${known.join(", ")}.` : "";
  return `Uite ce e disponibil, din registrul de pe telefon:${envelopes.length ? `\n${envelopes.join("\n")}` : ""}\n${sources.join("\n")}${learned}`;
}

type QuotaInfo = { remaining: number; limit: number; resetAt: string; mode: "online" | "local" };

function nextLocalMidnight() {
  const at = new Date();
  at.setHours(24, 0, 0, 0);
  return at.toISOString();
}

function emptyQuota(): QuotaInfo {
  return { remaining: DAILY_LIMIT, limit: DAILY_LIMIT, resetAt: nextLocalMidnight(), mode: "online" };
}

function consumeQuota(current: QuotaInfo, payload: { remaining?: number | null; limit?: number | null; resetAt?: string | null } | undefined, ok: boolean, exhausted: boolean): QuotaInfo {
  const resetAt = current.resetAt && Date.parse(current.resetAt) > Date.now() ? current.resetAt : nextLocalMidnight();
  const limit = current.limit || DAILY_LIMIT;
  if (exhausted) return { remaining: 0, limit, resetAt: payload?.resetAt || resetAt, mode: "local" };
  if (!ok) return { remaining: current.remaining, limit, resetAt, mode: current.remaining > 0 ? current.mode : "local" };
  const remaining = Math.max(0, current.remaining - 1);
  return { remaining, limit, resetAt, mode: remaining > 0 ? "online" : "local" };
}

function loadQuota(): QuotaInfo {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUOTA_KEY) || "null") as Partial<QuotaInfo> | null;
    if (!parsed || (parsed.mode !== "online" && parsed.mode !== "local")) return emptyQuota();
    if (!parsed.resetAt || Date.parse(parsed.resetAt) <= Date.now()) return emptyQuota();
    const used = Math.max(0, (Number(parsed.limit) || DAILY_LIMIT) - Number(parsed.remaining ?? DAILY_LIMIT));
    const remaining = Math.max(0, DAILY_LIMIT - used);
    return { remaining, limit: DAILY_LIMIT, resetAt: parsed.resetAt, mode: remaining <= 0 ? "local" : parsed.mode === "local" ? "local" : "online" };
  } catch {
    return emptyQuota();
  }
}

function formatReset(iso: string | null) {
  if (!iso) return "mâine";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "mâine";
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

function GuideQuotaBar({ quota, habits }: { quota: QuotaInfo; habits: number }) {
  const low = quota.mode === "online" && quota.remaining <= 8;
  const learned = habits > 0 ? ` · ${habits} obiceiuri învățate local` : "";
  const label = quota.mode === "local" || quota.remaining <= 0
    ? `Ghid local · ${quota.remaining} / ${quota.limit} mesaje online azi · se reia ${formatReset(quota.resetAt)}${learned}`
    : `Ghid online · ${quota.remaining} / ${quota.limit} mesaje rămase azi · se reia ${formatReset(quota.resetAt)}${learned}`;
  return (
    <div className={`ai-quota ${quota.mode === "local" || quota.remaining <= 0 ? "is-local" : low ? "is-low" : "is-ok"}`} aria-live="polite">
      <div className="ai-quota-track" aria-hidden="true"><i style={{ width: `${quotaPercent(quota)}%` }} /></div>
      <p>{label}</p>
    </div>
  );
}

function allAmounts(raw: string) {
  const matches = raw.match(/\d[\d.\s]*(?:,\d{1,2})?/g) || [];
  return matches.map((tokenRaw) => {
    const token = tokenRaw.replace(/\s/g, "");
    const normalized = token.includes(",") ? token.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(token) ? token.replace(/\./g, "") : token;
    return parseFloat(normalized) || 0;
  }).filter((value) => value >= 20);
}

function isConfirm(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return /^(da+|ok|okay|confirm|confirma|confirmat|sigur|adauga|adaug[- ]o|inregistreaza|salveaza)([.! ]*)?$/.test(folded);
}

function claimsSaved(raw: string) {
  return /am (adăugat|adaugat|înregistrat|inregistrat|trecut|notat|salvat)/i.test(raw);
}

function memberIdFor(data: AppData, hint: string, index = 0) {
  const folded = hint.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const members = data.settings.members;
  if (/sotie|sotiei|partenera|ea\b/.test(folded)) return members[1]?.id || members[0]?.id;
  if (/sot\b|sotul|el\b/.test(folded) && !/sotie/.test(folded)) return members[0]?.id;
  return members[index]?.id || members[0]?.id;
}

function parsePayday(raw: string) {
  const iso = raw.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso && Number(iso[2]) <= 12 && Number(iso[3]) <= 31) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (dmy && Number(dmy[2]) <= 12 && Number(dmy[1]) <= 31) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const months = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const named = folded.match(/\b(\d{1,2})\s*(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie|ian|feb|mar|apr|iun|iul|aug|sept|sep|oct|nov|dec)\.?\s*(20\d{2})?\b/);
  if (!named) return undefined;
  const monthToken = named[2].slice(0, 3);
  const monthIndex = months.findIndex((item) => item.startsWith(monthToken) || (monthToken === "sep" && item === "septembrie"));
  if (monthIndex < 0 || Number(named[1]) > 31) return undefined;
  const year = named[3] || String(new Date().getFullYear());
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
}

function parseWeeks(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = folded.match(/(\d{1,2})\s*(?:de\s+)?saptaman/);
  const value = match ? Number(match[1]) : 0;
  return value >= 2 && value <= 12 ? value : undefined;
}

function parseWeeklyAmount(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = folded.match(/(\d[\d .]*)\s*(?:lei|ron)?\s*(?:\/|pe)\s*saptaman/);
  return match ? allAmounts(match[1])[0] : undefined;
}

function parseAllocationUpdate(extracted: ExtractedGuide | undefined, userText: string): FinancialUpdate | undefined {
  const folded = userText.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const looksLikeEnvelope = Boolean(extracted?.category) || /plic|imparte|repartiz|aloc|aliment|saptaman/.test(folded);
  if (!looksLikeEnvelope) return undefined;
  const weeklyAmount = parseWeeklyAmount(userText);
  const amounts = allAmounts(userText).filter((value) => value !== weeklyAmount && value < 1900);
  let amount = extracted?.amount;
  if (!amount && amounts.length) {
    amount = /din (cei|cei|cele)|imparte din/.test(folded) && amounts.length >= 2 ? Math.min(...amounts.filter((value) => value >= 100)) : amounts.find((value) => value >= 100) || amounts[0];
  }
  if (!amount) return undefined;
  const category = extracted?.category
    || (/aliment/.test(folded) ? "Alimente" : /transport|taxi/.test(folded) ? "Transport" : /factura|casa|chirie/.test(folded) ? "Casă & facturi" : /econom/.test(folded) ? "Economii" : "Alimente");
  const weeks = parseWeeks(userText) || (weeklyAmount ? Math.round(amount / weeklyAmount) : 4);
  return { kind: "allocation", category, amount, weekly: true, weeklyAmount, weeks: weeks >= 2 && weeks <= 12 ? weeks : 4, payday: parsePayday(userText) };
}

type ExtractedGuide = {
  amount?: number;
  title?: string;
  category?: string;
  debtName?: string;
  monthlyPayment?: number;
  dueDay?: number;
  items?: Array<{ amount?: number; title?: string }>;
  vendor?: string;
  date?: string;
  receiptLines?: Array<{ name?: string; quantity?: number; amount?: number }>;
  totalLabel?: string;
  confidence?: "high" | "medium" | "low";
};

function relatedCategories(category: string) {
  const map: Record<string, string[]> = {
    Dulciuri: ["Alimente"],
    Băuturi: ["Alimente"],
    Apă: ["Alimente", "Casă & facturi"],
    Alimente: ["Dulciuri", "Băuturi"],
    Transport: [],
    "Casă & facturi": ["Apă"],
  };
  return map[category] || [];
}

function spendTitle(folded: string, extracted: ExtractedGuide | undefined, category: string) {
  if (/taxi|uber|bolt/.test(folded)) return "Taxi";
  if (/\bapa\b/.test(folded) && !/patiserie/.test(folded)) return "Apă";
  if (/dulce|prajitur|ciocolat/.test(folded)) return "Dulciuri";
  if (/tigar|tutun/.test(folded)) return "Țigări";
  if (/cafea/.test(folded)) return "Cafea";
  const cleaned = folded
    .replace(/\b(adaug[ae]?|adauga|cheltuiel[aei]*|lei|ron|pe data de|data de|alaltaieri|ieri|azi|astazi|maine|am uitat|sa trec|sa o trec|te rog|pentru|pe)\b/g, " ")
    .replace(/\d[\d.,]*/g, " ")
    .replace(/[^a-zăâîșț -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 3 && cleaned.length <= 42) {
    return cleaned.charAt(0).toLocaleUpperCase("ro-RO") + cleaned.slice(1);
  }
  if (extracted?.title && !/^(altele|cheltuial)/i.test(extracted.title)) return extracted.title;
  return category;
}

function spendAmount(raw: string, extracted: ExtractedGuide | undefined, parsedAmount: number) {
  if (extracted?.amount && extracted.amount > 0) return extracted.amount;
  if (parsedAmount > 0) return parsedAmount;
  const found: number[] = [];
  const pattern = /(?:^|[^\d])(\d{1,4}(?:[.,]\d{1,2})?)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const value = parseFloat(match[1].replace(",", "."));
    if (value >= 1 && value < 1900) found.push(value);
  }
  return found[0] || 0;
}

function spendDate(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\balaltaieri\b/.test(folded)) return shiftDay(-2);
  if (/\bieri\b/.test(folded)) return shiftDay(-1);
  if (/\bmaine\b/.test(folded)) return shiftDay(1);
  if (/\b(azi|astazi)\b/.test(folded)) return shiftDay(0);
  const dmy = raw.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}))?\b/);
  if (dmy && Number(dmy[2]) <= 12 && Number(dmy[1]) <= 31) {
    const year = dmy[3] || String(new Date().getFullYear());
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return shiftDay(0);
}

function dateCopy(iso: string) {
  const diff = Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${today()}T12:00:00`)) / 86400000);
  if (diff === 0) return "azi";
  if (diff === -1) return "ieri";
  if (diff === -2) return "alaltăieri";
  if (diff === 1) return "mâine";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(getLocale(), { day: "numeric", month: "short" });
}

function sourceTextSafe(raw: string) { return raw.replace(/data:[^ ]+/g, "").slice(0, 800); }

function isDebtOrInstallmentMessage(raw: string) {
  const folded = foldRo(raw);
  return /\b(credit|credite|datorie|datorii|sold restant|suma restanta|rata lunara|rate lunare|scadenta|scadente|imprumut|banca|bancii)\b/.test(folded)
    && !/\b(am platit|am achitat|plata ratei|achit rata)\b/.test(folded);
}

function expenseProposal(raw: string, extracted: ExtractedGuide | undefined, data: AppData, forced = false): { text: string; choices: ChatChoice[] } | undefined {
  if (isDebtOrInstallmentMessage(raw)) return undefined;
  const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]);
  const amount = spendAmount(raw, extracted, parsed.amount);
  if (!amount || amount <= 0) return undefined;
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const draftTitle = spendTitle(folded, extracted, parsed.category || "Altele");
  const habit = findHabit(raw, draftTitle);
  const looksSpend = forced
    || Boolean(habit)
    || /cheltui|adaug|inregist|platit|cumpar|cumpăr|taxi|uber|bolt|apa\b|dulce|dulciuri|tigar|tutun|factura|benzina|combustibil|mancare|uitat|\bpe |\bpentru /.test(folded)
    || Boolean(parsed.category && !/venit|salariu|intrare/.test(folded));
  if (!looksSpend || /venit|salariu|intrare/.test(folded)) return undefined;
  const category = (parsed.category && parsed.category !== "Altele") ? parsed.category : (habit?.category || extracted?.category || "Altele");
  const title = draftTitle === "Altele" && habit ? habit.title : draftTitle;
  const date = extracted?.date && /^20\d{2}-\d{2}-\d{2}$/.test(extracted.date) ? extracted.date : spendDate(raw);
  const when = dateCopy(date);
  const member = data.settings.members[0];
  const fallbackSource = data.settings.paymentSources.find((item) => item.memberId === member?.id) || data.settings.paymentSources[0];
  const related = relatedCategories(category);
  const funded = [...data.settings.salaryPlan.allocations]
    .map((envelope) => {
      const week = envelope.weeklyPace !== false ? allocationWeekStatus(data, envelope) : undefined;
      const left = week ? week.remaining : allocationStatus(data, envelope).remaining;
      return { envelope, week, left };
    })
    .filter((item) => item.left >= amount)
    .sort((left, right) => {
      const score = (item: typeof left) => {
        if (habit?.allocationId && item.envelope.id === habit.allocationId) return 6;
        if (habit?.category && item.envelope.category === habit.category) return 5;
        if (item.envelope.category === category) return 4;
        if (related.includes(item.envelope.category || "")) return 3;
        if ((item.envelope.category || item.envelope.label) === "Alimente") return 2;
        return 1;
      };
      return score(right) - score(left) || right.left - left.left;
    });
  const choices: ChatChoice[] = funded.map(({ envelope, week, left }) => ({
    label: `Din ${envelope.label}${week ? ` · S${week.index}` : ""} · ${money(left)}`,
    update: { kind: "expense" as const, amount, title, category, date, allocationId: envelope.id, sourceId: envelope.sourceId || fallbackSource?.id, memberId: envelope.memberId || member?.id },
  }));
  data.settings.paymentSources.forEach((source) => {
    const left = sourceBalance(data, source.id);
    if (left < amount) return;
    choices.push({
      label: `Din nealocat · ${source.name} · ${money(left)}`,
      update: { kind: "expense", amount, title, category, date, allocationId: "outside", sourceId: source.id, memberId: source.memberId || member?.id },
    });
  });
  if (!choices.length) {
    return { text: `Am înțeles **${title}**, ${money(amount)}, ${when}. Nu am găsit un plic sau o sursă cu destui bani disponibili.`, choices: [] };
  }
  const preferred = (habit?.allocationId && funded.find((item) => item.envelope.id === habit.allocationId))
    || funded.find((item) => item.envelope.category === category)
    || funded.find((item) => related.includes(item.envelope.category || ""));
  const usual = habit && habit.count >= 2;
  const text = preferred
    ? `Am înțeles **${title}**, ${money(amount)}, **${when}**.${receiptDetails(extracted)} ${usual ? `De obicei scoți din **${preferred.envelope.label}**.` : `Cea mai apropiată opțiune cu bani e **${preferred.envelope.label}**.`} Alege de unde scoatem banii.`
    : `Am înțeles **${title}**, ${money(amount)}, **${when}**.${receiptDetails(extracted)} Nu am un plic exact pentru ${category}. Alege din locurile unde sunt bani disponibili.`;
  return { text, choices };
}

function receiptDetails(extracted?: ExtractedGuide) {
  if (!extracted?.receiptLines?.length && !extracted?.confidence) return "";
  const lines = (extracted.receiptLines || []).slice(0, 8).filter((line) => line.name);
  const products = lines.length ? ` Produse citite: ${lines.map((line) => `${line.quantity && line.quantity !== 1 ? `${line.quantity}× ` : ""}${line.name}${line.amount ? ` ${money(line.amount)}` : ""}`).join(", ")}.` : " Produsele nu au fost suficient de lizibile.";
  const lineTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const difference = extracted.amount && lineTotal > 0 ? Math.round((extracted.amount - lineTotal) * 100) / 100 : 0;
  const reconciliation = extracted.amount
    ? lineTotal > 0
      ? Math.abs(difference) <= 0.01
        ? ` Total bon: **${money(extracted.amount)}**. Liniile se potrivesc cu totalul.`
        : ` Total bon: **${money(extracted.amount)}**. Liniile însumează **${money(lineTotal)}**; diferență de **${money(Math.abs(difference))}**${difference > 0 ? " (posibilă reducere sau linie necitită)" : " (verifică o posibilă citire dublă)"}.`
      : ` Total bon identificat: **${money(extracted.amount)}**.`
    : "";
  const confidence = extracted.confidence === "low" ? " Verifică atent suma; fotografia nu este suficient de clară." : "";
  return `${reconciliation}${products}${confidence}`;
}

function matchEnvelope(data: AppData, token: string) {
  const key = habitKey(token);
  if (key.length < 3) return undefined;
  return data.settings.salaryPlan.allocations.find((item) => {
    const hay = habitKey(`${item.label} ${item.category || ""}`);
    return hay.includes(key) || key.includes(hay);
  });
}

function incomeProposal(raw: string, data: AppData): { text: string; choices: ChatChoice[] } | undefined {
  const folded = foldRo(raw);
  if (!/venit|salariu|intrare|am primit|mi-a venit/.test(folded)) return undefined;
  if (/cheltui|tigar|tutun|taxi|suc|bere|paine|gume|factura/.test(folded) && !/salariu|venit/.test(folded)) return undefined;
  const amount = spendAmount(raw, undefined, 0);
  if (!amount || amount < 50) return undefined;
  const title = /sotie|sotiei|partener/.test(folded) ? "Salariul soției" : /salariu/.test(folded) ? "Salariu" : "Venit";
  const date = spendDate(raw);
  return {
    text: `Am înțeles **${title}**, ${money(amount)}, **${dateCopy(date)}**. Îl trec în registru pe ziua aleasă?`,
    choices: [{ label: `Adaugă venitul · ${money(amount)}`, update: { kind: "income", amount, title, date, memberId: memberIdFor(data, raw, /sotie|sotiei|partener/.test(folded) ? 1 : 0) } }],
  };
}

function transferProposal(raw: string, data: AppData): { text: string; choices: ChatChoice[] } | undefined {
  const folded = foldRo(raw);
  if (!/\b(mut[ae]|transfer|treci|realoc)/.test(folded)) return undefined;
  const amount = spendAmount(raw, undefined, 0);
  if (!amount) return undefined;
  const pair = folded.match(/\b(?:din|de pe)\s+([a-z0-9 &ăâîșț]+?)\s+(?:in|în|spre|catre|către)\s+([a-z0-9 &ăâîșț]+)/);
  if (!pair) return undefined;
  const from = matchEnvelope(data, pair[1]);
  const to = matchEnvelope(data, pair[2]);
  if (!from || !to || from.id === to.id) return undefined;
  const left = allocationStatus(data, from).remaining;
  if (left < amount) {
    return { text: `În **${from.label}** mai sunt ${money(left)}, nu ajung ${money(amount)} de mutat.`, choices: [] };
  }
  return {
    text: `Mut **${money(amount)}** din **${from.label}** în **${to.label}**? Banii rămân pe același card, se mută doar între plicuri.`,
    choices: [{ label: `Mută ${money(amount)}`, update: { kind: "transfer", amount, fromId: from.id, toId: to.id, fromLabel: from.label, toLabel: to.label } }],
  };
}

function updatesFromGuide(intent: string | undefined, extracted: ExtractedGuide | undefined, userText: string, data: AppData, history: ChatMessage[] = []): FinancialUpdate[] {
  const sourceText = allAmounts(userText).length ? userText : [...history].reverse().find((item) => item.role === "user" && allAmounts(item.text).length)?.text || userText;
  if (intent === "expense") return [];
  if (intent === "debt" && (extracted?.debtName || extracted?.title) && (extracted.amount || extracted.monthlyPayment)) {
    const updates: FinancialUpdate[] = [];
    if (extracted.amount) updates.push({ kind: "debt", name: extracted.debtName || extracted.title || "Datorie", remaining: extracted.amount, due: extracted.dueDay ? `Ziua ${extracted.dueDay}` : undefined });
    if (extracted.monthlyPayment) updates.push({ kind: "debt-monthly", amount: extracted.monthlyPayment, name: extracted.debtName || extracted.title || "Datorie" });
    return updates;
  }
  const envelope = parseAllocationUpdate(extracted, sourceText);
  if (intent === "allocation" || envelope && /plic|imparte|repartiz|aloc|aliment.*saptaman|saptaman/.test(sourceText.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
    if (envelope) return [envelope];
  }
  if (intent !== "income" && intent !== "next_step" && intent !== "summary") {
    if (!/venit|salariu|intrare|întrare/i.test(sourceText) && !extracted?.amount && !extracted?.items?.length) return [];
  }
  const named = (extracted?.items || []).filter((item): item is { amount: number; title?: string } => Boolean(item.amount && item.amount > 0));
  if (named.length) {
    return named.map((item, index) => ({ kind: "income" as const, amount: item.amount, title: item.title || (index ? "Salariu partener" : "Salariu"), date: spendDate(sourceText), memberId: memberIdFor(data, item.title || "", index) }));
  }
  const spoken = allAmounts(sourceText);
  if (spoken.length >= 2 && /salariu|venit|sotie|soție|partener|intrare|întrare/i.test(sourceText)) {
    return spoken.slice(0, 3).map((amount, index) => ({
      kind: "income" as const,
      amount,
      title: index === 0 ? "Salariu" : index === 1 ? "Salariu partener" : `Venit ${index + 1}`,
      date: spendDate(sourceText),
      memberId: memberIdFor(data, sourceText, index),
    }));
  }
  if (extracted?.amount) {
    return [{ kind: "income", amount: extracted.amount, title: extracted.title || "Venit lunar", date: spendDate(sourceText), memberId: memberIdFor(data, extracted.title || sourceText, 0) }];
  }
  if (spoken.length === 1 && /venit|salariu|intrare|întrare/i.test(sourceText)) {
    return [{ kind: "income", amount: spoken[0], title: /salariu/i.test(sourceText) ? "Salariu" : "Venit lunar", date: spendDate(sourceText), memberId: data.settings.members[0]?.id }];
  }
  return [];
}

/** Trece o intenție citită din text într-o acțiune pe care registrul o știe aplica. */
function intentToUpdate(intent: AssistantIntent, data?: AppData): FinancialUpdate {
  switch (intent.kind) {
    case "expense": {
      // Salvăm chiar sursa și plicul arătate în propunere, ca ce vede omul să fie ce se scrie.
      const plan = data ? planSpend(data, { amount: intent.amount, category: intent.category, date: intent.date }) : undefined;
      return { kind: "expense", amount: intent.amount, title: intent.title, category: intent.category, date: intent.date, sourceId: plan?.source?.source.id, allocationId: plan?.envelope?.allocation.id };
    }
    case "income": return { kind: "income", amount: intent.amount, title: intent.title, date: intent.date };
    case "envelope": return { kind: "allocation", label: intent.label, category: intent.category || intent.label, amount: intent.amount, weekly: intent.weeklyPace, weeklyAmount: intent.weeklyLimit };
    case "debt": return { kind: "debt", name: intent.name, remaining: intent.remaining };
    case "recurring": return { kind: "recurring", name: intent.name, amount: intent.amount, dueDay: intent.dueDay, category: intent.category };
    case "goal": return { kind: "goal", name: intent.name, target: intent.target, current: intent.current, dueDate: intent.dueDate };
    case "payday": return { kind: "payday", date: intent.date, flexDays: intent.flexDays };
  }
}

/** Ce spune asistentul înainte de confirmare — exact cifrele pe care le va scrie. */
/**
 * Ce a înțeles asistentul, scris pentru cineva care stă în magazin cu telefonul în
 * mână. La o cheltuială, „40 RON · Alimente” nu e destul ca să apeși pe salvează:
 * lipsește tocmai lucrul pe care îl decizi acolo — din ce sursă ies banii și din
 * ce plic se scad. `planSpend` alege propunerea; alternativele le poate atinge.
 */
function describeIntent(intent: AssistantIntent, data?: AppData): string {
  switch (intent.kind) {
    case "expense": {
      const head = `cheltuială ${money(intent.amount)} · ${intent.category} · ${formatDate(intent.date)}`;
      if (!data) return head;
      const plan = planSpend(data, { amount: intent.amount, category: intent.category, date: intent.date });
      return [head, plan.summary && `  ↳ ${plan.summary}`, ...plan.warnings.map((item) => `  ⚠ ${item}`)].filter(Boolean).join("\n");
    }
    case "income": {
      const head = `venit ${money(intent.amount)} · ${intent.title} · ${formatDate(intent.date)}`;
      if (!data) return head;
      const target = planIncome(data)[0];
      return target ? `${head}\n  ↳ intră în ${target.source.name} (${money(target.balance)} acum)` : head;
    }
    case "envelope": return `plicul „${intent.label}” cu ${money(intent.amount)}${intent.weeklyLimit ? `, limită săptămânală ${money(intent.weeklyLimit)}` : ""}`;
    case "debt": return `datoria „${intent.name}”, sold ${money(intent.remaining)}${intent.monthly ? `, rată ${money(intent.monthly)}` : ""}`;
    case "recurring": return `scadența „${intent.name}”, ${money(intent.amount)} pe data de ${intent.dueDay}`;
    case "goal": return `obiectivul „${intent.name}”, țintă ${money(intent.target)}${intent.current ? `, strâns ${money(intent.current)}` : ""}`;
    case "payday": return `următorul venit pe ${formatDate(intent.date, { day: "2-digit", month: "long", year: "numeric" })}${intent.flexDays ? `, cu ${intent.flexDays} zile de flexibilitate` : ""}`;
  }
}

/**
 * Alternativele la propunere: celelalte surse, fiecare cu soldul ei, gata de
 * atins. Fără ele, „schimbă sursa” ar însemna să anulezi și să reiei în formular.
 */
function sourceChoices(data: AppData, intent: Extract<AssistantIntent, { kind: "expense" }>, plan: SpendPlan): ChatChoice[] {
  /**
   * Sursele goale sunt zgomot: trei rânduri de „0 RON (nu acoperă)” nu ajută pe
   * nimeni să aleagă. Le ascundem, în afară de cazul în care chiar toate sunt
   * goale — atunci tăcerea ar fi și mai rea decât zgomotul.
   */
  const others = plan.sources.filter((option) => option.source.id !== plan.source?.source.id);
  const withMoney = others.filter((option) => option.balance > 0);
  return (withMoney.length ? withMoney : others)
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 4)
    .map((option) => ({
      label: `${option.source.name} · ${money(option.balance)}${option.covers ? "" : " (nu acoperă)"}`,
      update: {
        kind: "expense" as const,
        amount: intent.amount,
        title: intent.title,
        category: intent.category,
        date: intent.date,
        sourceId: option.source.id,
        allocationId: plan.envelopes.find((item) => item.allocation.sourceId === option.source.id)?.allocation.id,
      },
    }));
}

/** Alternativele se arată doar când mesajul conține exact o cheltuială; altfel ar fi ambiguu ce schimbă atingerea. */
function spendAlternatives(data: AppData, parsed: ParsedIntent[]): ChatChoice[] | undefined {
  if (parsed.length !== 1) return undefined;
  const intent = parsed[0].intent;
  if (intent.kind !== "expense") return undefined;
  const plan = planSpend(data, { amount: intent.amount, category: intent.category, date: intent.date });
  const choices = sourceChoices(data, intent, plan);
  return choices.length ? choices : undefined;
}

export function AICompanion({ data, view, onAdd, onGo, onNaturalEntry, onFinancialUpdate, onRevert }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [pendingDebtName, setPendingDebtName] = useState("");
  const [guideStage, setGuideStage] = useState<GuideStage>(() => { const saved = window.localStorage.getItem("buget-familie:ai-guide-stage-v1") as GuideStage | null; return saved || "income"; });
  const [messages, setMessages] = useState<ChatMessage[]>(() => { try { return JSON.parse(window.localStorage.getItem(CHAT_KEY) || "[]") as ChatMessage[]; } catch { return []; } });
  const [quota, setQuota] = useState<QuotaInfo>(() => loadQuota());
  const [memory, setMemory] = useState<GuideMemory>(() => {
    liveMemory = loadMemory();
    return liveMemory;
  });
  const [spendDay, setSpendDay] = useState(today);
  const lastSaveRef = useRef({ key: "", at: 0 });
  const monthSummary = useMemo(() => { const month = today().slice(0, 7); const current = data.transactions.filter((item) => item.date.startsWith(month)); return { income: current.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0), expense: current.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0) }; }, [data]);
  const todayPace = useMemo(() => Math.round(todayBrief(data).spendable), [data]);
  const contextReply = useMemo(() => { if (guideStage === "income") return "Sunt aici cu tine și te ghidez pas cu pas. Începem cu veniturile: ce bani intră într-o lună obișnuită — salariu, pensie, freelancing sau alte venituri? Spune-mi suma și îți pun prima bază în aplicație."; if (guideStage === "debts") return "Perfect, am notat venitul. Acum vreau să expunem toate obligațiile: ai credite, rate, carduri de cumpărături sau bani împrumutați? Spune-mi numele și soldul aproximativ. Dacă nu ai, spune doar «nu am datorii»."; if (guideStage === "rate") return `Am trecut „${pendingDebtName || "datoria"}”. Mai știi cât plătești lunar pentru ea? Dacă nu știi exact, spune o estimare sau «nu știu».`; if (guideStage === "allocation") return "Acum împărțim venitul: cât vrei să rezervi pentru mâncare, casă și facturi, transport și economii? Poți scrie într-o singură frază, de exemplu «alimente 1500, facturi 800, transport 400, economii 500»."; if (!data.transactions.length) return "Sunt aici cu tine. Poți să-mi scrii orice mișcare în cuvintele tale, iar eu o verific înainte să o salvez."; if (monthSummary.income > 0 && monthSummary.expense > monthSummary.income) return `M-am uitat la luna aceasta: ai ${money(monthSummary.expense)} cheltuieli și ${money(monthSummary.income)} venituri. Nu te judec — hai să vedem împreună ce ajustăm.`; return `Sunt cu tine în ${view === "today" ? "tabloul de azi" : "secțiunea deschisă"}. Spune-mi ce vrei să înțelegi sau să schimbi.`; }, [data, guideStage, monthSummary, pendingDebtName, view]);

  useEffect(() => { try { window.localStorage.setItem("buget-familie:ai-guide-stage-v1", guideStage); } catch { /* ignore */ } }, [guideStage]);
  useEffect(() => { if (!open || messages.length) return; setMessages([{ id: "welcome", role: "assistant", text: contextReply }]); }, [open, messages.length, contextReply]);
  useEffect(() => { try { window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30))); } catch { /* spațiu local indisponibil */ } }, [messages]);
  useEffect(() => {
    document.documentElement.classList.toggle("ai-guide-max", open && expanded);
    document.documentElement.classList.toggle("ai-guide-open", open);
    return () => {
      document.documentElement.classList.remove("ai-guide-max");
      document.documentElement.classList.remove("ai-guide-open");
    };
  }, [open, expanded]);
  useEffect(() => { try { window.localStorage.setItem(QUOTA_KEY, JSON.stringify(quota)); } catch { /* ignore */ } }, [quota]);
  useEffect(() => {
    liveMemory = memory;
    try { window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch { /* ignore */ }
  }, [memory]);
  useEffect(() => {
    setMemory((current) => {
      const next = seedMemory(current, data);
      liveMemory = next;
      return next;
    });
  }, [data.transactions.length]);
  useEffect(() => {
    if (quota.mode !== "local" || !quota.resetAt) return;
    const tick = () => {
      if (Date.parse(quota.resetAt) <= Date.now()) setQuota(emptyQuota());
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [quota.mode, quota.resetAt]);

  useEffect(() => {
    const root = historyRef.current;
    if (!root) return;
    root.scrollTop = root.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    const openGuide = () => { setOpen(true); setExpanded(false); };
    window.addEventListener("buget-familie:open-guide", openGuide);
    return () => window.removeEventListener("buget-familie:open-guide", openGuide);
  }, []);

  const addMessage = (entry: Omit<ChatMessage, "id">) => setMessages((current) => [...current, { ...entry, id: `${Date.now()}-${current.length}` }].slice(-30));
  const clearChat = () => {
    const hasPlan = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0;
    const stage: GuideStage = hasPlan ? "ready" : "income";
    const fresh: ChatMessage[] = [{ id: `welcome-${Date.now()}`, role: "assistant", text: "Am golit conversația. Mișcările și plicurile rămân în registru. Spune-mi cu ce vrei să începem." }];
    setMessages(fresh);
    setGuideStage(stage);
    setPendingDebtName("");
    try {
      window.localStorage.setItem(CHAT_KEY, JSON.stringify(fresh));
      window.localStorage.setItem("buget-familie:ai-guide-stage-v1", stage);
    } catch { /* ignore */ }
  };
  const runAction = (type: "add" | "plan" | "journal" | "insights", label: string) => { addMessage({ role: "user", text: label }); setTyping(true); window.setTimeout(() => { setTyping(false); addMessage({ role: "assistant", text: type === "add" ? "Deschid formularul. Completează ce mai lipsește și verifică înainte să salvezi." : type === "plan" ? "Deschid planul. Acolo așezăm veniturile pe destinații și ritmuri." : type === "journal" ? "Deschid jurnalul și ne uităm la mișcările care contează." : "Deschid analiza ca să vedem tiparele lunii.", action: { type, label: type === "add" ? "Deschide formularul" : type === "plan" ? "Vezi planul" : type === "journal" ? "Vezi jurnalul" : "Vezi analiza" } }); }, 260); };
  const handleAction = (item: ChatMessage) => {
    if (item.action?.type === "apply" && item.updates?.length) {
      item.updates.forEach((update) => onFinancialUpdate(update));
      addMessage({ role: "assistant", text: `Gata. ${item.updates.length === 1 ? "Am trecut-o" : "Le-am trecut"} în registru; poți corecta orice din ecranul respectiv.`, action: { type: "journal", label: "Vezi în Mișcări" } });
      return;
    }
    if (!item.action || item.action.type === "apply") return;
    if (item.action.type === "add") onAdd();
    else onGo(item.action.type);
    setOpen(false);
    setExpanded(false);
  };
  const applyChoice = (choice: ChatChoice) => {
    const day = spendDay || ((choice.update.kind === "expense" || choice.update.kind === "income") ? choice.update.date : undefined) || today();
    const stamp = `${choice.update.kind}|${"title" in choice.update ? choice.update.title : ""}|${"amount" in choice.update ? choice.update.amount : ""}|${day}|${choice.update.kind === "expense" ? choice.update.allocationId : ""}`;
    if (stamp === lastSaveRef.current.key && Date.now() - lastSaveRef.current.at < 900) return;
    lastSaveRef.current = { key: stamp, at: Date.now() };
    const update = choice.update.kind === "expense" || choice.update.kind === "income" ? { ...choice.update, date: day } : choice.update;
    onFinancialUpdate(update);
    if (update.kind === "expense") setMemory(rememberExpense(update));
    if (update.kind === "transfer") {
      addMessage({ role: "assistant", text: `Am mutat ${money(update.amount)} din **${update.fromLabel}** în **${update.toLabel}**.`, action: { type: "plan", label: "Vezi în Plan" } });
      return;
    }
    const spent = update.kind === "expense" || update.kind === "income" ? `${update.title} ${money(update.amount)}` : money("amount" in update ? update.amount : 0);
    addMessage({
      role: "assistant",
      text: `Am salvat ${spent} · ${choice.label} · ${dateCopy(day)}.`,
      action: { type: "journal", label: "Vezi în Mișcări" },
      undo: (update.kind === "expense" || update.kind === "income") ? { kind: update.kind, title: update.title, amount: update.amount, date: day } : undefined,
    });
  };
  const offerSpend = (proposal: { text: string; choices: ChatChoice[] }) => {
    const dated = proposal.choices.find((item) => (item.update.kind === "expense" || item.update.kind === "income") && item.update.date);
    if ((dated?.update.kind === "expense" || dated?.update.kind === "income") && dated.update.date) setSpendDay(dated.update.date);
    addMessage({ role: "assistant", text: proposal.text, choices: proposal.choices });
  };
  const applyGuide = (updates: FinancialUpdate[]) => {
    updates.forEach((update) => onFinancialUpdate(update));
    if (updates.some((update) => update.kind === "income")) setGuideStage("debts");
  };
  const firstAmount = (raw: string) => { const match = raw.match(/\d[\d\s.]*(?:,\d{1,2})?/); if (!match) return 0; const token = match[0].replace(/\s/g, ""); const normalized = token.includes(",") ? token.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(token) ? token.replace(/\./g, "") : token; return parseFloat(normalized) || 0; };
  const localSend = (alreadyAdded = false, draft = message) => { const raw = draft.trim(); if (!raw) return; setMessage(""); if (!alreadyAdded) addMessage({ role: "user", text: raw }); const amount = firstAmount(raw); const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); setTyping(true); window.setTimeout(() => { setTyping(false);
    /**
     * Intențiile explicite au prioritate față de ghidul pas cu pas. Aici era eroarea:
     * cât timp ghidul aștepta un venit, orice mesaj cu cifre era citit ca venit, deci o
     * cerere de plic devenea „salariu 600 lei”. Lăsăm ghidul să răspundă doar când
     * utilizatorul chiar spune lucrul pe care ghidul îl cere.
     */
    const stageKind = guideStage === "income" ? "income" : guideStage === "debts" || guideStage === "rate" ? "debt" : guideStage === "allocation" ? "envelope" : undefined;
    const intents = parseAssistantMessage(raw, { asOf: isoToday(), categories: [...expenseCategories, ...data.settings.customCategories] });
    const actionable = stageKind ? intents.filter((item) => item.intent.kind !== stageKind) : intents;
    if (actionable.length) {
      addMessage({
        role: "assistant",
        text: `${actionable.length === 1 ? "Am înțeles" : `Am înțeles ${actionable.length} lucruri`}:\n${actionable.map((item) => `• ${describeIntent(item.intent, data)}`).join("\n")}\n\nConfirmi să le trec în registru?`,
        updates: actionable.map((item) => intentToUpdate(item.intent, data)),
        action: { type: "apply", label: actionable.length === 1 ? "Confirmă și salvează" : "Confirmă pe toate" },
        choices: spendAlternatives(data, actionable),
      });
      return;
    }
    // Aceeași analiză locală și când nu există rețea: datele sunt tot pe telefon.
    const offlineAnalysis = analyze(raw, data);
    if (offlineAnalysis) {
      addMessage({ role: "assistant", text: answerToText(offlineAnalysis), followUps: offlineAnalysis.followUps });
      return;
    }
    if (guideStage === "income") { if (!amount) { addMessage({ role: "assistant", text: "Am nevoie doar de o sumă aproximativă. De exemplu: «salariul meu este 6.500 lei pe lună»." }); return; } onFinancialUpdate({ kind: "income", amount, title: /salariu/i.test(folded) ? "Salariu lunar" : "Venit lunar" }); setGuideStage("debts"); addMessage({ role: "assistant", text: `Am notat ${money(amount)} ca venit lunar. Următoarea întrebare: ai datorii, credite, rate sau carduri de cumpărături?` }); return; } if (guideStage === "debts") { if (/nu\s+(am|exista)|fara\s+datorii|niciuna/.test(folded)) { setGuideStage("allocation"); addMessage({ role: "assistant", text: "În regulă, fără datorii. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii. Ce sume vrei să rezervi?" }); return; } if (!amount) { addMessage({ role: "assistant", text: "Spune-mi, de exemplu: «Credit auto, mai am 18.000 lei» sau «rată la bancă, sold 42.000 lei»." }); return; } const debtName = raw.replace(/\d[\d.,\s]*(?:lei|ron)?/gi, "").replace(/(mai am|sold|datorie|credit|rata|rată|la banca|la bancă)/gi, "").replace(/[,:-]/g, " ").trim() || "Datorie"; setPendingDebtName(debtName); onFinancialUpdate({ kind: "debt", name: debtName, remaining: amount }); setGuideStage("rate"); addMessage({ role: "assistant", text: `Am trecut „${debtName}” cu soldul de ${money(amount)}. Cât plătești lunar pentru această datorie?` }); return; } if (guideStage === "rate") { if (amount) onFinancialUpdate({ kind: "debt-monthly", amount }); setGuideStage("allocation"); addMessage({ role: "assistant", text: amount ? `Am notat rata de ${money(amount)}. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii.` : "În regulă, lăsăm rata de completat mai târziu. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii." }); return; } if (guideStage === "allocation") { const categories = ["alimente", "facturi", "casa", "transport", "economii", "datorii"]; const found = categories.map((category) => { const match = folded.match(new RegExp(`${category}[^\\d]{0,18}(\\d[\\d.,]*)`)); return match ? { category, amount: firstAmount(match[1]) } : undefined; }).filter((item): item is { category: string; amount: number } => Boolean(item?.amount)); if (!found.length) { addMessage({ role: "assistant", text: "Nu am găsit categoriile și sumele. Scrie simplu: «alimente 1500, facturi 800, transport 400, economii 500»." }); return; } found.forEach((item) => onFinancialUpdate({ kind: "allocation", category: item.category === "facturi" || item.category === "casa" ? "Casă & facturi" : item.category[0].toLocaleUpperCase("ro-RO") + item.category.slice(1), amount: item.amount, weekly: item.category === "alimente" || item.category === "transport" })); setGuideStage("ready"); addMessage({ role: "assistant", text: `Am repartizat ${found.map((item) => `${item.category} ${money(item.amount)}`).join(", ")}. Putem ajusta orice sumă. De acum sunt disponibil să urmărim împreună cheltuielile, veniturile și ritmul lunii.` }); return; } const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]); if (!parsed.understood) { addMessage({ role: "assistant", text: "Spune-mi suma și ce ai plătit, de exemplu: «am cheltuit 50 de lei pe combustibil»." }); return; } const proposal = expenseProposal(raw, { amount: parsed.amount, category: parsed.category, title: naturalTitle(raw, parsed.category) }, data); if (proposal) { offerSpend(proposal); return; } addMessage({ role: "assistant", text: `Am înțeles ${parsed.title}, ${money(parsed.amount)}. Alege de unde scoatem banii.` }); }, 420); };

  const handleAttachment = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/i.test(file.type)) {
      addMessage({ role: "assistant", text: "Pot analiza imagini JPG, PNG, WEBP și fișiere PDF. Alege un bon într-unul dintre aceste formate." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      addMessage({ role: "assistant", text: "Fișierul este prea mare pentru analiza online. Alege un bon de maximum 8 MB." });
      return;
    }
    setAttachmentBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read")); reader.onerror = () => reject(reader.error || new Error("read")); reader.readAsDataURL(file); });
      setAttachment({ name: file.name, mimeType: file.type, data });
    } catch {
      addMessage({ role: "assistant", text: "Nu am putut citi fișierul. Încearcă din nou cu o fotografie clară a bonului." });
    } finally { setAttachmentBusy(false); }
  };

  const send = (draft?: string) => {
    const raw = (draft ?? message).trim();
    if (!raw && !attachment) return;
    const requestText = raw || "Analizează bonul atașat și propune cheltuiala.";
    const sentAttachment = attachment;
    setMessage("");
    setAttachment(null);
    addMessage({ role: "user", text: sentAttachment ? `${raw || "Analizează bonul atașat."} 📎 ${sentAttachment.name}` : raw });
    const pending = [...messages].reverse().find((item) => item.role === "assistant" && item.choices?.length);
    if (pending?.choices?.length && isConfirm(raw)) {
      if (pending.choices.length === 1) {
        applyChoice(pending.choices[0]);
        return;
      }
      addMessage({ role: "assistant", text: "Alege plicul sau sursa de mai sus — nu salvez până apeși o opțiune." });
      return;
    }
    if (isConfirm(raw)) {
      const lastSpend = [...messages].reverse().find((item) => item.role === "user" && expenseProposal(item.text, undefined, data));
      const recovered = lastSpend ? expenseProposal(lastSpend.text, undefined, data, true) : undefined;
      if (recovered) {
        offerSpend(recovered);
        return;
      }
    }
    /**
     * Intențiile scrise limpede se rezolvă local, înaintea oricărei propuneri euristice
     * și înaintea drumului la server. Aici era eroarea vizibilă: „fă-mi plic … 2400 … cu
     * limita săptămânală 600 lei” cădea în propunerea de venit, care lua prima sumă
     * găsită. Așa răspunsul e imediat, funcționează offline și nu depinde de model.
     */
    if (!sentAttachment) {
      const intents = parseAssistantMessage(requestText, { asOf: isoToday(), categories: [...expenseCategories, ...data.settings.customCategories] });
      if (intents.length) {
        setMemory(markLocalSave());
        addMessage({
          role: "assistant",
          text: `${intents.length === 1 ? "Am înțeles" : `Am înțeles ${intents.length} lucruri`}:\n${intents.map((item) => `• ${describeIntent(item.intent, data)}`).join("\n")}\n\nConfirmi să le trec în registru?`,
          updates: intents.map((item) => intentToUpdate(item.intent, data)),
          action: { type: "apply", label: intents.length === 1 ? "Confirmă și salvează" : "Confirmă pe toate" },
          choices: spendAlternatives(data, intents),
        });
        return;
      }
    }
    /**
     * Analistul local, înaintea oricărei propuneri de înregistrare. „Îmi permit 500
     * de lei pe alimente?” este o întrebare, dar are formă de cheltuială: citită de
     * `expenseProposal`, devenea o cerere de a scoate 500 de lei din plic. Analistul
     * returnează `undefined` pentru cererile reale de înregistrare, deci nu fură nimic.
     *
     * Răspunde din registrul de pe telefon: instant, fără rețea, fără să consume cota.
     */
    const analysis = analyze(raw, data);
    if (analysis) {
      setMemory(markLocalSave());
      addMessage({ role: "assistant", text: answerToText(analysis), followUps: analysis.followUps });
      return;
    }
    const spendNow = expenseProposal(requestText, undefined, data);
    if (spendNow) {
      setMemory(markLocalSave());
      offerSpend(spendNow);
      return;
    }
    const moved = transferProposal(requestText, data);
    if (moved) {
      setMemory(markLocalSave());
      offerSpend(moved);
      return;
    }
    const incomeNow = incomeProposal(requestText, data);
    if (incomeNow) {
      setMemory(markLocalSave());
      offerSpend(incomeNow);
      return;
    }
    const insight = localInsight(raw, data);
    if (insight) {
      setMemory(markLocalSave());
      addMessage({ role: "assistant", text: insight });
      return;
    }
    const blocked = quota.mode === "local" || quota.remaining <= 0;
    if (blocked) {
      setQuota((current) => ({ ...current, mode: "local", remaining: Math.min(current.remaining, 0) }));
      localSend(true, raw);
      return;
    }
    setTyping(true);
    void (async () => {
      try {
        let onlineRequestText = requestText;
        let localReceiptAmount: number | undefined;
        if (sentAttachment?.mimeType.startsWith("image/")) {
          try {
            const { readReceiptLocally } = await import("@/lib/receipt-utils");
            const local = await readReceiptLocally([sentAttachment.data]);
            localReceiptAmount = local.amount;
            const ocrItems = local.items.slice(0, 40).map((item) => `${item.label}=${item.amount}`).join("; ");
            const ocrHint = [
              "[OCR local de verificare — nu este autoritate contabilă]",
              local.vendor ? `magazin: ${local.vendor}` : "",
              local.date ? `data: ${local.date}` : "",
              local.amount ? `total candidat: ${local.amount}` : "",
              ocrItems ? `produse: ${ocrItems}` : "",
              local.text ? `text brut: ${local.text.slice(0, 5000)}` : "",
            ].filter(Boolean).join("\n");
            onlineRequestText = `${requestText}\n\n${ocrHint}`;
          } catch {
            // Analiza vizuală online rămâne disponibilă și fără OCR local.
          }
        }
        const response = await fetch("https://europe-central2-buget-familie-a6a0d.cloudfunctions.net/aiGuide", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: [...messages, { role: "user", text: onlineRequestText, attachments: sentAttachment ? [sentAttachment] : undefined }].slice(-20), context: { view, income: monthSummary.income, expense: monthSummary.expense, members: data.settings.members.map((item) => ({ id: item.id, name: item.name })), transactions: data.transactions.slice(0, 30), debts: data.debts, allocations: data.settings.salaryPlan.allocations } }),
        });
        const payload = await response.json() as {
          reply?: string;
          intent?: string;
          needsConfirmation?: boolean;
          extracted?: ExtractedGuide;
          quota?: { remaining?: number | null; limit?: number | null; resetAt?: string | null };
          code?: string;
        };
        const nextQuota = consumeQuota(quota, payload.quota, response.ok, response.status === 429 || payload.code === "quota");
        setQuota(nextQuota);
        if (!response.ok) throw new Error(payload.code || "AI unavailable");
        setTyping(false);
        const receiptExtracted = sentAttachment && localReceiptAmount && localReceiptAmount > 0
          ? { ...payload.extracted, amount: localReceiptAmount }
          : payload.extracted;
        const lastSpendText = [...messages].reverse().find((item) => item.role === "user" && expenseProposal(item.text, undefined, data))?.text || requestText;
        const extractedText = payload.extracted?.vendor ? `${sourceTextSafe(requestText)} ${payload.extracted.vendor}` : requestText;
        const sourceText = isConfirm(raw) ? lastSpendText : extractedText;
        const proposal = payload.intent === "income" || payload.intent === "allocation" || payload.intent === "debt"
          ? undefined
          : expenseProposal(sourceText, receiptExtracted, data, Boolean(sentAttachment) || payload.intent === "expense" || /cheltuial/.test(payload.reply || ""));
        if (proposal) {
          offerSpend(proposal);
          return;
        }
        const updates = updatesFromGuide(payload.intent, payload.extracted, raw, data, messages);
        const saveNow = updates.length > 0 && (!payload.needsConfirmation || isConfirm(raw) || claimsSaved(payload.reply || "") || payload.intent === "income" || payload.intent === "allocation" || payload.intent === "debt");
        if (saveNow) applyGuide(updates);
        addMessage({
          role: "assistant",
          text: payload.reply || "Am analizat mesajul. Spune-mi ce vrei să facem în continuare.",
          action: saveNow && updates.some((update) => update.kind === "income")
            ? { type: "journal", label: "Vezi în Mișcări" }
            : saveNow && updates.some((update) => update.kind === "allocation")
              ? { type: "plan", label: "Vezi tranșele în Plan" }
              : !saveNow && updates.length
              ? { type: "apply", label: `Adaugă ${updates.filter((update) => "amount" in update).map((update) => money((update as { amount: number }).amount)).join(" + ")} în registru` }
              : undefined,
          updates: !saveNow && updates.length ? updates : undefined,
        });
      } catch {
        setQuota((current) => current.remaining <= 0 ? { ...current, mode: "local", remaining: 0 } : current);
        setTyping(false);
        localSend(true, raw);
      }
    })();
  };
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
  const pendingKind = lastAssistant?.choices?.find((item) => item.update.kind === "expense" || item.update.kind === "income")?.update.kind;
  const pendingSpend = Boolean(pendingKind);
  return <><button type="button" className="os-ghid" hidden aria-hidden="true" tabIndex={-1}><span className="os-ghid-bf">BF</span><span className="os-ghid-label">{t("Ghidul tău")}</span>{open ? <ChevronDown size={14} /> : <span className="os-ghid-pace">Azi {todayPace} RON</span>}</button>{open && <aside className={`ai-companion-panel ai-chat-panel ${expanded ? "is-max" : ""}`} aria-label={t("Conversație cu ghidul tău AI")}><header className="ai-companion-head"><div className="ai-avatar"><Bot size={18} /></div><div className="ai-head-copy"><p className="ai-eyebrow">GHIDUL TĂU · {quota.mode === "local" ? "LOCAL" : "ONLINE"}</p><h2>{t("Sunt aici cu tine")}</h2><span className={`ai-status ${quota.mode === "local" ? "is-local" : ""}`}><i /> {quota.mode === "local" ? `Ghid local până ${formatReset(quota.resetAt)}` : "Îți răspund din contextul bugetului tău"}</span></div><div className="ai-head-actions"><button type="button" className="ai-tool" onClick={clearChat}><Trash2 size={15} /><span>{t("Golește")}</span></button><button type="button" className="ai-tool" onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{expanded ? "Micșorează" : "Ecran"}</span></button><button type="button" className="ai-tool ai-tool-close" aria-label={t("Închide ghidul")} onClick={() => { setOpen(false); setExpanded(false); }}><X size={16} /></button></div></header><GuideQuotaBar quota={quota} habits={memory.phrases.filter((item) => item.count >= 2).length} /><div className="ai-chat-history" ref={historyRef} aria-live="polite">{messages.map((item) => <div className={`ai-chat-row ${item.role}`} key={item.id}><div className="ai-chat-bubble">{item.role === "assistant" && <Bot size={14} /> }<GuideText text={item.text} /></div>{item.action && <button type="button" className="ai-chat-action" onClick={() => handleAction(item)}><CircleCheck size={14} /> {item.action.label}</button>}{item.undo && onRevert && <button type="button" className="ai-chat-action" onClick={() => { const undone = item.undo; if (!undone) return; onRevert(undone); setMessages((current) => current.map((entry) => entry.id === item.id ? { ...entry, undo: undefined, text: `Am anulat ${undone.title} ${money(undone.amount)}.` } : entry)); }}>{t("Anulează")}</button>}{item.choices && item.choices.length > 0 && <div className="ai-chat-choices">{item.choices.map((choice) => <button type="button" className="ai-chat-action" key={choice.label} onClick={() => applyChoice(choice)}>{choice.label}</button>)}</div>}{item.followUps && item.followUps.length > 0 && <div className="ai-chat-followups">{item.followUps.map((question) => <button type="button" key={question} onClick={() => send(question)}>{question}</button>)}</div>}</div>)}{typing && <div className="ai-chat-row assistant"><div className="ai-chat-bubble ai-typing"><i /><i /><i /></div></div>}</div>{pendingSpend ? <div className="ai-date-bar"><p>Pe ce zi treci {pendingKind === "income" ? "venitul" : "mișcarea"}? · {dateCopy(spendDay)}</p><div className="ai-date-row"><button type="button" className={`ai-date-chip ${spendDay === shiftDay(-2) ? "is-on" : ""}`} onClick={() => setSpendDay(shiftDay(-2))}>{t("Alaltăieri")}</button><button type="button" className={`ai-date-chip ${spendDay === shiftDay(-1) ? "is-on" : ""}`} onClick={() => setSpendDay(shiftDay(-1))}>Ieri</button><button type="button" className={`ai-date-chip ${spendDay === shiftDay(0) ? "is-on" : ""}`} onClick={() => setSpendDay(shiftDay(0))}>Azi</button><label className="ai-date-field">Calendar<input type="date" value={spendDay} onChange={(event) => event.target.value && setSpendDay(event.target.value)} /></label></div></div> : null}<div className="ai-chat-suggestions"><button type="button" onClick={() => runAction("add", "Vreau să adaug o mișcare")}>{t("+ Adaugă o mișcare")}</button>{SUGGESTED_QUESTIONS.map((question) => <button type="button" key={question} onClick={() => send(question)}>{question}</button>)}</div><form className="ai-natural-form ai-chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><label htmlFor="ai-natural-message">{t("Scrie-mi orice despre banii tăi sau încarcă un bon")}</label>{attachment && <div className="ai-attachment-chip"><FileText size={14} /><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label={t("Elimină atașamentul")}>×</button></div>}<div><input id="ai-natural-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={attachment ? t("Opțional: spune-mi ceva despre bon") : t("ex. am dat 50 lei pe benzină")} /><label className="ai-attach-button" aria-label={t("Atașează bon sau fișier")}><Paperclip size={16} /><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={(event) => { void handleAttachment(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={attachmentBusy || typing} /></label><button type="submit" aria-label="Trimite mesajul" disabled={attachmentBusy || typing || (!message.trim() && !attachment)}><Send size={16} /></button></div><p><Lightbulb size={12} /> {t("Scrie firesc: „am dat 50 lei pe benzină”, „fă-mi plic Alimente 2400 cu limită săptămânală 600”, „următorul salariu pe 07.10.2026”, „datorie card 1800, rata 150”. Îți arăt ce am înțeles și salvez doar după confirmarea ta.")}</p></form><p className="ai-privacy"><WalletCards size={13} /> Conversația și obiceiurile rămân pe acest telefon. Ghidul local învață din alegerile tale ca să consume mai puțin Gemini.</p></aside>}</>;
}

export default AICompanion;
