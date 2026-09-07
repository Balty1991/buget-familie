import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bot, ChevronDown, CircleCheck, Lightbulb, Maximize2, Minimize2, Send, Trash2, WalletCards, X } from "lucide-react";
import { allocationStatus, allocationWeekStatus, expenseCategories, parseNaturalSpendScenario, sourceBalance, type AppData, type Transaction } from "@/lib/finance-data";
import { todayBrief } from "@/lib/household-insights";
import type { MainView } from "@/pages/home-kit";
import "../ai-companion.css";

export type NaturalDraft = Pick<Transaction, "amount" | "category" | "title" | "kind"> & { date?: string; note?: string };
export type GuidedRevert = { kind: "income" | "expense"; title: string; amount: number; date: string };
export type FinancialUpdate =
  | { kind: "income"; amount: number; title: string; date?: string; memberId?: string }
  | { kind: "expense"; amount: number; title: string; category: string; date?: string; allocationId?: string; sourceId?: string; memberId?: string }
  | { kind: "debt"; name: string; remaining: number }
  | { kind: "debt-monthly"; amount: number }
  | { kind: "allocation"; category: string; amount: number; weekly: boolean; weeklyAmount?: number; weeks?: number; payday?: string }
  | { kind: "transfer"; amount: number; fromId: string; toId: string; fromLabel: string; toLabel: string };
type Props = { data: AppData; view: MainView; onAdd: () => void; onGo: (view: MainView) => void; onNaturalEntry: (draft: NaturalDraft) => void; onFinancialUpdate: (update: FinancialUpdate) => void; onRevert?: (item: GuidedRevert) => void };
type ChatChoice = { label: string; update: FinancialUpdate };
type ChatMessage = { id: string; role: "assistant" | "user"; text: string; action?: { label: string; type: "add" | "plan" | "journal" | "insights" | "apply" }; updates?: FinancialUpdate[]; choices?: ChatChoice[]; undo?: GuidedRevert };
type GuideStage = "income" | "debts" | "rate" | "allocation" | "ready";
const CHAT_KEY = "buget-familie:ai-chat-v1";
const shiftDay = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const today = () => shiftDay(0);
const money = (value: number) => `${Math.round(value).toLocaleString("ro-RO")} RON`;
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
  return `${at.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} la ${time}`;
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
  items?: Array<{ amount?: number; title?: string }>;
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
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

function expenseProposal(raw: string, extracted: ExtractedGuide | undefined, data: AppData, forced = false): { text: string; choices: ChatChoice[] } | undefined {
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
  const date = spendDate(raw);
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
    ? `Am înțeles **${title}**, ${money(amount)}, **${when}**. ${usual ? `De obicei scoți din **${preferred.envelope.label}**.` : `Cea mai apropiată opțiune cu bani e **${preferred.envelope.label}**.`} Alege de unde scoatem banii.`
    : `Am înțeles **${title}**, ${money(amount)}, **${when}**. Nu am un plic exact pentru ${category}. Alege din locurile unde sunt bani disponibili.`;
  return { text, choices };
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
    return [{ kind: "debt", name: extracted.debtName || extracted.title || "Datorie", remaining: extracted.amount || 0 }];
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

export function AICompanion({ data, view, onAdd, onGo, onNaturalEntry, onFinancialUpdate, onRevert }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
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
    return () => document.documentElement.classList.remove("ai-guide-max");
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
      addMessage({ role: "assistant", text: `Am trecut ${item.updates.map((update) => `${update.kind === "income" ? update.title : update.kind} ${"amount" in update ? money(update.amount) : ""}`.trim()).join(" și ")} în registru.`, action: { type: "journal", label: "Vezi în Mișcări" } });
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
  const localSend = (alreadyAdded = false, draft = message) => { const raw = draft.trim(); if (!raw) return; setMessage(""); if (!alreadyAdded) addMessage({ role: "user", text: raw }); const amount = firstAmount(raw); const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); setTyping(true); window.setTimeout(() => { setTyping(false); if (guideStage === "income") { if (!amount) { addMessage({ role: "assistant", text: "Am nevoie doar de o sumă aproximativă. De exemplu: «salariul meu este 6.500 lei pe lună»." }); return; } onFinancialUpdate({ kind: "income", amount, title: /salariu/i.test(folded) ? "Salariu lunar" : "Venit lunar" }); setGuideStage("debts"); addMessage({ role: "assistant", text: `Am notat ${money(amount)} ca venit lunar. Următoarea întrebare: ai datorii, credite, rate sau carduri de cumpărături?` }); return; } if (guideStage === "debts") { if (/nu\s+(am|exista)|fara\s+datorii|niciuna/.test(folded)) { setGuideStage("allocation"); addMessage({ role: "assistant", text: "În regulă, fără datorii. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii. Ce sume vrei să rezervi?" }); return; } if (!amount) { addMessage({ role: "assistant", text: "Spune-mi, de exemplu: «Credit auto, mai am 18.000 lei» sau «rată la bancă, sold 42.000 lei»." }); return; } const debtName = raw.replace(/\d[\d.,\s]*(?:lei|ron)?/gi, "").replace(/(mai am|sold|datorie|credit|rata|rată|la banca|la bancă)/gi, "").replace(/[,:-]/g, " ").trim() || "Datorie"; setPendingDebtName(debtName); onFinancialUpdate({ kind: "debt", name: debtName, remaining: amount }); setGuideStage("rate"); addMessage({ role: "assistant", text: `Am trecut „${debtName}” cu soldul de ${money(amount)}. Cât plătești lunar pentru această datorie?` }); return; } if (guideStage === "rate") { if (amount) onFinancialUpdate({ kind: "debt-monthly", amount }); setGuideStage("allocation"); addMessage({ role: "assistant", text: amount ? `Am notat rata de ${money(amount)}. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii.` : "În regulă, lăsăm rata de completat mai târziu. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii." }); return; } if (guideStage === "allocation") { const categories = ["alimente", "facturi", "casa", "transport", "economii", "datorii"]; const found = categories.map((category) => { const match = folded.match(new RegExp(`${category}[^\\d]{0,18}(\\d[\\d.,]*)`)); return match ? { category, amount: firstAmount(match[1]) } : undefined; }).filter((item): item is { category: string; amount: number } => Boolean(item?.amount)); if (!found.length) { addMessage({ role: "assistant", text: "Nu am găsit categoriile și sumele. Scrie simplu: «alimente 1500, facturi 800, transport 400, economii 500»." }); return; } found.forEach((item) => onFinancialUpdate({ kind: "allocation", category: item.category === "facturi" || item.category === "casa" ? "Casă & facturi" : item.category[0].toLocaleUpperCase("ro-RO") + item.category.slice(1), amount: item.amount, weekly: item.category === "alimente" || item.category === "transport" })); setGuideStage("ready"); addMessage({ role: "assistant", text: `Am repartizat ${found.map((item) => `${item.category} ${money(item.amount)}`).join(", ")}. Putem ajusta orice sumă. De acum sunt disponibil să urmărim împreună cheltuielile, veniturile și ritmul lunii.` }); return; } const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]); if (!parsed.understood) { addMessage({ role: "assistant", text: "Spune-mi suma și ce ai plătit, de exemplu: «am cheltuit 50 de lei pe combustibil»." }); return; } const proposal = expenseProposal(raw, { amount: parsed.amount, category: parsed.category, title: naturalTitle(raw, parsed.category) }, data); if (proposal) { offerSpend(proposal); return; } addMessage({ role: "assistant", text: `Am înțeles ${parsed.title}, ${money(parsed.amount)}. Alege de unde scoatem banii.` }); }, 420); };

  const send = () => {
    const raw = message.trim();
    if (!raw) return;
    setMessage("");
    addMessage({ role: "user", text: raw });
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
    const spendNow = expenseProposal(raw, undefined, data);
    if (spendNow) {
      setMemory(markLocalSave());
      offerSpend(spendNow);
      return;
    }
    const moved = transferProposal(raw, data);
    if (moved) {
      setMemory(markLocalSave());
      offerSpend(moved);
      return;
    }
    const incomeNow = incomeProposal(raw, data);
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
        const response = await fetch("https://europe-central2-buget-familie-a6a0d.cloudfunctions.net/aiGuide", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: [...messages, { role: "user", text: raw }].slice(-20), context: { view, income: monthSummary.income, expense: monthSummary.expense, members: data.settings.members.map((item) => ({ id: item.id, name: item.name })), transactions: data.transactions.slice(0, 30), debts: data.debts, allocations: data.settings.salaryPlan.allocations } }),
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
        const lastSpendText = [...messages].reverse().find((item) => item.role === "user" && expenseProposal(item.text, undefined, data))?.text || raw;
        const sourceText = isConfirm(raw) ? lastSpendText : raw;
        const proposal = payload.intent === "income" || payload.intent === "allocation" || payload.intent === "debt"
          ? undefined
          : expenseProposal(sourceText, payload.extracted, data, payload.intent === "expense" || /cheltuial/.test(payload.reply || ""));
        if (proposal) {
          offerSpend(proposal);
          return;
        }
        const updates = updatesFromGuide(payload.intent, payload.extracted, raw, data, messages);
        const saveNow = updates.length > 0 && (!payload.needsConfirmation || isConfirm(raw) || claimsSaved(payload.reply || "") || payload.intent === "income" || payload.intent === "allocation");
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
  return <><button type="button" className={`os-ghid ${open ? "is-open" : ""} ${quota.mode === "local" ? "is-local" : ""}`} hidden={open && expanded} aria-label={open ? "Închide ghidul AI" : "Deschide ghidul AI"} onClick={() => { setOpen((value) => !value); if (open) setExpanded(false); }}><span className="os-ghid-bf">BF</span><span className="os-ghid-label">Ghidul tău</span>{open ? <ChevronDown size={14} /> : <span className="os-ghid-pace">Azi {todayPace} RON</span>}</button>{open && <aside className={`ai-companion-panel ai-chat-panel ${expanded ? "is-max" : ""}`} aria-label="Conversație cu ghidul tău AI"><header className="ai-companion-head"><div className="ai-avatar"><Bot size={18} /></div><div className="ai-head-copy"><p className="ai-eyebrow">GHIDUL TĂU · {quota.mode === "local" ? "LOCAL" : "ONLINE"}</p><h2>Sunt aici cu tine</h2><span className={`ai-status ${quota.mode === "local" ? "is-local" : ""}`}><i /> {quota.mode === "local" ? `Ghid local până ${formatReset(quota.resetAt)}` : "Îți răspund din contextul bugetului tău"}</span></div><div className="ai-head-actions"><button type="button" className="ai-tool" onClick={clearChat}><Trash2 size={15} /><span>Golește</span></button><button type="button" className="ai-tool" onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{expanded ? "Micșorează" : "Ecran"}</span></button><button type="button" className="ai-tool ai-tool-close" aria-label="Închide ghidul" onClick={() => { setOpen(false); setExpanded(false); }}><X size={16} /></button></div></header><GuideQuotaBar quota={quota} habits={memory.phrases.filter((item) => item.count >= 2).length} /><div className="ai-chat-history" ref={historyRef} aria-live="polite">{messages.map((item) => <div className={`ai-chat-row ${item.role}`} key={item.id}><div className="ai-chat-bubble">{item.role === "assistant" && <Bot size={14} /> }<GuideText text={item.text} /></div>{item.action && <button type="button" className="ai-chat-action" onClick={() => handleAction(item)}><CircleCheck size={14} /> {item.action.label}</button>}{item.undo && onRevert && <button type="button" className="ai-chat-action" onClick={() => { const undone = item.undo; if (!undone) return; onRevert(undone); setMessages((current) => current.map((entry) => entry.id === item.id ? { ...entry, undo: undefined, text: `Am anulat ${undone.title} ${money(undone.amount)}.` } : entry)); }}>Anulează</button>}{item.choices && item.choices.length > 0 && <div className="ai-chat-choices">{item.choices.map((choice) => <button type="button" className="ai-chat-action" key={choice.label} onClick={() => applyChoice(choice)}>{choice.label}</button>)}</div>}</div>)}{typing && <div className="ai-chat-row assistant"><div className="ai-chat-bubble ai-typing"><i /><i /><i /></div></div>}</div>{pendingSpend ? <div className="ai-date-bar"><p>Pe ce zi treci {pendingKind === "income" ? "venitul" : "mișcarea"}? · {dateCopy(spendDay)}</p><div className="ai-date-row"><button type="button" className={`ai-date-chip ${spendDay === shiftDay(-2) ? "is-on" : ""}`} onClick={() => setSpendDay(shiftDay(-2))}>Alaltăieri</button><button type="button" className={`ai-date-chip ${spendDay === shiftDay(-1) ? "is-on" : ""}`} onClick={() => setSpendDay(shiftDay(-1))}>Ieri</button><button type="button" className={`ai-date-chip ${spendDay === shiftDay(0) ? "is-on" : ""}`} onClick={() => setSpendDay(shiftDay(0))}>Azi</button><label className="ai-date-field">Calendar<input type="date" value={spendDay} onChange={(event) => event.target.value && setSpendDay(event.target.value)} /></label></div></div> : null}<div className="ai-chat-suggestions"><button type="button" onClick={() => runAction("add", "Vreau să adaug o mișcare")}>+ Adaugă o mișcare</button><button type="button" onClick={() => runAction("plan", "Ajută-mă cu repartizarea")}>Repartizare</button><button type="button" onClick={() => runAction("journal", "Vreau să văd luna")}>Situația mea</button></div><form className="ai-natural-form ai-chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><label htmlFor="ai-natural-message">Scrie-mi orice despre banii tăi</label><div><input id="ai-natural-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="ex. combustibil 50 lei" /><button type="submit" aria-label="Trimite mesajul"><Send size={16} /></button></div><p><Lightbulb size={12} /> Îți explic, te ghidez și îți cer confirmarea înainte să salvez.</p></form><p className="ai-privacy"><WalletCards size={13} /> Conversația și obiceiurile rămân pe acest telefon. Ghidul local învață din alegerile tale ca să consume mai puțin Gemini.</p></aside>}</>;
}

export default AICompanion;
