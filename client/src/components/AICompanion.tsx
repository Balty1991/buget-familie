import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bot, ChevronDown, CircleCheck, Lightbulb, PieChart, Plus, Send, Sparkles, WalletCards, X } from "lucide-react";
import { expenseCategories, parseNaturalSpendScenario, type AppData, type Transaction } from "@/lib/finance-data";
import type { MainView } from "@/pages/home-kit";
import "../ai-companion.css";

export type NaturalDraft = Pick<Transaction, "amount" | "category" | "title" | "kind"> & { date?: string; note?: string };
export type FinancialUpdate = { kind: "income"; amount: number; title: string; memberId?: string } | { kind: "debt"; name: string; remaining: number } | { kind: "debt-monthly"; amount: number } | { kind: "allocation"; category: string; amount: number; weekly: boolean; weeklyAmount?: number; weeks?: number };
type Props = { data: AppData; view: MainView; onAdd: () => void; onGo: (view: MainView) => void; onNaturalEntry: (draft: NaturalDraft) => void; onFinancialUpdate: (update: FinancialUpdate) => void };
type ChatMessage = { id: string; role: "assistant" | "user"; text: string; action?: { label: string; type: "add" | "plan" | "journal" | "insights" | "apply" }; updates?: FinancialUpdate[] };
type GuideStage = "income" | "debts" | "rate" | "allocation" | "ready";
const CHAT_KEY = "buget-familie:ai-chat-v1";
const today = () => new Date().toISOString().slice(0, 10);
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

type QuotaInfo = { remaining: number | null; limit: number | null; resetAt: string | null; mode: "online" | "local" };
const QUOTA_KEY = "buget-familie:ai-quota-v1";

function emptyQuota(): QuotaInfo {
  return { remaining: null, limit: null, resetAt: null, mode: "online" };
}

function loadQuota(): QuotaInfo {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUOTA_KEY) || "null") as QuotaInfo | null;
    if (!parsed || (parsed.mode !== "online" && parsed.mode !== "local")) return emptyQuota();
    if (parsed.mode === "local" && parsed.resetAt && Date.parse(parsed.resetAt) <= Date.now()) {
      return { ...parsed, mode: "online", remaining: parsed.limit };
    }
    return parsed;
  } catch {
    return emptyQuota();
  }
}

function formatReset(iso: string | null) {
  if (!iso) return "în curând";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "în curând";
  const time = at.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (at.toDateString() === now.toDateString()) return `azi la ${time}`;
  if (at.toDateString() === tomorrow.toDateString()) return `mâine la ${time}`;
  return `${at.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} la ${time}`;
}

function quotaPercent(quota: QuotaInfo) {
  if (quota.mode === "local") return 0;
  if (quota.remaining == null) return 100;
  return Math.max(4, Math.min(100, Math.round((quota.remaining / 40) * 100)));
}

function remainingCopy(remaining: number) {
  if (remaining > 80) return "loc suficient azi";
  if (remaining === 1) return "1 mesaj rămas";
  return `${remaining} mesaje rămase`;
}

function GuideQuotaBar({ quota }: { quota: QuotaInfo }) {
  const percent = quotaPercent(quota);
  const low = quota.mode === "online" && quota.remaining != null && quota.remaining <= 8;
  const label = quota.mode === "local"
    ? `Ghid local · online se reia ${formatReset(quota.resetAt)}`
    : quota.remaining == null
      ? "Ghid online · disponibil"
      : low
        ? `Ghid online aproape plin · ${remainingCopy(quota.remaining)} · se reia ${formatReset(quota.resetAt)}`
        : `Ghid online · ${remainingCopy(quota.remaining)}`;
  return (
    <div className={`ai-quota ${quota.mode === "local" ? "is-local" : low ? "is-low" : "is-ok"}`} aria-live="polite">
      <div className="ai-quota-track" aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>
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
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /(^|\b)(da|ok|okay|adaug|adauga|adaga|creeaz|creaza|confirma|confirm|inregistreaz|salveaz|pune|treci|treceti)(\b|$)/.test(folded) || /intrare|in registru|doar venitul|la venituri/.test(folded);
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
  const amounts = allAmounts(userText).filter((value) => value !== weeklyAmount);
  let amount = extracted?.amount;
  if (!amount && amounts.length) {
    amount = /din (cei|cei|cele)|imparte din/.test(folded) && amounts.length >= 2 ? Math.min(...amounts.filter((value) => value >= 100)) : amounts.find((value) => value >= 100) || amounts[0];
  }
  if (!amount) return undefined;
  const category = extracted?.category
    || (/aliment/.test(folded) ? "Alimente" : /transport|taxi/.test(folded) ? "Transport" : /factura|casa|chirie/.test(folded) ? "Casă & facturi" : /econom/.test(folded) ? "Economii" : "Alimente");
  const weeks = parseWeeks(userText) || (weeklyAmount ? Math.round(amount / weeklyAmount) : 4);
  return { kind: "allocation", category, amount, weekly: true, weeklyAmount, weeks: weeks >= 2 && weeks <= 12 ? weeks : 4 };
}

type ExtractedGuide = {
  amount?: number;
  title?: string;
  category?: string;
  debtName?: string;
  monthlyPayment?: number;
  items?: Array<{ amount?: number; title?: string }>;
};

function updatesFromGuide(intent: string | undefined, extracted: ExtractedGuide | undefined, userText: string, data: AppData, history: ChatMessage[] = []): FinancialUpdate[] {
  const sourceText = allAmounts(userText).length ? userText : [...history].reverse().find((item) => item.role === "user" && allAmounts(item.text).length)?.text || userText;
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
    return named.map((item, index) => ({ kind: "income" as const, amount: item.amount, title: item.title || (index ? "Salariu partener" : "Salariu"), memberId: memberIdFor(data, item.title || "", index) }));
  }
  const spoken = allAmounts(sourceText);
  if (spoken.length >= 2 && /salariu|venit|sotie|soție|partener|intrare|întrare/i.test(sourceText)) {
    return spoken.slice(0, 3).map((amount, index) => ({
      kind: "income" as const,
      amount,
      title: index === 0 ? "Salariu" : index === 1 ? "Salariu partener" : `Venit ${index + 1}`,
      memberId: memberIdFor(data, sourceText, index),
    }));
  }
  if (extracted?.amount) {
    return [{ kind: "income", amount: extracted.amount, title: extracted.title || "Venit lunar", memberId: memberIdFor(data, extracted.title || sourceText, 0) }];
  }
  if (spoken.length === 1 && /venit|salariu|intrare|întrare/i.test(sourceText)) {
    return [{ kind: "income", amount: spoken[0], title: /salariu/i.test(sourceText) ? "Salariu" : "Venit lunar", memberId: data.settings.members[0]?.id }];
  }
  return [];
}

export function AICompanion({ data, view, onAdd, onGo, onNaturalEntry, onFinancialUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [pendingDebtName, setPendingDebtName] = useState("");
  const [guideStage, setGuideStage] = useState<GuideStage>(() => { const saved = window.localStorage.getItem("buget-familie:ai-guide-stage-v1") as GuideStage | null; return saved || "income"; });
  const [messages, setMessages] = useState<ChatMessage[]>(() => { try { return JSON.parse(window.localStorage.getItem(CHAT_KEY) || "[]") as ChatMessage[]; } catch { return []; } });
  const [quota, setQuota] = useState<QuotaInfo>(() => loadQuota());
  const monthSummary = useMemo(() => { const month = today().slice(0, 7); const current = data.transactions.filter((item) => item.date.startsWith(month)); return { income: current.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0), expense: current.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0) }; }, [data]);
  const contextReply = useMemo(() => { if (guideStage === "income") return "Sunt aici cu tine și te ghidez pas cu pas. Începem cu veniturile: ce bani intră într-o lună obișnuită — salariu, pensie, freelancing sau alte venituri? Spune-mi suma și îți pun prima bază în aplicație."; if (guideStage === "debts") return "Perfect, am notat venitul. Acum vreau să expunem toate obligațiile: ai credite, rate, carduri de cumpărături sau bani împrumutați? Spune-mi numele și soldul aproximativ. Dacă nu ai, spune doar «nu am datorii»."; if (guideStage === "rate") return `Am trecut „${pendingDebtName || "datoria"}”. Mai știi cât plătești lunar pentru ea? Dacă nu știi exact, spune o estimare sau «nu știu».`; if (guideStage === "allocation") return "Acum împărțim venitul: cât vrei să rezervi pentru mâncare, casă și facturi, transport și economii? Poți scrie într-o singură frază, de exemplu «alimente 1500, facturi 800, transport 400, economii 500»."; if (!data.transactions.length) return "Sunt aici cu tine. Poți să-mi scrii orice mișcare în cuvintele tale, iar eu o verific înainte să o salvez."; if (monthSummary.income > 0 && monthSummary.expense > monthSummary.income) return `M-am uitat la luna aceasta: ai ${money(monthSummary.expense)} cheltuieli și ${money(monthSummary.income)} venituri. Nu te judec — hai să vedem împreună ce ajustăm.`; return `Sunt cu tine în ${view === "today" ? "tabloul de azi" : "secțiunea deschisă"}. Spune-mi ce vrei să înțelegi sau să schimbi.`; }, [data, guideStage, monthSummary, pendingDebtName, view]);

  useEffect(() => { try { window.localStorage.setItem("buget-familie:ai-guide-stage-v1", guideStage); } catch { /* ignore */ } }, [guideStage]);
  useEffect(() => { if (!open || messages.length) return; setMessages([{ id: "welcome", role: "assistant", text: contextReply }]); }, [open, messages.length, contextReply]);
  useEffect(() => { try { window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30))); } catch { /* spațiu local indisponibil */ } }, [messages]);
  useEffect(() => { try { window.localStorage.setItem(QUOTA_KEY, JSON.stringify(quota)); } catch { /* ignore */ } }, [quota]);
  useEffect(() => {
    if (quota.mode !== "local" || !quota.resetAt) return;
    const tick = () => {
      if (Date.parse(quota.resetAt!) <= Date.now()) setQuota((current) => ({ ...current, mode: "online" }));
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

  const addMessage = (entry: Omit<ChatMessage, "id">) => setMessages((current) => [...current, { ...entry, id: `${Date.now()}-${current.length}` }].slice(-30));
  const runAction = (type: "add" | "plan" | "journal" | "insights", label: string) => { addMessage({ role: "user", text: label }); setTyping(true); window.setTimeout(() => { setTyping(false); addMessage({ role: "assistant", text: type === "add" ? "Deschid formularul. Completează ce mai lipsește și verifică înainte să salvezi." : type === "plan" ? "Deschid planul. Acolo așezăm veniturile pe destinații și ritmuri." : type === "journal" ? "Deschid jurnalul și ne uităm la mișcările care contează." : "Deschid analiza ca să vedem tiparele lunii.", action: { type, label: type === "add" ? "Deschide formularul" : type === "plan" ? "Vezi planul" : type === "journal" ? "Vezi jurnalul" : "Vezi analiza" } }); }, 260); };
  const handleAction = (item: ChatMessage) => {
    if (item.action?.type === "apply" && item.updates?.length) {
      item.updates.forEach((update) => onFinancialUpdate(update));
      addMessage({ role: "assistant", text: `Am trecut ${item.updates.map((update) => `${update.kind === "income" ? update.title : update.kind} ${"amount" in update ? money(update.amount) : ""}`.trim()).join(" și ")} în registru. Le vezi la Mișcări.`, action: { type: "journal", label: "Vezi în Mișcări" } });
      return;
    }
    if (!item.action || item.action.type === "apply") return;
    if (item.action.type === "add") onAdd();
    else onGo(item.action.type);
    setOpen(false);
  };
  const applyGuide = (updates: FinancialUpdate[]) => {
    updates.forEach((update) => onFinancialUpdate(update));
    if (updates.some((update) => update.kind === "income")) setGuideStage("debts");
  };
  const firstAmount = (raw: string) => { const match = raw.match(/\d[\d\s.]*(?:,\d{1,2})?/); if (!match) return 0; const token = match[0].replace(/\s/g, ""); const normalized = token.includes(",") ? token.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(token) ? token.replace(/\./g, "") : token; return parseFloat(normalized) || 0; };
  const localSend = (alreadyAdded = false, draft = message) => { const raw = draft.trim(); if (!raw) return; setMessage(""); if (!alreadyAdded) addMessage({ role: "user", text: raw }); const amount = firstAmount(raw); const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); setTyping(true); window.setTimeout(() => { setTyping(false); if (guideStage === "income") { if (!amount) { addMessage({ role: "assistant", text: "Am nevoie doar de o sumă aproximativă. De exemplu: «salariul meu este 6.500 lei pe lună»." }); return; } onFinancialUpdate({ kind: "income", amount, title: /salariu/i.test(folded) ? "Salariu lunar" : "Venit lunar" }); setGuideStage("debts"); addMessage({ role: "assistant", text: `Am notat ${money(amount)} ca venit lunar. Următoarea întrebare: ai datorii, credite, rate sau carduri de cumpărături?` }); return; } if (guideStage === "debts") { if (/nu\s+(am|exista)|fara\s+datorii|niciuna/.test(folded)) { setGuideStage("allocation"); addMessage({ role: "assistant", text: "În regulă, fără datorii. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii. Ce sume vrei să rezervi?" }); return; } if (!amount) { addMessage({ role: "assistant", text: "Spune-mi, de exemplu: «Credit auto, mai am 18.000 lei» sau «rată la bancă, sold 42.000 lei»." }); return; } const debtName = raw.replace(/\d[\d.,\s]*(?:lei|ron)?/gi, "").replace(/(mai am|sold|datorie|credit|rata|rată|la banca|la bancă)/gi, "").replace(/[,:-]/g, " ").trim() || "Datorie"; setPendingDebtName(debtName); onFinancialUpdate({ kind: "debt", name: debtName, remaining: amount }); setGuideStage("rate"); addMessage({ role: "assistant", text: `Am trecut „${debtName}” cu soldul de ${money(amount)}. Cât plătești lunar pentru această datorie?` }); return; } if (guideStage === "rate") { if (amount) onFinancialUpdate({ kind: "debt-monthly", amount }); setGuideStage("allocation"); addMessage({ role: "assistant", text: amount ? `Am notat rata de ${money(amount)}. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii.` : "În regulă, lăsăm rata de completat mai târziu. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii." }); return; } if (guideStage === "allocation") { const categories = ["alimente", "facturi", "casa", "transport", "economii", "datorii"]; const found = categories.map((category) => { const match = folded.match(new RegExp(`${category}[^\\d]{0,18}(\\d[\\d.,]*)`)); return match ? { category, amount: firstAmount(match[1]) } : undefined; }).filter((item): item is { category: string; amount: number } => Boolean(item?.amount)); if (!found.length) { addMessage({ role: "assistant", text: "Nu am găsit categoriile și sumele. Scrie simplu: «alimente 1500, facturi 800, transport 400, economii 500»." }); return; } found.forEach((item) => onFinancialUpdate({ kind: "allocation", category: item.category === "facturi" || item.category === "casa" ? "Casă & facturi" : item.category[0].toLocaleUpperCase("ro-RO") + item.category.slice(1), amount: item.amount, weekly: item.category === "alimente" || item.category === "transport" })); setGuideStage("ready"); addMessage({ role: "assistant", text: `Am repartizat ${found.map((item) => `${item.category} ${money(item.amount)}`).join(", ")}. Putem ajusta orice sumă. De acum sunt disponibil să urmărim împreună cheltuielile, veniturile și ritmul lunii.` }); return; } const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]); if (!parsed.understood) { addMessage({ role: "assistant", text: "Spune-mi suma și ce ai plătit, de exemplu: «am cheltuit 50 de lei pe combustibil»." }); return; } addMessage({ role: "assistant", text: `Am înțeles: ${parsed.title}, ${money(parsed.amount)}, ${parsed.timing === "mâine" ? "mâine" : "astăzi"}. Îți deschid formularul cu aceste date precompletate; verificăm împreună înainte de salvare.`, action: { type: "add", label: "Deschide și verifică" } }); onNaturalEntry({ kind: "expense", amount: parsed.amount, category: parsed.category || "Alimente", title: naturalTitle(raw, parsed.category), date: parsed.timing === "mâine" ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) : today(), note: raw }); }, 420); };

  const send = () => {
    const raw = message.trim();
    if (!raw) return;
    setMessage("");
    addMessage({ role: "user", text: raw });
    const blocked = quota.mode === "local" && quota.resetAt && Date.parse(quota.resetAt) > Date.now();
    if (blocked) {
      setQuota((current) => ({ ...current, mode: "local", remaining: 0 }));
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
        const nextQuota: QuotaInfo = {
          remaining: payload.quota?.remaining ?? (response.ok ? quota.remaining : 0),
          limit: payload.quota?.limit ?? quota.limit,
          resetAt: payload.quota?.remaining != null && payload.quota.remaining > 8 && payload.quota.resetAt && Date.parse(payload.quota.resetAt) - Date.now() < 15 * 60 * 1000 ? null : payload.quota?.resetAt ?? quota.resetAt,
          mode: response.ok ? "online" : "local",
        };
        setQuota(nextQuota);
        if (!response.ok) throw new Error(payload.code || "AI unavailable");
        setTyping(false);
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
              : payload.intent === "expense" && payload.extracted?.amount
                ? { type: "add", label: "Deschide și verifică" }
                : undefined,
          updates: !saveNow && updates.length ? updates : undefined,
        });
        if (payload.intent === "expense" && payload.extracted?.amount) onNaturalEntry({ kind: "expense", amount: payload.extracted.amount, category: payload.extracted.category || "Alimente", title: payload.extracted.title || "Cheltuială", date: today(), note: raw });
      } catch {
        setQuota((current) => ({ ...current, mode: "local", remaining: 0, resetAt: current.resetAt || new Date(Date.now() + 60 * 60 * 1000).toISOString() }));
        setTyping(false);
        localSend(true, raw);
      }
    })();
  };
  return <><button type="button" className={`ai-companion-trigger ${open ? "is-open" : ""} ${quota.mode === "local" ? "is-local" : ""}`} aria-label={open ? "Închide ghidul AI" : "Deschide ghidul AI"} onClick={() => setOpen((value) => !value)}><span className="ai-trigger-pulse" /><Sparkles size={21} /><span>Ghidul tău</span>{open ? <ChevronDown size={14} /> : <span className="ai-live">{quota.mode === "local" ? "LOCAL" : "ONLINE"}</span>}</button>{open && <aside className="ai-companion-panel ai-chat-panel" aria-label="Conversație cu ghidul tău AI"><header className="ai-companion-head"><div className="ai-avatar"><Bot size={18} /></div><div><p className="ai-eyebrow">GHIDUL TĂU · {quota.mode === "local" ? "LOCAL" : "ONLINE"}</p><h2>Sunt aici cu tine</h2><span className={`ai-status ${quota.mode === "local" ? "is-local" : ""}`}><i /> {quota.mode === "local" ? `Ghid local până ${formatReset(quota.resetAt)}` : "Îți răspund din contextul bugetului tău"}</span></div><button type="button" className="ai-close" aria-label="Închide ghidul" onClick={() => setOpen(false)}><X size={17} /></button></header><GuideQuotaBar quota={quota} /><div className="ai-chat-history" ref={historyRef} aria-live="polite">{messages.map((item) => <div className={`ai-chat-row ${item.role}`} key={item.id}><div className="ai-chat-bubble">{item.role === "assistant" && <Bot size={14} /> }<GuideText text={item.text} /></div>{item.action && <button type="button" className="ai-chat-action" onClick={() => handleAction(item)}><CircleCheck size={14} /> {item.action.label}</button>}</div>)}{typing && <div className="ai-chat-row assistant"><div className="ai-chat-bubble ai-typing"><i /><i /><i /></div></div>}</div><div className="ai-chat-suggestions"><button type="button" onClick={() => runAction("add", "Vreau să adaug o mișcare")}>+ Adaugă o mișcare</button><button type="button" onClick={() => runAction("plan", "Ajută-mă cu repartizarea")}>Repartizare</button><button type="button" onClick={() => runAction("journal", "Vreau să văd luna")}>Situația mea</button></div><form className="ai-natural-form ai-chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><label htmlFor="ai-natural-message">Scrie-mi orice despre banii tăi</label><div><input id="ai-natural-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="ex. combustibil 50 lei" /><button type="submit" aria-label="Trimite mesajul"><Send size={16} /></button></div><p><Lightbulb size={12} /> Îți explic, te ghidez și îți cer confirmarea înainte să salvez.</p></form><p className="ai-privacy"><WalletCards size={13} /> Conversația este păstrată local pe acest dispozitiv.</p></aside>}</>;
}

export default AICompanion;
